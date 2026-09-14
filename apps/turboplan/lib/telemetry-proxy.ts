// Strips credential-bearing headers before the /ingest rewrite proxies the
// request to the third-party telemetry host. Pure module — unit-tested.
const CREDENTIAL_HEADERS = ["cookie", "authorization", "x-api-key"];

export const stripTelemetryHeaders = (incoming: Headers): Headers => {
  const headers = new Headers(incoming);
  for (const header of CREDENTIAL_HEADERS) {
    headers.delete(header);
  }
  return headers;
};
