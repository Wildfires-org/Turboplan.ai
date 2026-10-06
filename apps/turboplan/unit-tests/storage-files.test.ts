import assert from "node:assert";
import { before, describe, it } from "node:test";
import type { UIMessage } from "ai";

import { resetEnvCache } from "@wildfires-org/turboplan-env";

import type * as StorageFilesModule from "../lib/ai/storage-files";

const STORAGE = "https://files.example.test";
const OWN_PDF = `${STORAGE}/uploads/user-1/1730000000000-plan.pdf`;
const EXTERNAL_PDF = "https://attacker.example/x.pdf";

let storageFiles: typeof StorageFilesModule;

// The real isStorageUrl resolves URLs against R2_PUBLIC_URL.
before(async () => {
  process.env.R2_ACCESS_KEY_ID = "test-key";
  process.env.R2_SECRET_ACCESS_KEY = "test-secret";
  process.env.R2_BUCKET_NAME = "test-bucket";
  process.env.R2_ACCOUNT_ID = "test-account";
  process.env.R2_PUBLIC_URL = STORAGE;
  resetEnvCache();
  storageFiles = await import("../lib/ai/storage-files");
});

const filePart = (url: string) => ({
  type: "file" as const,
  url,
  mediaType: "application/pdf",
  filename: "plan.pdf",
});

const userMessage = (
  parts: UIMessage["parts"],
  extra: Partial<StorageFilesModule.ChatMessageWithAttachments> = {},
): StorageFilesModule.ChatMessageWithAttachments => ({
  id: "m1",
  role: "user",
  parts,
  ...extra,
});

describe("withoutExternalFiles", () => {
  it("keeps text and files that live in our storage", () => {
    const message = userMessage([
      filePart(OWN_PDF),
      { type: "text", text: "Summarize this" },
    ]);

    assert.deepStrictEqual(
      storageFiles.withoutExternalFiles(message).parts,
      message.parts,
    );
  });

  it("drops file parts that point outside our storage", () => {
    const message = userMessage([
      filePart(EXTERNAL_PDF),
      filePart(OWN_PDF),
      { type: "text", text: "hi" },
    ]);

    assert.deepStrictEqual(storageFiles.withoutExternalFiles(message).parts, [
      filePart(OWN_PDF),
      { type: "text", text: "hi" },
    ]);
  });

  it("drops lookalike hosts and non-http URLs", () => {
    const message = userMessage([
      filePart("https://files.example.test.evil.example/uploads/a.pdf"),
      filePart("data:application/pdf;base64,AAAA"),
      { type: "text", text: "hi" },
    ]);

    assert.deepStrictEqual(storageFiles.withoutExternalFiles(message).parts, [
      { type: "text", text: "hi" },
    ]);
  });

  it("filters legacy experimental_attachments the same way", () => {
    const message = userMessage([{ type: "text", text: "hi" }], {
      experimental_attachments: [
        { url: EXTERNAL_PDF, contentType: "application/pdf" },
        { url: OWN_PDF, contentType: "application/pdf" },
      ],
    });

    assert.deepStrictEqual(
      storageFiles.withoutExternalFiles(message).experimental_attachments,
      [{ url: OWN_PDF, contentType: "application/pdf" }],
    );
  });

  it("leaves a message without files or attachments unchanged", () => {
    const message = userMessage([{ type: "text", text: "hi" }]);

    assert.deepStrictEqual(storageFiles.withoutExternalFiles(message), message);
  });
});
