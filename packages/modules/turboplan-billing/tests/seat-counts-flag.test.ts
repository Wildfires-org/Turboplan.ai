import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

// The seat counts behind Stripe billing and the credit grant, under each
// enforcement setting. Feature flags are read once at module load, so every
// probe runs in a fresh child process. The DB is unreachable on purpose: a
// returned value proves no query ran, and a rejection proves the call went to
// the membership query.

const FLAG_VARS = [
  "IS_BILLING_PACKAGE_ENABLED",
  "NEXT_PUBLIC_IS_BILLING_PACKAGE_ENABLED",
  "IS_BILLING_ENFORCEMENT_ENABLED",
  "NEXT_PUBLIC_IS_BILLING_ENFORCEMENT_ENABLED",
];

const ENFORCEMENT_ON = { IS_BILLING_PACKAGE_ENABLED: "true" };
const ENFORCEMENT_OFF = {
  IS_BILLING_PACKAGE_ENABLED: "true",
  IS_BILLING_ENFORCEMENT_ENABLED: "false",
};

const ORG_ID = "00000000-0000-0000-0000-000000000000";
const queriesUrl = new URL("../src/server/queries.ts", import.meta.url).href;
const packageDir = fileURLToPath(new URL("..", import.meta.url));

type ProbeResult = { value: number } | { rejected: true };

/** Evaluates `expression` (with the queries module bound to `q`) in a child. */
const probe = (
  flags: Record<string, string>,
  expression: string,
): ProbeResult => {
  const script = `
    const q = await import(${JSON.stringify(queriesUrl)});
    let result;
    try {
      result = { value: await (${expression}) };
    } catch {
      result = { rejected: true };
    }
    console.log(JSON.stringify(result));
    process.exit(0);
  `;

  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const name of FLAG_VARS) {
    delete env[name];
  }
  Object.assign(env, flags, {
    POSTGRES_URL: "postgres://user:pass@127.0.0.1:1/unreachable",
  });

  const child = spawnSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", script],
    { env, encoding: "utf8", cwd: packageDir },
  );

  assert.equal(child.status, 0, child.stderr);
  const lastLine = child.stdout.trim().split("\n").at(-1) ?? "";
  return JSON.parse(lastLine) as ProbeResult;
};

const creditSeats = (flags: Record<string, string>, row: object | undefined) =>
  probe(
    flags,
    `q.resolveCreditSeatCount(${row ? JSON.stringify(row) : "undefined"})`,
  );

const liveProSub = {
  organizationId: ORG_ID,
  seats: 5,
  stripeSubscriptionId: "sub_123",
  status: "active",
};

describe("countChargeableSeats", () => {
  it("counts real members when enforcement is on", () => {
    assert.deepEqual(
      probe(ENFORCEMENT_ON, `q.countChargeableSeats("${ORG_ID}")`),
      { rejected: true },
    );
  });

  it("is 0 without a query when enforcement is off", () => {
    assert.deepEqual(
      probe(ENFORCEMENT_OFF, `q.countChargeableSeats("${ORG_ID}")`),
      { value: 0 },
    );
  });
});

describe("resolveCreditSeatCount", () => {
  it("uses the seats mirror when enforcement is on", () => {
    assert.deepEqual(creditSeats(ENFORCEMENT_ON, liveProSub), { value: 5 });
  });

  it("counts real members for a live Stripe subscription when enforcement is off", () => {
    assert.deepEqual(creditSeats(ENFORCEMENT_OFF, liveProSub), {
      rejected: true,
    });
    assert.deepEqual(
      creditSeats(ENFORCEMENT_OFF, { ...liveProSub, status: "past_due" }),
      { rejected: true },
    );
  });

  it("keeps the mirror for rows that are never seat-synced when enforcement is off", () => {
    const starter = {
      organizationId: ORG_ID,
      seats: 7,
      stripeSubscriptionId: null,
      status: "active",
    };
    assert.deepEqual(creditSeats(ENFORCEMENT_OFF, starter), { value: 7 });
    assert.deepEqual(
      creditSeats(ENFORCEMENT_OFF, { ...liveProSub, status: "canceled" }),
      { value: 5 },
    );
  });

  it("is 0 when the org has no subscription row", () => {
    assert.deepEqual(creditSeats(ENFORCEMENT_OFF, undefined), { value: 0 });
  });
});
