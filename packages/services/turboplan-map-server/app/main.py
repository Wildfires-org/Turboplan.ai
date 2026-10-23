import os
import re

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import health, upload

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Error monitoring — the SDK's ASGI integration auto-captures all unhandled
# exceptions once initialized. No-ops when SENTRY_DSN is unset.
SENTRY_DSN = os.getenv("SENTRY_DSN")

_SENSITIVE_HEADERS = {"authorization", "cookie", "set-cookie", "x-api-key"}

# Upload endpoints ingest GIS files from caller-supplied URLs — presigned URLs
# carry signatures/keys in query params (e.g. X-Amz-Signature), so match the
# sensitive word anywhere in the param name, like the JS scrubbers.
# The name is tested separately from the `name=` scan to keep matching linear.
_PARAM_NAME_RE = re.compile(r"(?:^|[?&#\s])([^?&#=\s]*)=")
_PARAM_VALUE_RE = re.compile(r"[^&#\s]*")
_SENSITIVE_NAME_RE = re.compile(r"token|code|key|secret|signature|email", re.IGNORECASE)


def _redact_sensitive_url(url):
    parts = []
    copied_up_to = 0
    # A non-sensitive value is still scanned, so a nested `?token=` is caught;
    # pairs inside an already-redacted value are skipped.
    for match in _PARAM_NAME_RE.finditer(url):
        is_nested = match.start() < copied_up_to
        if is_nested or not _SENSITIVE_NAME_RE.search(match.group(1)):
            continue
        parts.append(url[copied_up_to : match.end()])
        parts.append("[redacted]")
        copied_up_to = _PARAM_VALUE_RE.match(url, match.end()).end()
    parts.append(url[copied_up_to:])
    return "".join(parts)


def _scrub_sentry_event(event, _hint):
    """PII scrub: strip auth headers, redact sensitive query params."""
    request = event.get("request")
    if request:
        headers = request.get("headers")
        if headers:
            for header in list(headers):
                if header.lower() in _SENSITIVE_HEADERS:
                    del headers[header]
        request.pop("cookies", None)
        # Request bodies can carry tokens — never send them.
        request.pop("data", None)
        if isinstance(request.get("url"), str):
            request["url"] = _redact_sensitive_url(request["url"])
        if isinstance(request.get("query_string"), str):
            request["query_string"] = _redact_sensitive_url(request["query_string"])
    for crumb in event.get("breadcrumbs", {}).get("values", []):
        data = crumb.get("data")
        if not data:
            continue
        for field in ("url", "http.query", "http.fragment"):
            if isinstance(data.get(field), str):
                data[field] = _redact_sensitive_url(data[field])
    # Exception messages can embed full URLs (e.g. requests' raise_for_status).
    for exc in event.get("exception", {}).get("values", []):
        if isinstance(exc.get("value"), str):
            exc["value"] = _redact_sensitive_url(exc["value"])
    logentry = event.get("logentry")
    if logentry and isinstance(logentry.get("message"), str):
        logentry["message"] = _redact_sensitive_url(logentry["message"])
    return event


if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=os.getenv("ENVIRONMENT", "production"),
        release=os.getenv("RELEASE_VERSION") or None,
        traces_sample_rate=0,
        send_default_pii=False,
        before_send=_scrub_sentry_event,
    )
    sentry_sdk.set_tag("service", "map-server")

app = FastAPI(
    title="GIS File Processor API",
    description="API for processing GIS files from URLs",
    version="2.0.0"
)

# CORS setup - support both comma and pipe as delimiters
ALLOWED_ORIGINS = re.split(r'[,|]', os.getenv("ALLOWED_ORIGINS", ""))
ALLOWED_ORIGINS = [origin.strip() for origin in ALLOWED_ORIGINS if origin.strip()]
IS_ALLOW_ALL_ORIGINS = len(ALLOWED_ORIGINS) == 1 and ALLOWED_ORIGINS[0] == "*"

if ALLOWED_ORIGINS and not IS_ALLOW_ALL_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )
else:
    # Allow all origins if none specified
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,  # Must be False when using wildcard origins
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

# Register routers
app.include_router(health.router, prefix="/api")
app.include_router(upload.router, prefix="/api")
