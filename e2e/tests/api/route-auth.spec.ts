import { expect, test } from "@playwright/test";

import { createToken } from "@wildfires-org/turboplan-api-client";

import { createTestUserWithMagicLink } from "../../utils/test-auth";

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3001";

/**
 * API Route Authentication Tests
 *
 * These tests verify that the route registration order in router.ts is correct:
 * 1. Public routes are accessible without authentication
 * 2. Webhook routes require API key authentication
 * 3. Private routes require Bearer token authentication
 *
 * ⚠️ IMPORTANT: Route registration order matters in Hono!
 * Middleware applies to routes registered AFTER it.
 * If these tests fail, check apps/server/src/router.ts
 */
test.describe("API Route Authentication", () => {
  test("GET /health should be accessible without auth", async ({ request }) => {
    const response = await request.get(`${SERVER_URL}/health`);

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
  });

  test("GET /api/public/* should be accessible without auth", async ({
    request,
  }) => {
    const response = await request.get(
      `${SERVER_URL}/api/public/organizations`,
    );

    // Should not return 401 - public routes don't require auth
    expect(response.status()).not.toBe(401);
  });

  test("POST /api/webhooks/* should reject without API key", async ({
    request,
  }) => {
    const response = await request.post(`${SERVER_URL}/api/webhooks/test`, {
      data: {},
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toContain("x-api-key");
  });

  test("GET /api/organizations should reject without token", async ({
    request,
  }) => {
    const response = await request.get(`${SERVER_URL}/api/organizations`);

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toContain("No token provided");
  });

  test("GET /api/organizations should accept valid token", async ({
    request,
  }) => {
    // Create a real test user in the database
    const { user } = await createTestUserWithMagicLink(
      "api-route-auth-test@example.com",
    );
    const token = await createToken({ id: user.id });

    const response = await request.get(`${SERVER_URL}/api/organizations`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status()).toBe(200);
  });

  test("public routes should not require auth", async ({ request }) => {
    const publicEndpoints = ["/health", "/api/public/organizations"];

    for (const endpoint of publicEndpoints) {
      const response = await request.get(`${SERVER_URL}${endpoint}`);
      expect(response.status(), `${endpoint} should not require auth`).not.toBe(
        401,
      );
    }
  });

  test("private routes should require auth", async ({ request }) => {
    const privateEndpoints = [
      "/api/organizations",
      "/api/offices",
      "/api/projects",
    ];

    for (const endpoint of privateEndpoints) {
      const response = await request.get(`${SERVER_URL}${endpoint}`);
      expect(response.status(), `${endpoint} should require auth`).toBe(401);
    }
  });

  test("GET /api/organizations should reject invalid token", async ({
    request,
  }) => {
    const response = await request.get(`${SERVER_URL}/api/organizations`, {
      headers: { Authorization: "Bearer invalid-token-here" },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toContain("Invalid token");
  });

  test("POST /api/webhooks/* should reject Bearer token (requires API key)", async ({
    request,
  }) => {
    // Even with a valid Bearer token, webhooks require API key
    const { user } = await createTestUserWithMagicLink(
      "api-route-auth-webhook-test@example.com",
    );
    const token = await createToken({ id: user.id });

    const response = await request.post(`${SERVER_URL}/api/webhooks/test`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {},
    });

    // Should still be 401 - API key middleware runs before auth middleware
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toContain("x-api-key");
  });

  test("GET /api/auth/token should return 'No session cookie' (not 'No token')", async ({
    request,
  }) => {
    // This endpoint is public but requires session cookie
    // If it returned "No token provided", it would mean it's behind auth middleware
    const response = await request.get(`${SERVER_URL}/api/auth/token`);

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("No session cookie");
  });
});
