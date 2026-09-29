import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  describeUrlForLog,
  isSafeExternalUrl,
  safeFetch,
} from "../src/server/safe-fetch";
import { redirectTo, useMockFetch } from "./helpers/mock-fetch";

const PUBLIC = "https://93.184.216.34";
const OPTIONS = { logPrefix: "test", timeoutMs: 1_000 };

describe("isSafeExternalUrl", () => {
  it("allows public http(s) IP literals", async () => {
    assert.equal(await isSafeExternalUrl(`${PUBLIC}/doc`), true);
    assert.equal(await isSafeExternalUrl("http://93.184.216.34/doc"), true);
  });

  it("rejects non-http protocols", async () => {
    for (const url of [
      "ftp://93.184.216.34/doc.pdf",
      "file:///etc/passwd",
      "javascript:alert(1)",
      "data:application/pdf;base64,AAAA",
      "not a url",
    ]) {
      assert.equal(await isSafeExternalUrl(url), false, url);
    }
  });

  it("rejects private, loopback, link-local and metadata targets", async () => {
    for (const url of [
      "http://127.0.0.1/",
      "http://localhost:3000/",
      "http://10.0.0.5/",
      "http://172.16.0.1/",
      "http://192.168.1.1/",
      "http://169.254.169.254/latest/meta-data/",
      "http://[::1]/",
      "http://[fe80::1]/",
      "http://[::ffff:10.0.0.1]/",
      "http://metadata.google.internal/",
      "http://metadata/",
      "http://printer.local/",
      "http://0.0.0.0/",
    ]) {
      assert.equal(await isSafeExternalUrl(url), false, url);
    }
  });

  it("rejects URLs carrying credentials", async () => {
    assert.equal(await isSafeExternalUrl("https://u:p@93.184.216.34/"), false);
  });
});

describe("describeUrlForLog", () => {
  it("drops path and query so signed links do not reach logs", () => {
    assert.equal(
      describeUrlForLog("https://gov.example/a/b?token=secret"),
      "https://gov.example",
    );
    assert.equal(describeUrlForLog("nope"), "<invalid url>");
  });
});

describe("safeFetch", () => {
  const mock = useMockFetch();

  it("never fetches an unsafe URL", async () => {
    mock.respondWith(() => new Response("x"));
    assert.equal(await safeFetch("http://169.254.169.254/", OPTIONS), null);
    assert.equal(mock.calls.length, 0);
  });

  it("follows redirects manually, passing method and headers", async () => {
    mock.respondWith((call) =>
      call.url === `${PUBLIC}/start`
        ? redirectTo("/final")
        : new Response(null, { status: 200 }),
    );
    const response = await safeFetch(`${PUBLIC}/start`, {
      ...OPTIONS,
      method: "HEAD",
      headers: { Range: "bytes=0-0" },
    });
    assert.equal(response?.status, 200);
    assert.deepEqual(
      mock.calls.map((call) => [call.url, call.method, call.redirect]),
      [
        [`${PUBLIC}/start`, "HEAD", "manual"],
        [`${PUBLIC}/final`, "HEAD", "manual"],
      ],
    );
    assert.equal(mock.calls[1].headers.Range, "bytes=0-0");
    assert.ok(mock.calls.every((call) => call.hasSignal));
  });

  it("re-validates every redirect hop", async () => {
    mock.respondWith(() => redirectTo("http://169.254.169.254/latest/"));
    assert.equal(await safeFetch(`${PUBLIC}/start`, OPTIONS), null);
    assert.equal(mock.calls.length, 1);
  });

  it("blocks a redirect to a private host after a public hop", async () => {
    mock.respondWith((call) =>
      call.url === `${PUBLIC}/a`
        ? redirectTo("https://1.1.1.1/b")
        : redirectTo("http://localhost/admin"),
    );
    assert.equal(await safeFetch(`${PUBLIC}/a`, OPTIONS), null);
    assert.equal(mock.calls.length, 2);
  });

  it("stops after the redirect limit", async () => {
    mock.respondWith(() => redirectTo("/loop"));
    assert.equal(
      await safeFetch(`${PUBLIC}/loop`, { ...OPTIONS, maxRedirects: 2 }),
      null,
    );
    assert.equal(mock.calls.length, 3);
  });

  it("rejects redirects without a location", async () => {
    mock.respondWith(() => new Response(null, { status: 301 }));
    assert.equal(await safeFetch(`${PUBLIC}/a`, OPTIONS), null);
  });

  it("propagates network errors to the caller", async () => {
    mock.respondWith(() => {
      throw new TypeError("fetch failed");
    });
    await assert.rejects(safeFetch(`${PUBLIC}/a`, OPTIONS), TypeError);
  });
});
