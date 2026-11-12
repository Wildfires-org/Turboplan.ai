import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import type * as AuthConfigModule from "../app/(auth)/auth.config";

type AuthorizedParams = Parameters<
  typeof AuthConfigModule.authConfig.callbacks.authorized
>[0];

const APP_ORIGIN = "http://localhost:3000";

// The switch is read when lib/entry-point/config.ts loads, so it is set
// before the import. Each test file runs in its own process; auth-config.test
// covers the default, where `/` sends signed-out visitors to login.
let authConfig: typeof AuthConfigModule.authConfig;

before(async () => {
  process.env.NEXT_PUBLIC_ENTRY_POINT = "prompt";
  ({ authConfig } = await import("../app/(auth)/auth.config"));
});

const authorize = (pathAndQuery: string, isLoggedIn: boolean) => {
  const auth = isLoggedIn
    ? { user: { id: "user-1" }, expires: "2099-01-01T00:00:00.000Z" }
    : null;
  return authConfig.callbacks.authorized({
    auth,
    request: { nextUrl: new URL(pathAndQuery, APP_ORIGIN) },
  } as unknown as AuthorizedParams);
};

const redirectTarget = (result: ReturnType<typeof authorize>) => {
  assert.ok(result instanceof Response, "expected a redirect Response");
  return new URL(result.headers.get("location") ?? "").pathname;
};

describe("authorized with NEXT_PUBLIC_ENTRY_POINT=prompt", () => {
  it("lets signed-out visitors see the entry page at the root", () => {
    assert.equal(authorize("/", false), true);
    assert.equal(authorize("/?projectDescription=Fuel%20break", false), true);
  });

  it("still sends signed-out visitors to login from every other page", () => {
    assert.equal(redirectTarget(authorize("/usfs", false)), "/login");
    assert.equal(redirectTarget(authorize("/setup/personal", false)), "/login");
    assert.equal(redirectTarget(authorize("/profile", false)), "/login");
  });

  it("leaves signed-in users and the signup flow as they were", () => {
    assert.equal(authorize("/", true), true);
    assert.equal(authorize("/self-service?projectTitle=X", false), true);
    assert.equal(redirectTarget(authorize("/login", true)), "/");
  });
});
