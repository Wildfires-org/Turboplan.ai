import assert from "node:assert";
import { afterEach, before, beforeEach, describe, it, mock } from "node:test";
import { S3Client } from "@aws-sdk/client-s3";

import { resetEnvCache } from "@wildfires-org/turboplan-env";

import {
  BUCKET_UPLOAD_PATH,
  bucketUploadRouter,
  createUploadToken,
  verifyUploadToken,
} from "../src/server/bucket-upload";
import { claimLandingUpload } from "../src/server/landing-uploads";
import {
  deleteFile,
  generatePresignedUploadUrl,
  getObjectBytes,
  uploadFile,
} from "../src/server/r2-client";
import {
  getStorageBucket,
  type StorageBucket,
  type StorageBucketObject,
  type StorageBucketPutValue,
  setStorageBucket,
} from "../src/server/storage-bucket";

// Storage on an R2 bucket binding: every operation goes to the binding (never
// the S3 client), no R2 credentials are needed, and browser uploads go
// through the API's signed upload route instead of an S3 presigned URL.

const PUBLIC_URL = "https://files.example.test";
const SERVER_URL = "https://api.example.test";
const USER_ID = "11111111-1111-1111-1111-111111111111";
const UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const LANDING_KEY = `landing-uploads/1730000000000-${UUID}-site plan.pdf`;

type StoredEntry = { bytes: Uint8Array; contentType?: string; etag: string };

const toBytes = async (value: StorageBucketPutValue): Promise<Uint8Array> => {
  if (typeof value === "string") {
    return new TextEncoder().encode(value);
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return new Uint8Array(await new Response(value).arrayBuffer());
};

const streamOf = (bytes: Uint8Array) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });

// An in-memory stand-in for an R2 binding, with R2's ETag forms.
const createFakeBucket = () => {
  const objects = new Map<string, StoredEntry>();
  let version = 0;

  const describeEntry = (key: string, entry: StoredEntry) =>
    ({
      key,
      size: entry.bytes.byteLength,
      etag: entry.etag,
      httpEtag: `"${entry.etag}"`,
      httpMetadata: { contentType: entry.contentType },
    }) satisfies StorageBucketObject;

  const bucket: StorageBucket = {
    head: async (key) => {
      const entry = objects.get(key);
      return entry ? describeEntry(key, entry) : null;
    },
    get: async (key, options) => {
      const entry = objects.get(key);
      if (!entry) {
        return null;
      }
      const etagMatches = options?.onlyIf?.etagMatches;
      if (etagMatches !== undefined && etagMatches !== entry.etag) {
        return describeEntry(key, entry);
      }
      return { ...describeEntry(key, entry), body: streamOf(entry.bytes) };
    },
    put: async (key, value, options) => {
      version += 1;
      objects.set(key, {
        bytes: await toBytes(value),
        contentType: options?.httpMetadata?.contentType,
        etag: `etag-${version}`,
      });
      return null;
    },
    delete: async (key) => {
      objects.delete(key);
    },
  };

  return { bucket, objects };
};

let fake: ReturnType<typeof createFakeBucket>;

before(() => {
  for (const name of [
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "R2_ACCOUNT_ID",
  ]) {
    delete process.env[name];
  }
  process.env.R2_PUBLIC_URL = PUBLIC_URL;
  process.env.SERVER_URL = SERVER_URL;
  process.env.JWT_SIGNING_SECRET = "test-jwt-signing-secret";
  resetEnvCache();
});

beforeEach(() => {
  fake = createFakeBucket();
  setStorageBucket(fake.bucket);
  mock.method(S3Client.prototype, "send", async () => {
    throw new Error("the S3 client must not be used with a bucket binding");
  });
});

afterEach(() => {
  setStorageBucket(undefined);
  mock.restoreAll();
});

describe("setStorageBucket", () => {
  it("registers a binding and clears on anything that is not one", () => {
    assert.strictEqual(getStorageBucket(), fake.bucket);
    setStorageBucket(undefined);
    assert.strictEqual(getStorageBucket(), null);
    setStorageBucket({ put: () => {} });
    assert.strictEqual(getStorageBucket(), null);
  });
});

describe("storage on a bucket binding", () => {
  it("writes, reads and deletes without R2 credentials", async () => {
    const { url, key } = await uploadFile(
      "uploads/u/note.txt",
      "hello",
      "text/plain",
    );
    assert.strictEqual(url, `${PUBLIC_URL}/uploads/u/note.txt`);
    assert.strictEqual(fake.objects.get(key)?.contentType, "text/plain");

    const read = await getObjectBytes(key, { maxBytes: 16, timeoutMs: 1000 });
    assert.deepStrictEqual(read, {
      data: new TextEncoder().encode("hello"),
      contentType: "text/plain",
    });

    await deleteFile(url);
    assert.strictEqual(fake.objects.has(key), false);
  });

  it("caps reads and reports a missing object as null", async () => {
    const warn = mock.method(console, "warn", () => {});
    await uploadFile("uploads/u/big.bin", new Uint8Array(32), "image/png");

    assert.strictEqual(
      await getObjectBytes("uploads/u/big.bin", {
        maxBytes: 8,
        timeoutMs: 1000,
      }),
      null,
    );
    assert.strictEqual(
      await getObjectBytes("uploads/u/none.png", {
        maxBytes: 8,
        timeoutMs: 1000,
      }),
      null,
    );
    assert.deepStrictEqual(
      warn.mock.calls.map(
        (call) => (call.arguments[1] as { reason: string }).reason,
      ),
      ["too_large", "not_found"],
    );
  });

  it("claims a landing upload by copying with the validated type", async () => {
    await fake.bucket.put(LANDING_KEY, new Uint8Array([1, 2, 3]), {
      httpMetadata: { contentType: "application/pdf; charset=binary" },
    });

    const claimed = await claimLandingUpload(LANDING_KEY, USER_ID);

    assert.ok(claimed);
    assert.strictEqual(claimed.contentType, "application/pdf");
    assert.strictEqual(fake.objects.has(LANDING_KEY), false);
    const copied = fake.objects.get(claimed.key);
    assert.deepStrictEqual(copied?.bytes, new Uint8Array([1, 2, 3]));
    assert.strictEqual(copied?.contentType, "application/pdf");
    assert.strictEqual(claimed.url, `${PUBLIC_URL}/${claimed.key}`);
  });

  it("refuses the copy when the source changed after it was inspected", async () => {
    await fake.bucket.put(LANDING_KEY, new Uint8Array([1]), {
      httpMetadata: { contentType: "application/pdf" },
    });
    const { get } = fake.bucket;
    // Replaced between HEAD and the copy's read: the ETag no longer matches.
    fake.bucket.get = async (key, options) => {
      await fake.bucket.put(key, new Uint8Array([9]), {
        httpMetadata: { contentType: "application/pdf" },
      });
      return get(key, options);
    };

    await assert.rejects(claimLandingUpload(LANDING_KEY, USER_ID), {
      name: "PreconditionFailed",
    });
  });
});

describe("browser uploads through the API", () => {
  const put = (
    url: string,
    body: string,
    headers: Record<string, string> = {},
  ) => {
    const { pathname, search } = new URL(url);
    assert.strictEqual(pathname, BUCKET_UPLOAD_PATH);
    return bucketUploadRouter.request(`/${search}`, {
      method: "PUT",
      body,
      headers: {
        "content-type": "application/pdf",
        "content-length": String(new TextEncoder().encode(body).byteLength),
        ...headers,
      },
    });
  };

  it("presigns an API URL whose PUT stores the body at the key", async () => {
    const { uploadUrl, publicUrl, key } = await generatePresignedUploadUrl(
      "uploads/u/plan.pdf",
      "application/pdf",
      4,
    );

    assert.ok(
      uploadUrl.startsWith(`${SERVER_URL}${BUCKET_UPLOAD_PATH}?token=`),
    );
    assert.strictEqual(publicUrl, `${PUBLIC_URL}/uploads/u/plan.pdf`);

    const response = await put(uploadUrl, "%PDF");
    assert.strictEqual(response.status, 200);
    assert.strictEqual(fake.objects.get(key)?.contentType, "application/pdf");
  });

  it("refuses another Content-Type or length, as a presigned URL does", async () => {
    const { uploadUrl } = await generatePresignedUploadUrl(
      "uploads/u/plan.pdf",
      "application/pdf",
      4,
    );

    const wrongType = await put(uploadUrl, "%PDF", {
      "content-type": "text/html",
    });
    assert.strictEqual(wrongType.status, 403);

    const wrongLength = await put(uploadUrl, "%PDF-1.7");
    assert.strictEqual(wrongLength.status, 400);

    assert.strictEqual(fake.objects.size, 0);
  });

  it("refuses a tampered, foreign or expired token", async () => {
    const grant = {
      key: "uploads/u/plan.pdf",
      contentType: "application/pdf",
      contentLength: 4,
    };
    const token = await createUploadToken(grant);
    const [payload, signature] = token.split(".");
    const otherPayload = Buffer.from(
      JSON.stringify({ ...grant, key: "uploads/v/plan.pdf", expiresAt: 9e9 }),
    ).toString("base64url");

    assert.ok(await verifyUploadToken(token));
    assert.strictEqual(
      await verifyUploadToken(`${otherPayload}.${signature}`),
      null,
    );
    assert.strictEqual(await verifyUploadToken(`${payload}.`), null);
    assert.strictEqual(await verifyUploadToken(`${token}.x`), null);
    assert.strictEqual(
      await verifyUploadToken(token, Date.now() + 301_000),
      null,
    );

    process.env.JWT_SIGNING_SECRET = "another-secret";
    try {
      assert.strictEqual(await verifyUploadToken(token), null);
    } finally {
      process.env.JWT_SIGNING_SECRET = "test-jwt-signing-secret";
    }
  });

  it("is not there when storage uses the S3 API", async () => {
    const { uploadUrl } = await generatePresignedUploadUrl(
      "uploads/u/plan.pdf",
      "application/pdf",
      4,
    );
    setStorageBucket(undefined);

    const response = await put(uploadUrl, "%PDF");
    assert.strictEqual(response.status, 404);
  });
});
