import { describe, expect, it, vi } from "vitest";

import {
  createLetterheadLogoStore,
  createR2LogoStore,
  letterheadLogoKey,
  MAX_LOGO_BYTES,
  type PutLogoObject,
  type S3Sdk,
} from "../../../../src/documents/letterhead/logo-storage";
import type { Logger } from "../../../../src/infra/logger";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const CONTEXT = { source: "project", documentId: "doc-1", index: 0 };

const recordingLogger = () => {
  const lines: string[] = [];
  const logger: Logger = {
    log: (message) => {
      lines.push(message);
    },
    error: (message) => {
      lines.push(message);
    },
  };
  return { logger, lines };
};

describe("letterheadLogoKey", () => {
  it("names the logo by its source, document, position and content", () => {
    const key = letterheadLogoKey(PNG, CONTEXT);

    expect(key).toMatch(
      /^letterheads\/project\/doc-1\/logo-0-[0-9a-f]{16}\.png$/,
    );
    // Same bytes, same key; other bytes, another key.
    expect(letterheadLogoKey(PNG, CONTEXT)).toBe(key);
    expect(letterheadLogoKey(new Uint8Array([9]), CONTEXT)).not.toBe(key);
  });
});

describe("createLetterheadLogoStore", () => {
  it("uploads the PNG as an immutable object and resolves its key, not a URL", async () => {
    const puts: Parameters<PutLogoObject>[0][] = [];
    const store = createLetterheadLogoStore({
      put: async (object) => {
        puts.push(object);
      },
    });

    const stored = await store(PNG, CONTEXT);

    const key = letterheadLogoKey(PNG, CONTEXT);
    // What the grid stores: the bare object key the API reads with its
    // credentials, never a public URL.
    expect(stored).toBe(key);
    expect(stored).toMatch(/^letterheads\//);
    expect(puts).toEqual([
      {
        key,
        body: PNG,
        contentType: "image/png",
        cacheControl: "public, max-age=31536000, immutable",
      },
    ]);
  });

  it("refuses a crop over the size limit without uploading it", async () => {
    let uploads = 0;
    const { logger, lines } = recordingLogger();
    const store = createLetterheadLogoStore({
      put: async () => {
        uploads += 1;
      },
      logger,
    });

    const url = await store(new Uint8Array(MAX_LOGO_BYTES + 1), CONTEXT);

    expect(url).toBeNull();
    expect(uploads).toBe(0);
    expect(lines).toEqual([
      "[letterhead] project document doc-1, logo 0: not stored, 300 KB is over the 300 KB limit",
    ]);
  });

  it("logs a failed upload and resolves null instead of throwing", async () => {
    const { logger, lines } = recordingLogger();
    const store = createLetterheadLogoStore({
      put: async () => {
        throw new Error("AccessDenied");
      },
      logger,
    });

    await expect(store(PNG, CONTEXT)).resolves.toBeNull();
    expect(lines).toEqual([
      "[letterhead] project document doc-1, logo 0: upload failed",
    ]);
  });
});

describe("createR2LogoStore", () => {
  it("is undefined without R2 credentials", () => {
    expect(createR2LogoStore(null)).toBeUndefined();
  });

  const R2 = {
    R2_ACCESS_KEY_ID: "key",
    R2_SECRET_ACCESS_KEY: "secret",
    R2_BUCKET_NAME: "bucket",
    R2_ACCOUNT_ID: "account",
  };

  // A stand-in for the SDK module: records the client's configuration, the
  // commands sent and their options.
  const fakeSdk = () => {
    const configs: unknown[] = [];
    const sent: { input: unknown; options: unknown }[] = [];
    class PutObjectCommand {
      constructor(readonly input: unknown) {}
    }
    class S3Client {
      constructor(config: unknown) {
        configs.push(config);
      }
      async send(command: PutObjectCommand, options: unknown) {
        sent.push({ input: command.input, options });
        return {};
      }
    }
    const sdk = { PutObjectCommand, S3Client } as unknown as S3Sdk;
    return { sdk, configs, sent };
  };

  it("uploads with a client configured like the shared storage client", async () => {
    const { sdk, configs, sent } = fakeSdk();
    const store = createR2LogoStore(R2, { loadSdk: async () => sdk });

    const key = await store?.(PNG, CONTEXT);

    expect(key).toBe(letterheadLogoKey(PNG, CONTEXT));
    expect(configs).toEqual([
      {
        endpoint: "https://account.r2.cloudflarestorage.com",
        region: "auto",
        credentials: { accessKeyId: "key", secretAccessKey: "secret" },
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
      },
    ]);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.input).toEqual({
      Bucket: "bucket",
      Key: key,
      Body: PNG,
      ContentType: "image/png",
      CacheControl: "public, max-age=31536000, immutable",
    });
    expect(
      (sent[0]?.options as { abortSignal?: unknown }).abortSignal,
    ).toBeInstanceOf(AbortSignal);
  });

  it("loads the SDK once for every upload", async () => {
    const { sdk, configs } = fakeSdk();
    const loadSdk = vi.fn(async () => sdk);
    const store = createR2LogoStore(R2, { loadSdk });

    await store?.(PNG, CONTEXT);
    await store?.(PNG, { ...CONTEXT, index: 1 });

    expect(loadSdk).toHaveBeenCalledTimes(1);
    expect(configs).toHaveLength(1);
  });

  it("loads the SDK again after a load that failed", async () => {
    const { sdk, sent } = fakeSdk();
    const loadSdk = vi
      .fn<() => Promise<S3Sdk>>()
      .mockRejectedValueOnce(new Error("Cannot find module"))
      .mockResolvedValue(sdk);
    const store = createR2LogoStore(R2, { loadSdk });

    // The failed load drops this logo (logged), like a failed upload.
    await expect(store?.(PNG, CONTEXT)).resolves.toBeNull();
    await expect(store?.(PNG, CONTEXT)).resolves.toBe(
      letterheadLogoKey(PNG, CONTEXT),
    );
    expect(loadSdk).toHaveBeenCalledTimes(2);
    expect(sent).toHaveLength(1);
  });

  it("creates a store from the credentials alone, without connecting yet", () => {
    const store = createR2LogoStore({
      R2_ACCESS_KEY_ID: "key",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_BUCKET_NAME: "bucket",
      R2_ACCOUNT_ID: "account",
    });
    expect(typeof store).toBe("function");
  });
});
