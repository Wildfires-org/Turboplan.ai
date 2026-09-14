import { Documenso } from "@documenso/sdk-typescript";
import { DocumensoError } from "@documenso/sdk-typescript/models/errors";

import { getApiEnv } from "@wildfires-org/turboplan-env";

import type { DocumensoConfig } from "./config-resolver";

const getPdfPageCount = (pdf: Uint8Array): number => {
  const text = new TextDecoder("latin1").decode(pdf);
  const matches = text.match(/\/Type\s*\/Page(?!s)/g);
  return matches ? matches.length : 1;
};

type EnvelopeRecipientInput = {
  email: string;
  name: string;
  role: "signer" | "cc";
  // 1-based signing step. Only used in sequential mode (drives Documenso's
  // server-side gate); ignored in parallel.
  order: number;
};

type CreateEnvelopeResult = {
  envelopeId: string;
  recipients: Array<{
    id: number;
    email: string;
    name: string;
    signingUrl: string;
  }>;
};

type EnvelopeStatus = {
  status: "DRAFT" | "PENDING" | "COMPLETED" | "REJECTED";
  recipients: Array<{
    id: number;
    email: string;
    name: string;
    signingStatus: "NOT_SIGNED" | "SIGNED" | "REJECTED";
    signedAt: string | null;
    rejectionReason: string | null;
  }>;
  completedAt: string | null;
  envelopeItemIds: string[];
};

const getClient = (config?: DocumensoConfig | null) => {
  if (config) {
    return new Documenso({
      apiKey: config.apiKey,
      serverURL: config.apiUrl,
      timeoutMs: 30000,
    });
  }
  const env = getApiEnv();
  return new Documenso({
    apiKey: env.DOCUMENSO_API_KEY,
    serverURL: env.DOCUMENSO_API_URL,
    timeoutMs: 30000,
  });
};

export const createEnvelope = async (
  pdf: Uint8Array,
  title: string,
  recipients: EnvelopeRecipientInput[],
  externalId?: string,
  options?: {
    signingMode?: "parallel" | "sequential";
    config?: DocumensoConfig | null;
  },
): Promise<CreateEnvelopeResult> => {
  const client = getClient(options?.config);
  const signingMode = options?.signingMode ?? "parallel";
  const isSequential = signingMode === "sequential";
  const lastPage = getPdfPageCount(pdf);

  // distributionMethod is always NONE: this app sends its own invite emails
  // (progressively in sequential mode), so Documenso must not email anyone.
  // We still call distribute() below to mint per-recipient signing tokens.
  //
  // Field vertical offset is indexed by signer position — CC recipients carry no
  // fields, so signature/date boxes never overlap or leave gaps.
  let signerCount = 0;
  const recipientPayloads = recipients.map((r) => {
    const isSigner = r.role === "signer";
    const fieldRow = isSigner ? signerCount++ : 0;
    return {
      email: r.email,
      name: r.name,
      role: isSigner ? ("SIGNER" as const) : ("CC" as const),
      ...(isSequential ? { signingOrder: r.order } : {}),
      fields: isSigner
        ? [
            {
              type: "SIGNATURE" as const,
              page: lastPage,
              positionX: 10,
              positionY: 75 + fieldRow * 8,
              width: 25,
              height: 5,
            },
            {
              type: "DATE" as const,
              page: lastPage,
              positionX: 60,
              positionY: 75 + fieldRow * 8,
              width: 20,
              height: 3,
            },
          ]
        : [],
    };
  });

  const envelope = await client.envelopes.create({
    payload: {
      title,
      type: "DOCUMENT",
      externalId,
      recipients: recipientPayloads,
      meta: {
        distributionMethod: "NONE" as "EMAIL",
        signingOrder: isSequential ? "SEQUENTIAL" : "PARALLEL",
        typedSignatureEnabled: true,
        drawSignatureEnabled: true,
      },
    },
    files: [
      {
        fileName: `${title}.pdf`,
        content: pdf,
      },
    ],
  });

  const distributed = await client.envelopes.distribute({
    envelopeId: envelope.id,
  });

  return {
    envelopeId: envelope.id,
    recipients: distributed.recipients.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      signingUrl: r.signingUrl,
    })),
  };
};

export const cancelEnvelope = async (
  envelopeId: string,
  config?: DocumensoConfig | null,
): Promise<void> => {
  const client = getClient(config);
  await client.envelopes.delete({ envelopeId });
};

export const extractSigningToken = (signingUrl: string): string => {
  const url = new URL(signingUrl);
  const segments = url.pathname.split("/").filter(Boolean);
  return segments[segments.length - 1];
};

// The embed host is the Documenso web origin, derived by stripping the `/api/...`
// suffix off the configured API URL. Used by the in-session signing modal.
export const getDocumensoHost = (config?: DocumensoConfig | null): string => {
  const apiUrl = config?.apiUrl ?? getApiEnv().DOCUMENSO_API_URL;
  return apiUrl.replace(/\/api\/.*$/, "");
};

export const getEnvelopeStatus = async (
  envelopeId: string,
  config?: DocumensoConfig | null,
): Promise<EnvelopeStatus> => {
  const client = getClient(config);

  const envelope = await client.envelopes.get({ envelopeId });

  return {
    status: envelope.status,
    recipients: envelope.recipients.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      signingStatus: r.signingStatus,
      signedAt: r.signedAt,
      rejectionReason: r.rejectionReason,
    })),
    completedAt: envelope.completedAt,
    envelopeItemIds: envelope.envelopeItems.map((item) => item.id),
  };
};

const getCredentials = (config?: DocumensoConfig | null) => {
  if (config) {
    return { apiUrl: config.apiUrl, apiKey: config.apiKey };
  }
  const env = getApiEnv();
  return { apiUrl: env.DOCUMENSO_API_URL, apiKey: env.DOCUMENSO_API_KEY };
};

export const downloadSignedDocument = async (
  envelopeId: string,
  config?: DocumensoConfig | null,
): Promise<ArrayBuffer> => {
  const client = getClient(config);

  const envelope = await client.envelopes.get({ envelopeId });
  const itemId = envelope.envelopeItems[0]?.id;
  if (!itemId) {
    throw new Error("No envelope items found");
  }

  // The SDK's items.download expects a JSON 200 response, but this Documenso
  // server returns the raw PDF (application/pdf), which makes the SDK throw
  // "Unexpected Status or Content-Type". Fetch the binary directly instead.
  const { apiUrl, apiKey } = getCredentials(config);
  const response = await fetch(
    `${apiUrl}/envelope/item/${itemId}/download?version=signed`,
    { headers: { Authorization: apiKey } },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to download signed document: ${response.status} ${response.statusText}`,
    );
  }

  return response.arrayBuffer();
};

export { DocumensoError };
