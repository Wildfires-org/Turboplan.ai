import assert from "node:assert";
import { afterEach, describe, it } from "node:test";

import {
  getDbEnv,
  getDbProvider,
  resetEnvCache,
} from "@wildfires-org/turboplan-env";

const KEYS = ["DB_PROVIDER", "POSTGRES_URL", "TEST_POSTGRES_URL"] as const;
const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

const setEnv = (values: Partial<Record<(typeof KEYS)[number], string>>) => {
  for (const key of KEYS) {
    if (values[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = values[key];
    }
  }
  resetEnvCache();
};

describe("DB_PROVIDER", () => {
  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
    resetEnvCache();
  });

  it("defaults to postgres, which still requires a database URL", () => {
    setEnv({});
    assert.strictEqual(getDbProvider(), "postgres");
    assert.throws(() => getDbEnv(), /Missing database URL/);

    setEnv({ DB_PROVIDER: "postgres", POSTGRES_URL: "postgresql://x/y" });
    assert.deepStrictEqual(getDbEnv(), {
      DB_PROVIDER: "postgres",
      POSTGRES_URL: "postgresql://x/y",
      TEST_POSTGRES_URL: undefined,
    });
  });

  it("needs no POSTGRES_URL on d1", () => {
    setEnv({ DB_PROVIDER: " D1 " });
    assert.strictEqual(getDbProvider(), "d1");
    assert.deepStrictEqual(getDbEnv(), {
      DB_PROVIDER: "d1",
      POSTGRES_URL: "",
      TEST_POSTGRES_URL: undefined,
    });
  });

  it("rejects any other value", () => {
    setEnv({ DB_PROVIDER: "sqlite", POSTGRES_URL: "postgresql://x/y" });
    assert.throws(() => getDbProvider(), /Invalid `DB_PROVIDER`/);
  });
});
