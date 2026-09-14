export type SigningRequestStatus =
  | "draft"
  | "pending"
  | "completed"
  | "rejected"
  | "cancelled";

export type SigningMode = "parallel" | "sequential";

export type SigningRecipientRole = "signer" | "cc";

// Three orthogonal status axes (see signing-request schema for rationale).
export type RecipientSendStatus = "not_sent" | "sent";
export type RecipientReadStatus = "not_opened" | "opened";
export type SigningRecipientStatus = "not_signed" | "signed" | "rejected";

export type SigningRecipient = {
  userId: string;
  email: string;
  name: string;
  role: SigningRecipientRole;
  order: number;
  sendStatus: RecipientSendStatus;
  readStatus: RecipientReadStatus;
  signingStatus: SigningRecipientStatus;
  signedAt?: string;
  viewedAt?: string;
  rejectionReason?: string;
  signingUrl?: string;
};

export type SigningRequest = {
  id: string;
  documentId: string;
  projectId: string;
  userId: string;
  envelopeId: string | null;
  status: SigningRequestStatus;
  signingMode: SigningMode;
  title: string;
  recipients: SigningRecipient[];
  signedDocumentUrl: string | null;
  createdAt: string;
  updatedAt: string;
  requester: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
};

export type SigningRequestWithProject = SigningRequest & {
  projectName: string;
  projectSlug: string;
  officeSlug: string;
  orgSlug: string;
};
