# API Security Documentation

## Overview

The API upload endpoint (`/api/upload`) is secured with API key authentication. Browser access is restricted via CORS.

## Configuration

### 1. Environment Variables

Create or update your `.env` file in the project root:

```bash
# Required: API Key for authentication
MAP_SERVICE_API_KEY=your-secret-api-key-change-this-in-production

# Required: Allowed CORS origins (comma- or pipe-separated; "*" allows all)
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### 2. Production Settings

For production, use a strong random key (e.g. `openssl rand -base64 32`) and restrict origins:

```bash
MAP_SERVICE_API_KEY=generate-a-strong-random-key-here
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

## Usage

### Authenticated Request

Include the `X-API-Key` header in your requests:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-map-service-api-key" \
  -d '{"url": "https://example.com/file.zip"}' \
  http://localhost:9000/api/upload
```

## Security Features

### API Key Authentication

- **Header**: `X-API-Key`
- **Comparison**: constant-time (`secrets.compare_digest`)
- **Status**: 401 for invalid/missing keys
- **Note**: authentication fails closed — if `MAP_SERVICE_API_KEY` is unset, all requests are rejected

Error response (401):

```json
{ "detail": "Invalid or missing API key" }
```

### CORS Origin Restrictions

Allowed origins are configured via `ALLOWED_ORIGINS` and enforced by FastAPI's CORS middleware. This restricts browser-based cross-origin access; it does not block direct server-to-server calls, which is why the API key is required.

If `ALLOWED_ORIGINS` is empty or set to `*`, all origins are allowed (credentials disabled) — not recommended for production.

## Health Check

The `/api/health` endpoint remains **unsecured** and publicly accessible for monitoring purposes.
