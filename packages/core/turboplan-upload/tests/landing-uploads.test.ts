import assert from "node:assert";
import { afterEach, before, describe, it, mock } from "node:test";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { resetEnvCache } from "@wildfires-org/turboplan-env";

import {
  claimLandingUpload,
  parseLandingUploadKey,
} from "../src/server/landing-uploads";
import { publicUploadRouter } from "../src/server/public-router";
import { isOwnedUploadUrl } from "../src/server/r2-client";
import { UploadService } from "../src/server/UploadService";
import {
  PROJECT_DOCUMENT_MAX_FILE_SIZE,
  UploadError,
  UploadErrorCode,
} from "../src/types";

const PUBLIC_URL = "https://files.example.test";
const USER_ID = "11111111-1111-1111-1111-111111111111";
const UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const SEGMENT = `1730000000000-${UUID}-site plan.pdf`;
const KEY = `landing-uploads/${SEGMENT}`;
const PDF = "application/pdf";

const isValidationError = (error: unknown) => {
  assert.ok(error instanceof UploadError);
  assert.strictEqual(error.code, UploadErrorCode.VALIDATION_ERROR);
  return true;
};

before(() => {
  process.env.R2_ACCESS_KEY_ID = "test-key";
  process.env.R2_SECRET_ACCESS_KEY = "test-secret";
  process.env.R2_BUCKET_NAME = "test-bucket";
  process.env.R2_ACCOUNT_ID = "test-account";
  process.env.R2_PUBLIC_URL = PUBLIC_URL;
  resetEnvCache();
});

afterEach(() => {
  mock.restoreAll();
});

describe("parseLandingUploadKey", () => {
  it("accepts a generated staging key and recovers the filename", () => {
    assert.deepStrictEqual(parseLandingUploadKey(KEY), {
      segment: SEGMENT,
      originalFilename: "site plan.pdf",
    });
  });

  it("rejects anything that is not exactly landing-uploads/<generated segment>", () => {
    for (const key of [
      undefined,
      null,
      42,
      "",
      "landing-uploads/",
      SEGMENT,
      `/${KEY}`,
      `uploads/${USER_ID}/${SEGMENT}`,
      `landing-uploadsX/${SEGMENT}`,
      `LANDING-UPLOADS/${SEGMENT}`,
      // Traversal and nesting
      `landing-uploads/../uploads/${USER_ID}/${SEGMENT}`,
      `landing-uploads/${SEGMENT}/../x.pdf`,
      `landing-uploads/a/${SEGMENT}`,
      `landing-uploads//${SEGMENT}`,
      `landing-uploads/1730000000000-${UUID}-a/b.pdf`,
      `landing-uploads/1730000000000-${UUID}-..\\x.pdf`,
      // Not the uniqueStorageName shape
      "landing-uploads/report.pdf",
      `landing-uploads/173000000000-${UUID}-x.pdf`,
      `landing-uploads/1730000000000-${UUID.toUpperCase()}-x.pdf`,
      `landing-uploads/1730000000000-${UUID}-`,
      // URL delimiters, encodings and control / format characters
      `landing-uploads/1730000000000-${UUID}-x%2e%2e%2fy.pdf`,
      `landing-uploads/1730000000000-${UUID}-x#y.pdf`,
      `landing-uploads/1730000000000-${UUID}-x?y.pdf`,
      `landing-uploads/1730000000000-${UUID}-x\u0000.pdf`,
      `landing-uploads/1730000000000-${UUID}-x\r\n.pdf`,
      `landing-uploads/1730000000000-${UUID}-x\u007f.pdf`,
      `landing-uploads/1730000000000-${UUID}-fdp.exe‮.pdf`,
      // Longer than the 255-char filename column
      `landing-uploads/1730000000000-${UUID}-${"a".repeat(201)}.pdf`,
    ]) {
      assert.strictEqual(parseLandingUploadKey(key), null, String(key));
    }
  });
});

type SentCommand = { constructor: unknown; input: Record<string, unknown> };

const mockStorage = (
  handlers: {
    head?: () => unknown;
    copy?: () => unknown;
    delete?: () => unknown;
  } = {},
) => {
  const sent: SentCommand[] = [];
  const send = mock.method(
    S3Client.prototype,
    "send",
    async (command: SentCommand) => {
      sent.push(command);
      if (command instanceof HeadObjectCommand) {
        return (
          handlers.head?.() ?? {
            ContentType: PDF,
            ContentLength: 2048,
            ETag: '"etag-1"',
          }
        );
      }
      if (command instanceof CopyObjectCommand) {
        return handlers.copy?.() ?? {};
      }
      if (command instanceof DeleteObjectCommand) {
        return handlers.delete?.() ?? {};
      }
      throw new Error("unexpected command");
    },
  );
  return { send, sent };
};

const notFound = () => {
  throw Object.assign(new Error("NotFound"), {
    name: "NotFound",
    $metadata: { httpStatusCode: 404 },
  });
};

describe("claimLandingUpload", () => {
  it("refuses a malformed key before touching storage", async () => {
    const { send } = mockStorage();

    for (const key of [
      `landing-uploads/../uploads/${USER_ID}/${SEGMENT}`,
      `uploads/${USER_ID}/${SEGMENT}`,
      "landing-uploads/report.pdf",
    ]) {
      await assert.rejects(claimLandingUpload(key, USER_ID), isValidationError);
    }
    assert.strictEqual(send.mock.callCount(), 0);
  });

  it("refuses an owner id that could widen the destination prefix", async () => {
    const { send } = mockStorage();

    for (const userId of ["", "..", "a/b"]) {
      await assert.rejects(claimLandingUpload(KEY, userId), isValidationError);
    }
    assert.strictEqual(send.mock.callCount(), 0);
  });

  it("returns null when the staging object does not exist", async () => {
    const { sent } = mockStorage({ head: notFound });

    assert.strictEqual(await claimLandingUpload(KEY, USER_ID), null);
    assert.strictEqual(sent.length, 1);
  });

  it("trusts the stored type and size, not the client's", async () => {
    for (const head of [
      { ContentType: "text/html", ContentLength: 10 },
      { ContentType: "image/png", ContentLength: 10 },
      { ContentType: PDF, ContentLength: 0 },
      { ContentType: PDF, ContentLength: PROJECT_DOCUMENT_MAX_FILE_SIZE + 1 },
    ]) {
      const { sent } = mockStorage({ head: () => head });

      await assert.rejects(claimLandingUpload(KEY, USER_ID), isValidationError);
      assert.ok(
        !sent.some((command) => command instanceof CopyObjectCommand),
        JSON.stringify(head),
      );
      mock.restoreAll();
    }
  });

  it("copies into the owner's uploads prefix, pinned to the inspected ETag", async () => {
    const { sent } = mockStorage();

    const claimed = await claimLandingUpload(KEY, USER_ID);

    const destinationKey = `uploads/${USER_ID}/${SEGMENT}`;
    assert.deepStrictEqual(claimed, {
      url: `${PUBLIC_URL}/${destinationKey}`,
      key: destinationKey,
      size: 2048,
      contentType: PDF,
      originalFilename: "site plan.pdf",
    });
    assert.ok(claimed && isOwnedUploadUrl(claimed.url, USER_ID));

    const copy = sent.find((command) => command instanceof CopyObjectCommand);
    assert.deepStrictEqual(copy?.input, {
      Bucket: "test-bucket",
      Key: destinationKey,
      CopySource: `test-bucket/landing-uploads/${encodeURIComponent(SEGMENT)}`,
      CopySourceIfMatch: '"etag-1"',
    });

    const deleted = sent.find(
      (command) => command instanceof DeleteObjectCommand,
    );
    assert.deepStrictEqual(deleted?.input, { Bucket: "test-bucket", Key: KEY });
  });

  it("normalises a stored content type with parameters", async () => {
    mockStorage({
      head: () => ({
        ContentType: "Application/PDF; charset=binary",
        ContentLength: 1,
      }),
    });
    const claimed = await claimLandingUpload(KEY, USER_ID);
    assert.strictEqual(claimed?.contentType, PDF);
  });

  it("still succeeds when deleting the staging object fails", async () => {
    mockStorage({
      delete: () => {
        throw new Error("delete failed");
      },
    });
    mock.method(console, "warn", () => {});

    const claimed = await claimLandingUpload(KEY, USER_ID);
    assert.strictEqual(claimed?.key, `uploads/${USER_ID}/${SEGMENT}`);
  });

  it("passes storage failures other than not-found through", async () => {
    mockStorage({
      copy: () => {
        throw new Error("PreconditionFailed");
      },
    });

    await assert.rejects(
      claimLandingUpload(KEY, USER_ID),
      /PreconditionFailed/,
    );
  });
});

describe("UploadService.generateLandingPresignedUrl", () => {
  const service = new UploadService();
  const KEY_PATTERN = new RegExp(
    `^landing-uploads/\\d{13}-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-`,
  );

  it("issues a staging key the claim step accepts", async () => {
    const { uploadUrl, key } = await service.generateLandingPresignedUrl(
      "Site Plan.pdf",
      PDF,
      1024,
    );

    assert.match(key, KEY_PATTERN);
    assert.ok(key.endsWith("-Site Plan.pdf"));
    assert.strictEqual(
      parseLandingUploadKey(key)?.originalFilename,
      "Site Plan.pdf",
    );
    assert.ok(uploadUrl.includes("test-bucket"));
  });

  it("accepts every project document type and the size cap", async () => {
    for (const contentType of [
      PDF,
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]) {
      await service.generateLandingPresignedUrl(
        "a.doc",
        contentType,
        PROJECT_DOCUMENT_MAX_FILE_SIZE,
      );
    }
  });

  it("refuses types outside the project document list, even ones authed uploads allow", async () => {
    for (const contentType of [
      "image/png",
      "application/zip",
      "application/json",
      "text/html",
      "image/svg+xml",
      // Signed verbatim, so it must be exact
      "application/pdf; charset=utf-8",
      "APPLICATION/PDF",
      "",
    ]) {
      await assert.rejects(
        service.generateLandingPresignedUrl("a.pdf", contentType, 10),
        isValidationError,
        contentType,
      );
    }
  });

  it("refuses empty, fractional and oversized files", async () => {
    for (const fileSize of [
      0,
      -1,
      1.5,
      Number.NaN,
      PROJECT_DOCUMENT_MAX_FILE_SIZE + 1,
    ]) {
      await assert.rejects(
        service.generateLandingPresignedUrl("a.pdf", PDF, fileSize),
        isValidationError,
        String(fileSize),
      );
    }
  });

  it("strips separators, URL delimiters and spoofing characters from the name", async () => {
    const { key } = await service.generateLandingPresignedUrl(
      "q3/#2 50%‮\u0000 report.pdf",
      PDF,
      10,
    );

    assert.ok(key.endsWith("-q32 50 report.pdf"), key);
    assert.ok(parseLandingUploadKey(key));
  });

  it("refuses path traversal in the name", async () => {
    await assert.rejects(
      service.generateLandingPresignedUrl("../../uploads/x.pdf", PDF, 10),
      isValidationError,
    );
  });

  it("keeps the key segment within the filename column, extension intact", async () => {
    const { key } = await service.generateLandingPresignedUrl(
      `${"a".repeat(400)}.docx`,
      PDF,
      10,
    );

    const parsed = parseLandingUploadKey(key);
    assert.ok(parsed);
    assert.strictEqual(parsed.segment.length, 255);
    assert.ok(parsed.originalFilename.endsWith("a.docx"));
  });
});

describe("publicUploadRouter POST /presign", () => {
  const presign = (body: unknown) =>
    publicUploadRouter.request("/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  it("returns exactly { uploadUrl, key } without any user context", async () => {
    const response = await presign({
      filename: "brief.pdf",
      contentType: PDF,
      fileSize: 100,
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as Record<string, string>;
    assert.deepStrictEqual(Object.keys(body).sort(), ["key", "uploadUrl"]);
    assert.ok(parseLandingUploadKey(body.key));
  });

  it("answers 400 { error, code } for malformed bodies", async () => {
    for (const body of [
      "not json",
      {},
      { filename: "a.pdf", contentType: PDF },
      { filename: "", contentType: PDF, fileSize: 1 },
      { filename: "a.pdf", contentType: PDF, fileSize: "1" },
      { filename: "a.pdf", contentType: PDF, fileSize: 1.5 },
    ]) {
      const response = await presign(body);
      assert.strictEqual(response.status, 400, JSON.stringify(body));
      const json = (await response.json()) as Record<string, unknown>;
      assert.strictEqual(json.code, UploadErrorCode.VALIDATION_ERROR);
      assert.strictEqual(typeof json.error, "string");
    }
  });

  it("answers 400 { error, code } for a disallowed type or size", async () => {
    for (const body of [
      { filename: "a.png", contentType: "image/png", fileSize: 1 },
      {
        filename: "a.pdf",
        contentType: PDF,
        fileSize: PROJECT_DOCUMENT_MAX_FILE_SIZE + 1,
      },
    ]) {
      const response = await presign(body);
      assert.strictEqual(response.status, 400, JSON.stringify(body));
      const json = (await response.json()) as Record<string, unknown>;
      assert.deepStrictEqual(Object.keys(json).sort(), ["code", "error"]);
      assert.strictEqual(json.code, UploadErrorCode.VALIDATION_ERROR);
    }
  });
});
