import assert from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  DEFAULT_OPENROUTER_BASE_URL,
  getOpenRouterEnv,
} from "@wildfires-org/turboplan-env";

// OPENROUTER_BASE_URL and CLOUDFLARE_AI_GATEWAY_TOKEN: unset keeps the public
// OpenRouter API; set, every OpenRouter call goes through e.g. a Cloudflare
// AI Gateway, with its authorization header.

const GATEWAY =
  "https://gateway.ai.cloudflare.com/v1/account/gateway/openrouter/v1";

const saved = { ...process.env };

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = "test-key";
  delete process.env.OPENROUTER_BASE_URL;
  delete process.env.CLOUDFLARE_AI_GATEWAY_TOKEN;
});

afterEach(() => {
  process.env = { ...saved };
});

describe("getOpenRouterEnv", () => {
  it("uses the public OpenRouter API with no extra headers by default", () => {
    const env = getOpenRouterEnv();
    assert.strictEqual(env.OPENROUTER_BASE_URL, DEFAULT_OPENROUTER_BASE_URL);
    assert.strictEqual(
      DEFAULT_OPENROUTER_BASE_URL,
      "https://openrouter.ai/api/v1",
    );
    assert.deepStrictEqual(env.OPENROUTER_EXTRA_HEADERS, {});
  });

  it("takes a gateway base URL without its trailing slash", () => {
    process.env.OPENROUTER_BASE_URL = `  ${GATEWAY}/ `;
    assert.strictEqual(getOpenRouterEnv().OPENROUTER_BASE_URL, GATEWAY);
  });

  it("allows http on a loopback host only", () => {
    process.env.OPENROUTER_BASE_URL = "http://127.0.0.1:8787/v1";
    assert.strictEqual(
      getOpenRouterEnv().OPENROUTER_BASE_URL,
      "http://127.0.0.1:8787/v1",
    );

    process.env.OPENROUTER_BASE_URL = "http://gateway.example.test/v1";
    assert.throws(() => getOpenRouterEnv(), /OPENROUTER_BASE_URL/);
  });

  it("refuses a value that is not a plain base URL", () => {
    for (const value of [
      "openrouter.ai/api/v1",
      "https://user:pass@gateway.example.test/v1",
      "https://gateway.example.test/v1?x=1",
      "https://gateway.example.test/v1#x",
      "ftp://gateway.example.test/v1",
    ]) {
      process.env.OPENROUTER_BASE_URL = value;
      assert.throws(() => getOpenRouterEnv(), /OPENROUTER_BASE_URL/, value);
    }
  });

  it("sends the AI Gateway token as cf-aig-authorization", () => {
    process.env.CLOUDFLARE_AI_GATEWAY_TOKEN = " gateway-token ";
    assert.deepStrictEqual(getOpenRouterEnv().OPENROUTER_EXTRA_HEADERS, {
      "cf-aig-authorization": "Bearer gateway-token",
    });
  });
});
