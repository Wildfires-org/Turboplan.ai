# @wildfires-org/turboplan-upload

Direct file uploads to Cloudflare R2 storage via presigned URLs, bypassing serverless function payload limits. Supports files up to 200MB.

## How It Works

1. Client requests a presigned upload URL from the server (`POST /api/upload/presign`)
2. Client uploads the file directly to R2 with a `PUT` to the presigned URL
3. The public file URL (`R2_PUBLIC_URL`-based) is returned

## Exports

| Path | Contents |
| --- | --- |
| `.` / `/types` | `UploadOptions`, `UploadResult`, `UploadError`, `UploadErrorCode`, constants |
| `/client` | `useFileUpload()` React hook, `UploadClient` |
| `/server` | `uploadRouter`, `UploadService`, R2 helpers (`uploadFile`, `deleteFile`, `generatePresignedUploadUrl`, `isStorageUrl`) |

## Usage

### React Hook

```tsx
import { useFileUpload } from "@wildfires-org/turboplan-upload/client";

const { upload, isUploading, progress, error, result, reset } = useFileUpload({
  maxSize: 50 * 1024 * 1024, // 50MB
  allowedTypes: ["image/*", "application/pdf"],
  onSuccess: (result) => console.log(result.url),
  onError: (error) => console.error(error.message),
});

// Upload a file
await upload(file);
```

### Without React

```typescript
import { UploadClient } from "@wildfires-org/turboplan-upload/client";

const client = new UploadClient();
const result = await client.upload(file, { maxSize: 100 * 1024 * 1024 });
```

### Server-side uploads

```typescript
import { uploadFile, deleteFile } from "@wildfires-org/turboplan-upload/server";

const { url, key: storedKey } = await uploadFile(key, buffer, contentType);
await deleteFile(url);
```

## Error Handling

```typescript
import {
  UploadError,
  UploadErrorCode,
} from "@wildfires-org/turboplan-upload/types";

if (error instanceof UploadError) {
  switch (error.code) {
    case UploadErrorCode.FILE_TOO_LARGE:
    case UploadErrorCode.INVALID_FILE_TYPE:
    case UploadErrorCode.UNAUTHORIZED:
    case UploadErrorCode.NETWORK_ERROR:
    // ...
  }
}
```

## Server Setup

`uploadRouter` is already mounted at `/api/upload` in `apps/server` (`src/routes/privateRoutes.ts`) and exposes:

- `POST /presign` – Get a presigned upload URL (authenticated)
- `DELETE /` – Delete a stored file (authenticated)

Required environment variables (via `@wildfires-org/turboplan-env`):

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_URL` – Public base URL of the bucket
