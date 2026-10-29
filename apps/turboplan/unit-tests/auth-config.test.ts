import assert from "node:assert";
import { describe, it } from "node:test";

import { authConfig, isOnRoute } from "../app/(auth)/auth.config";

type AuthorizedParams = Parameters<typeof authConfig.callbacks.authorized>[0];

const APP_ORIGIN = "http://localhost:3000";

/** Runs the middleware `authorized` callback for a URL path. */
const authorize = (pathAndQuery: string, isLoggedIn: boolean) => {
  const nextUrl = new URL(pathAndQuery, APP_ORIGIN);
  const auth = isLoggedIn
    ? { user: { id: "user-1" }, expires: "2099-01-01T00:00:00.000Z" }
    : null;
  return authConfig.callbacks.authorized({
    auth,
    request: { nextUrl },
  } as unknown as AuthorizedParams);
};

const assertRedirectsHome = (result: ReturnType<typeof authorize>) => {
  assert.ok(result instanceof Response, "expected a redirect Response");
  assert.strictEqual(result.headers.get("location"), `${APP_ORIGIN}/`);
};

describe("isOnRoute", () => {
  it("matches the route itself", () => {
    assert.strictEqual(isOnRoute("/login", "/login"), true);
  });

  it("matches nested paths under the route", () => {
    assert.strictEqual(isOnRoute("/login/x", "/login"), true);
    assert.strictEqual(isOnRoute("/setup/personal", "/setup"), true);
  });

  it("does not match a sibling that shares the prefix", () => {
    assert.strictEqual(isOnRoute("/login-co", "/login"), false);
    assert.strictEqual(isOnRoute("/registered-agents", "/register"), false);
    assert.strictEqual(isOnRoute("/verifyco", "/verify"), false);
    assert.strictEqual(isOnRoute("/ingestion-team", "/ingest"), false);
  });

  it("does not match a slug-prefixed dashboard path", () => {
    assert.strictEqual(
      isOnRoute("/registered-agents/office", "/register"),
      false,
    );
  });

  it("only matches at the start of the path", () => {
    assert.strictEqual(isOnRoute("/usfs/login", "/login"), false);
    assert.strictEqual(isOnRoute("/", "/login"), false);
  });
});

describe("authConfig.callbacks.authorized", () => {
  describe("logged in", () => {
    it("allows an org whose slug starts with a public route name", () => {
      assert.strictEqual(authorize("/registered-agents/office", true), true);
      assert.strictEqual(authorize("/login-team", true), true);
      assert.strictEqual(authorize("/check-emails-co", true), true);
    });

    it("allows dashboard pages", () => {
      assert.strictEqual(
        authorize("/usfs/my-projects/jackson-creek/tasks", true),
        true,
      );
    });

    it("sends the user home from logged-out-only routes", () => {
      assertRedirectsHome(authorize("/login", true));
      assertRedirectsHome(authorize("/register", true));
      assertRedirectsHome(authorize("/check-email", true));
      assertRedirectsHome(authorize("/login/x", true));
    });

    it("lets /verify handle the sign-in itself", () => {
      assert.strictEqual(authorize("/verify?token=abc", true), true);
    });
  });

  describe("logged out", () => {
    it("allows public routes and their nested paths", () => {
      assert.strictEqual(authorize("/login", false), true);
      assert.strictEqual(authorize("/register", false), true);
      assert.strictEqual(authorize("/self-service/start", false), true);
      assert.strictEqual(authorize("/check-email", false), true);
      assert.strictEqual(authorize("/logout", false), true);
    });

    it("matches on the pathname only, ignoring the query string", () => {
      assert.strictEqual(authorize("/verify?token=abc", false), true);
      assert.strictEqual(authorize("/usfs?next=/login", false), false);
    });

    it("requires a session for org slugs that start with a public route name", () => {
      assert.strictEqual(authorize("/verifyco", false), false);
      assert.strictEqual(authorize("/registered-agents", false), false);
      assert.strictEqual(authorize("/login-team/office", false), false);
    });

    it("requires a session for the dashboard and setup", () => {
      assert.strictEqual(authorize("/", false), false);
      assert.strictEqual(authorize("/usfs", false), false);
      assert.strictEqual(
        authorize("/usfs/my-projects/jackson-creek", false),
        false,
      );
      assert.strictEqual(authorize("/setup/personal", false), false);
    });
  });
});
