import { z } from "zod";

const recipientInputSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["signer", "cc"]).default("signer"),
});

export const createSigningRequestSchema = z.object({
  documentId: z.string().uuid(),
  projectId: z.string().uuid(),
  // Recipients other than the requester, in desired signing order (sequential).
  // May be empty for a pure self-sign (requester is the sole signer).
  recipients: z.array(recipientInputSchema).max(20).default([]),
  signingMode: z.enum(["parallel", "sequential"]).default("parallel"),
  requesterSigns: z.enum(["first", "last", "no"]).default("first"),
  title: z.string().min(1).max(500).optional(),
});

export const completeSigningSchema = z.object({
  signingRequestId: z.string().uuid(),
});

export const cancelSigningSchema = z.object({
  signingRequestId: z.string().uuid(),
});
