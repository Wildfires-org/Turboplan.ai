import {
  RATE_LIMITED_MESSAGE,
  UPLOAD_FAILED_MESSAGE,
  uploadPromptDocument,
} from "./upload-prompt-document";

const SERVER_URL = "https://api.example.test";
const DOCX_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Jest's node environment has no fetch globals (Response, File), so the
// helper gets minimal stand-ins for what it reads.
const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

const emptyResponse = (status: number) => jsonResponse(status, null);

describe("uploadPromptDocument", () => {
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  // Browsers often report Word files with an empty type.
  const file = { name: "scope.docx", size: 5, type: "" } as File;

  it("presigns, then PUTs the file with the presigned content type", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, {
          uploadUrl: "https://storage.example.test/put",
          key: "landing/abc/scope.docx",
        }),
      )
      .mockResolvedValueOnce(emptyResponse(200));

    const key = await uploadPromptDocument({
      serverUrl: SERVER_URL,
      file,
      contentType: DOCX_TYPE,
    });

    expect(key).toBe("landing/abc/scope.docx");

    const [presignUrl, presignInit] = fetchMock.mock.calls[0];
    expect(presignUrl).toBe(`${SERVER_URL}/api/public/uploads/presign`);
    expect(presignInit.method).toBe("POST");
    expect(JSON.parse(presignInit.body)).toEqual({
      filename: "scope.docx",
      contentType: DOCX_TYPE,
      fileSize: file.size,
    });

    const [putUrl, putInit] = fetchMock.mock.calls[1];
    expect(putUrl).toBe("https://storage.example.test/put");
    expect(putInit.method).toBe("PUT");
    expect(putInit.headers).toEqual({ "Content-Type": DOCX_TYPE });
    expect(putInit.body).toBe(file);
  });

  it("surfaces the server's message for a rejected file", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { error: "File too large", code: "FILE_TOO_LARGE" }),
    );

    await expect(
      uploadPromptDocument({
        serverUrl: SERVER_URL,
        file,
        contentType: DOCX_TYPE,
      }),
    ).rejects.toThrow("File too large");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps other server errors generic", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(500, { error: "R2 credentials missing" }),
    );

    await expect(
      uploadPromptDocument({
        serverUrl: SERVER_URL,
        file,
        contentType: DOCX_TYPE,
      }),
    ).rejects.toThrow(UPLOAD_FAILED_MESSAGE);
  });

  it("hides network error details", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(
      uploadPromptDocument({
        serverUrl: SERVER_URL,
        file,
        contentType: DOCX_TYPE,
      }),
    ).rejects.toThrow(UPLOAD_FAILED_MESSAGE);
  });

  it("explains a rate limit", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(429, {}));

    await expect(
      uploadPromptDocument({
        serverUrl: SERVER_URL,
        file,
        contentType: DOCX_TYPE,
      }),
    ).rejects.toThrow(RATE_LIMITED_MESSAGE);
  });

  it("fails when storage refuses the PUT", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, {
          uploadUrl: "https://storage.example.test/put",
          key: "landing/abc/scope.docx",
        }),
      )
      .mockResolvedValueOnce(emptyResponse(403));

    await expect(
      uploadPromptDocument({
        serverUrl: SERVER_URL,
        file,
        contentType: DOCX_TYPE,
      }),
    ).rejects.toThrow(UPLOAD_FAILED_MESSAGE);
  });
});
