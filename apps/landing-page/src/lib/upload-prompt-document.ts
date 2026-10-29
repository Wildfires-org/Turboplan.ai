interface PresignResponse {
  uploadUrl: string;
  key: string;
}

interface PresignErrorBody {
  error?: string;
  code?: string;
}

interface UploadPromptDocumentArgs {
  serverUrl: string;
  file: File;
  /** Allowed upload type for the file; sent to presign and on the PUT. */
  contentType: string;
  signal?: AbortSignal;
}

export const RATE_LIMITED_MESSAGE =
  "Too many uploads right now. Try again in a minute.";
export const UPLOAD_FAILED_MESSAGE = "Something went wrong, please try again.";

// Only a 400 (file type or size refused) carries a message meant for the
// visitor; anything else gets a generic one.
const readPresignError = async (response: Response): Promise<string> => {
  if (response.status === 429) {
    return RATE_LIMITED_MESSAGE;
  }
  if (response.status !== 400) {
    return UPLOAD_FAILED_MESSAGE;
  }
  const body: PresignErrorBody = await response.json().catch(() => ({}));
  return body.error || UPLOAD_FAILED_MESSAGE;
};

// A network failure (offline, CORS) rejects with a technical message like
// "Failed to fetch"; show the generic one instead. Aborts pass through.
const request = async (url: string, init: RequestInit) => {
  try {
    return await fetch(url, init);
  } catch (error) {
    if (init.signal?.aborted) {
      throw error;
    }
    throw new Error(UPLOAD_FAILED_MESSAGE);
  }
};

/**
 * Uploads a document attached to the landing-page prompt without an account:
 * presigns an anonymous upload, then PUTs the file straight to storage.
 * Returns the storage key the app turns into a project document after signup.
 *
 * The PUT's Content-Type must equal the presigned one, so it is set
 * explicitly rather than taken from the browser's (often empty) `file.type`.
 */
export const uploadPromptDocument = async ({
  serverUrl,
  file,
  contentType,
  signal,
}: UploadPromptDocumentArgs): Promise<string> => {
  const presignResponse = await request(
    `${serverUrl}/api/public/uploads/presign`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        contentType,
        fileSize: file.size,
      }),
      signal,
    },
  );

  if (!presignResponse.ok) {
    throw new Error(await readPresignError(presignResponse));
  }

  const { uploadUrl, key }: PresignResponse = await presignResponse.json();

  const uploadResponse = await request(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
    signal,
  });

  if (!uploadResponse.ok) {
    throw new Error(UPLOAD_FAILED_MESSAGE);
  }

  return key;
};
