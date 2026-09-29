import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

// Feature flags are read once at module load, so each env combination runs in
// a fresh child process. When enforcement is off the gates return before any
// DB access, so they can be called for real without a database.

const FLAG_VARS = [
  "IS_BILLING_PACKAGE_ENABLED",
  "NEXT_PUBLIC_IS_BILLING_PACKAGE_ENABLED",
  "IS_BILLING_ENFORCEMENT_ENABLED",
  "NEXT_PUBLIC_IS_BILLING_ENFORCEMENT_ENABLED",
];

const creditsUrl = new URL("../src/server/credits.ts", import.meta.url).href;
const entitlementsUrl = new URL(
  "../src/server/entitlements.ts",
  import.meta.url,
).href;
const packageDir = fileURLToPath(new URL("..", import.meta.url));

type ChildResult = {
  packageEnabled: boolean;
  enforcementEnabled: boolean;
  gates?: {
    credits: string;
    requiresUpgrade: boolean;
    seatAllowed: boolean;
  };
};

const runWithEnv = (
  flags: Record<string, string>,
  { callGates }: { callGates: boolean },
): ChildResult => {
  const script = `
    const flags = await import("@wildfires-org/turboplan-feature-flags");
    const result = {
      packageEnabled: flags.isBillingPackageEnabled(),
      enforcementEnabled: flags.isBillingEnforcementEnabled(),
    };
    if (${callGates}) {
      const { assertCreditsAvailable } = await import(${JSON.stringify(creditsUrl)});
      const { getProjectCreationEntitlement, assertSeatAvailable } = await import(${JSON.stringify(entitlementsUrl)});
      const orgId = "00000000-0000-0000-0000-000000000000";
      await assertCreditsAvailable(orgId, 1000000);
      const entitlement = await getProjectCreationEntitlement(orgId);
      const seat = await assertSeatAvailable({ organizationId: orgId, addedBillableSeats: 1000 });
      result.gates = {
        credits: "passed",
        requiresUpgrade: entitlement.requiresUpgrade,
        seatAllowed: seat.allowed,
      };
    }
    console.log(JSON.stringify(result));
    process.exit(0);
  `;

  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const name of FLAG_VARS) {
    delete env[name];
  }
  Object.assign(env, flags);

  const child = spawnSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", script],
    { env, encoding: "utf8", cwd: packageDir },
  );

  assert.equal(child.status, 0, child.stderr);
  const lastLine = child.stdout.trim().split("\n").at(-1) ?? "";
  return JSON.parse(lastLine) as ChildResult;
};

describe("billing enforcement flag", () => {
  it("enforces when the package is on and enforcement is unset", () => {
    const result = runWithEnv(
      { IS_BILLING_PACKAGE_ENABLED: "true" },
      { callGates: false },
    );
    assert.equal(result.packageEnabled, true);
    assert.equal(result.enforcementEnabled, true);
  });

  it("enforces when enforcement is set to anything but false/0", () => {
    const result = runWithEnv(
      {
        IS_BILLING_PACKAGE_ENABLED: "true",
        IS_BILLING_ENFORCEMENT_ENABLED: "yes",
      },
      { callGates: false },
    );
    assert.equal(result.enforcementEnabled, true);
  });

  for (const [name, value] of [
    ["IS_BILLING_ENFORCEMENT_ENABLED", "false"],
    ["NEXT_PUBLIC_IS_BILLING_ENFORCEMENT_ENABLED", "0"],
  ]) {
    it(`does not enforce when ${name}=${value}, package stays on`, () => {
      const result = runWithEnv(
        { IS_BILLING_PACKAGE_ENABLED: "true", [name]: value },
        { callGates: true },
      );
      assert.equal(result.packageEnabled, true);
      assert.equal(result.enforcementEnabled, false);
      assert.deepEqual(result.gates, {
        credits: "passed",
        requiresUpgrade: false,
        seatAllowed: true,
      });
    });
  }

  it("does not enforce when the billing package is off", () => {
    const result = runWithEnv({}, { callGates: true });
    assert.equal(result.packageEnabled, false);
    assert.equal(result.enforcementEnabled, false);
    assert.deepEqual(result.gates, {
      credits: "passed",
      requiresUpgrade: false,
      seatAllowed: true,
    });
  });
});
