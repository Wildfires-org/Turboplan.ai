import { randomBytes } from "node:crypto";
import { request as apiRequest, expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { createToken } from "@wildfires-org/turboplan-api-client";
import { createTestDB } from "@wildfires-org/turboplan-db/db-client";
import {
  chat,
  office,
  officeUsers,
  organization,
  organizationUsers,
  project,
  projectUsers,
  researchAgentChat,
  researchAgentMessage,
} from "@wildfires-org/turboplan-db/schemas";

import { TurboplanSetupPage } from "../../pages";
import { createTestUserWithMagicLink } from "../../utils/test-auth";

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3001";
const TURBOPLAN_URL = process.env.TURBOPLAN_URL || "http://localhost:3000";

const isTruthy = (value: string | undefined): boolean =>
  value === "true" || value === "1";

// These tests exercise the research-agent-integration router, which the API
// server mounts only when the package is enabled. With it off the endpoints
// 404 (and the UI panel never renders, so the UI test times out), so skip the
// whole file rather than fail. Enable IS_RESEARCH_AGENT_INTEGRATION_PACKAGE_ENABLED
// (and its NEXT_PUBLIC_ twin) in e2e/.env to run them — no live agent on :3003
// is required; the preview endpoint resolves and uploads directly.
const isResearchAgentEnabled = (): boolean =>
  isTruthy(process.env.IS_RESEARCH_AGENT_INTEGRATION_PACKAGE_ENABLED) ||
  isTruthy(
    process.env.NEXT_PUBLIC_IS_RESEARCH_AGENT_INTEGRATION_PACKAGE_ENABLED,
  );

test.describe("Research Agent Documents", () => {
  // The preview step fetches an external PDF; give it headroom over the
  // default 30s under parallel load.
  test.setTimeout(60_000);

  test.skip(
    !isResearchAgentEnabled(),
    "Research agent integration disabled — skipping.",
  );

  test("should resolve document preview from research panel via UI", async ({
    page,
  }) => {
    const { db, close } = createTestDB();
    const randomSuffix = Math.random().toString(36).substring(2, 10);
    let blobUrlToCleanup: string | null = null;
    let authToken: string | null = null;
    try {
      // 1. Create test user
      const { user, magicLinkUrl } = await createTestUserWithMagicLink(
        `ra-docs-test-${randomSuffix}@example.com`,
      );
      authToken = await createToken({ id: user.id });

      // 2. Create workspace hierarchy (org -> office -> project)
      const now = new Date();

      const [orgRecord] = await db
        .insert(organization)
        .values({
          name: "Test Org RA",
          slug: `test-org-ra-${randomSuffix}`,
          createdBy: user.id,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await db.insert(organizationUsers).values({
        organizationId: orgRecord.id,
        userId: user.id,
        role: "owner",
      });

      const [officeRecord] = await db
        .insert(office)
        .values({
          name: "Test Office RA",
          slug: `test-office-ra-${randomSuffix}`,
          organizationId: orgRecord.id,
          createdBy: user.id,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await db.insert(officeUsers).values({
        officeId: officeRecord.id,
        userId: user.id,
        role: "owner",
      });

      const [projectRecord] = await db
        .insert(project)
        .values({
          name: "Test Project RA",
          slug: `test-project-ra-${randomSuffix}`,
          officeId: officeRecord.id,
          createdBy: user.id,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await db.insert(projectUsers).values({
        projectId: projectRecord.id,
        userId: user.id,
        role: "owner",
      });

      // 3. Create chat and research agent chat
      const [chatRecord] = await db
        .insert(chat)
        .values({
          title: "Test Chat RA",
          userId: user.id,
          projectId: projectRecord.id,
          isInitial: true,
          createdAt: now,
        })
        .returning();

      const [researchAgentRecord] = await db
        .insert(researchAgentChat)
        .values({
          chatId: chatRecord.id,
          // webhook_secret no longer has a DB default, so every insert must
          // supply its own random secret.
          webhookSecret: randomBytes(32).toString("hex"),
          status: "running",
          externalRunId: `test-run-${randomSuffix}`,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      // 4. Seed a documents message that should be preview-resolved from UI interaction.
      const [documentsMessage] = await db
        .insert(researchAgentMessage)
        .values({
          chatId: chatRecord.id,
          researchAgentChatId: researchAgentRecord.id,
          type: "documents",
          data: {
            documents: [
              {
                title: "Environmental Report",
                url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
                relevance: 85,
                context: "Environmental impact assessment",
                saved: false,
              },
            ],
          },
          createdAt: now,
        })
        .returning();

      // 5. Authenticate and open the seeded chat in the app.
      await page.goto(magicLinkUrl);
      await page.waitForURL(/\/(setup|organizations)\//, { timeout: 15000 });
      if (page.url().includes("/setup")) {
        const setupPage = new TurboplanSetupPage(page);
        await setupPage.completeWizard({ createWorkspace: false });
      }

      // 6. Wait for research panel to auto-open and artifacts to load.
      //    The panel auto-opens when research phase is in progress, so we
      //    register the response listener before navigation to avoid a race.
      const messagesResponsePromise = page.waitForResponse((response) => {
        return (
          response.request().method() === "GET" &&
          response
            .url()
            .includes(
              `/api/ai/research-agent/bootstrapper/project/${projectRecord.id}/messages`,
            ) &&
          response.status() === 200
        );
      });

      await page.goto(
        `${TURBOPLAN_URL}/organizations/${orgRecord.slug}/offices/${officeRecord.slug}/projects/${projectRecord.slug}/chats/${chatRecord.id}`,
      );

      await messagesResponsePromise;

      const documentButton = page.getByRole("button", {
        name: "Environmental Report",
      });
      await expect(documentButton).toBeVisible({ timeout: 15000 });

      const resolveResponsePromise = page.waitForResponse((response) => {
        return (
          response.request().method() === "POST" &&
          response
            .url()
            .includes(
              `/api/ai/research-agent/bootstrapper/project/${projectRecord.id}/messages/${documentsMessage.id}/resolve-document-preview`,
            )
        );
      });

      await documentButton.click();
      const resolveResponse = await resolveResponsePromise;
      expect(resolveResponse.status()).toBe(200);

      const resolvePayload = (await resolveResponse.json()) as {
        blobUrl: string | null;
      };
      blobUrlToCleanup = resolvePayload.blobUrl;

      await expect(
        page.getByRole("button", { name: "Add to Project files" }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Open in new tab" }),
      ).toHaveAttribute(
        "href",
        "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      );

      // 7. Verify stored document URL stays as the original external URL.
      const [updatedMessage] = await db
        .select()
        .from(researchAgentMessage)
        .where(eq(researchAgentMessage.id, documentsMessage.id))
        .limit(1);

      const updatedData = updatedMessage?.data as
        | {
            documents?: Array<{
              title: string;
              url: string;
              blobUrl?: string;
            }>;
          }
        | undefined;
      const updatedPdfDoc = updatedData?.documents?.find(
        (document) => document.title === "Environmental Report",
      );
      expect(updatedPdfDoc?.url).toBe(
        "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      );

      await page.getByRole("button", { name: "Close" }).click();
    } finally {
      if (blobUrlToCleanup && authToken) {
        // Use an independent request context (not the test-scoped `request`
        // fixture) so cleanup still runs if the test body timed out — a
        // disposed fixture would otherwise throw "Request context disposed".
        const cleanup = await apiRequest.newContext();
        try {
          const cleanupResponse = await cleanup.delete(
            `${SERVER_URL}/api/upload`,
            {
              headers: {
                Authorization: `Bearer ${authToken}`,
                "Content-Type": "application/json",
              },
              data: { url: blobUrlToCleanup },
            },
          );
          expect(cleanupResponse.status()).toBe(200);
        } finally {
          await cleanup.dispose();
        }
      }

      await close();
    }
  });

  test("should return null when resolving preview for unsafe document URL", async ({
    request,
  }) => {
    const { db, close } = createTestDB();
    const randomSuffix = Math.random().toString(36).substring(2, 10);
    try {
      // 1. Create test user + auth token
      const { user } = await createTestUserWithMagicLink(
        `ra-docs-unsafe-${randomSuffix}@example.com`,
      );
      const authToken = await createToken({ id: user.id });

      // 2. Create workspace hierarchy (org -> office -> project)
      const now = new Date();

      const [orgRecord] = await db
        .insert(organization)
        .values({
          name: "Test Org RA Unsafe",
          slug: `test-org-ra-unsafe-${randomSuffix}`,
          createdBy: user.id,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await db.insert(organizationUsers).values({
        organizationId: orgRecord.id,
        userId: user.id,
        role: "owner",
      });

      const [officeRecord] = await db
        .insert(office)
        .values({
          name: "Test Office RA Unsafe",
          slug: `test-office-ra-unsafe-${randomSuffix}`,
          organizationId: orgRecord.id,
          createdBy: user.id,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await db.insert(officeUsers).values({
        officeId: officeRecord.id,
        userId: user.id,
        role: "owner",
      });

      const [projectRecord] = await db
        .insert(project)
        .values({
          name: "Test Project RA Unsafe",
          slug: `test-project-ra-unsafe-${randomSuffix}`,
          officeId: officeRecord.id,
          createdBy: user.id,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await db.insert(projectUsers).values({
        projectId: projectRecord.id,
        userId: user.id,
        role: "owner",
      });

      // 3. Create chat + documents message with previewable but unsafe URL
      const [chatRecord] = await db
        .insert(chat)
        .values({
          title: "Test Chat RA Unsafe",
          userId: user.id,
          projectId: projectRecord.id,
          isInitial: true,
          createdAt: now,
        })
        .returning();

      const [researchAgentRecord] = await db
        .insert(researchAgentChat)
        .values({
          chatId: chatRecord.id,
          // webhook_secret no longer has a DB default, so every insert must
          // supply its own random secret.
          webhookSecret: randomBytes(32).toString("hex"),
          status: "running",
          externalRunId: `test-run-unsafe-${randomSuffix}`,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      const [documentsMessage] = await db
        .insert(researchAgentMessage)
        .values({
          chatId: chatRecord.id,
          researchAgentChatId: researchAgentRecord.id,
          type: "documents",
          data: {
            documents: [
              {
                title: "Unsafe Local PDF",
                url: "http://localhost/unsafe-preview.pdf",
                relevance: 50,
                context: "Unsafe local URL for SSRF guard coverage",
                saved: false,
              },
            ],
          },
          createdAt: now,
        })
        .returning();

      const resolveResponse = await request.post(
        `${SERVER_URL}/api/ai/research-agent/bootstrapper/project/${projectRecord.id}/messages/${documentsMessage.id}/resolve-document-preview`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          data: { documentIndex: 0 },
        },
      );
      expect(resolveResponse.status()).toBe(200);

      const resolvePayload = (await resolveResponse.json()) as {
        blobUrl: string | null;
      };
      expect(resolvePayload.blobUrl).toBeNull();

      // URL should stay unchanged and no blobUrl should be backfilled.
      const [updatedMessage] = await db
        .select()
        .from(researchAgentMessage)
        .where(eq(researchAgentMessage.id, documentsMessage.id))
        .limit(1);

      const updatedData = updatedMessage?.data as
        | {
            documents?: Array<{
              title: string;
              url: string;
              blobUrl?: string;
            }>;
          }
        | undefined;
      const updatedUnsafeDoc = updatedData?.documents?.find(
        (document) => document.title === "Unsafe Local PDF",
      );
      expect(updatedUnsafeDoc?.url).toBe("http://localhost/unsafe-preview.pdf");
      expect(updatedUnsafeDoc?.blobUrl).toBeUndefined();
    } finally {
      await close();
    }
  });
});
