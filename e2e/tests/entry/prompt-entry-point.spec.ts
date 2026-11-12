import { expect, type Page, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";

import { createTestDB } from "@wildfires-org/turboplan-db/db-client";
import {
  project,
  user as userTable,
} from "@wildfires-org/turboplan-db/schemas";

import { expectHealthyPage, watchPageProblems } from "../smoke/route-health";

/**
 * The prompt entry page a signed-out visitor sees at `/` when the web app is
 * built with NEXT_PUBLIC_ENTRY_POINT=prompt (apps/turboplan/lib/entry-point).
 * Picking an example and sending hands the prompt to `/self-service`, which
 * signs the visitor up with the project already described.
 *
 * The suite runs with the switch off by default, where `/` sends signed-out
 * visitors to /login (covered by smoke/auth-routes.spec.ts). Set
 * NEXT_PUBLIC_ENTRY_POINT=prompt in e2e/.env to run these.
 */

test.use({ storageState: { cookies: [], origins: [] } });

const isPromptEntryPoint = process.env.NEXT_PUBLIC_ENTRY_POINT === "prompt";

const suffix = () => Math.random().toString(36).substring(2, 10);

const promptBox = (page: Page) => {
  return page.getByRole("textbox", { name: "Describe your project" });
};

/** Poll for the project the self-service action creates for `email`. */
const waitForCreatedProject = async (
  db: ReturnType<typeof createTestDB>["db"],
  email: string,
  projectName: string,
) => {
  for (let attempt = 0; attempt < 20; attempt++) {
    const [createdUser] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.email, email.toLowerCase()))
      .limit(1);

    if (createdUser) {
      const [createdProject] = await db
        .select()
        .from(project)
        .where(
          and(
            eq(project.name, projectName),
            eq(project.createdBy, createdUser.id),
          ),
        )
        .limit(1);

      if (createdProject) {
        return createdProject;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Project "${projectName}" for ${email} was not created within the timeout`,
  );
};

test.describe("Prompt entry point", () => {
  test.skip(
    !isPromptEntryPoint,
    "NEXT_PUBLIC_ENTRY_POINT is not 'prompt' - the root sends visitors to /login",
  );

  test("greets a signed-out visitor at the root", async ({ page }) => {
    const problems = watchPageProblems(page);

    await page.goto("/");

    await expect(page).toHaveURL("/");
    await expectHealthyPage(
      page,
      page.getByRole("heading", { level: 1, name: "Accelerate NEPA." }),
      problems,
    );
    await expect(promptBox(page)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Source code on GitHub" }),
    ).toHaveAttribute("href", "https://github.com/Wildfires-org/Turboplan.ai");
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  test("asks for a description before sending", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Start planning" }).click();

    await expect(
      page.getByText("Describe your project to get started"),
    ).toBeVisible();
    await expect(promptBox(page)).toHaveAttribute("aria-invalid", "true");
    await expect(page).toHaveURL("/");
  });

  test("an example chip fills the prompt and more examples open on demand", async ({
    page,
  }) => {
    await page.goto("/");
    const examples = page.getByRole("list", {
      name: "Start from a Forest Service example",
    });

    await examples.getByRole("button", { name: "Fuel break" }).click();
    await expect(promptBox(page)).toHaveValue(/fuel break/i);
    await expect(promptBox(page)).toBeFocused();

    await expect(
      examples.getByRole("button", { name: "Trail reroute" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: /more examples/ }).click();
    await expect(
      examples.getByRole("button", { name: "Trail reroute" }),
    ).toBeFocused();
  });

  test.describe("hand-off", () => {
    // Drives the debounced email check and the signup action, which sends a
    // magic-link email; give it the same headroom as the self-service specs.
    test.setTimeout(60_000);

    test("sends the prompt to self-service and creates the project at signup", async ({
      page,
    }) => {
      await page.goto("/?utm_source=e2e-entry");

      await page.getByRole("button", { name: "Fuel break" }).click();
      const prompt = await promptBox(page).inputValue();
      await page.getByRole("button", { name: "Start planning" }).click();

      await page.waitForURL(/\/self-service\?/, { timeout: 20_000 });
      const handoff = new URL(page.url()).searchParams;
      expect(handoff.get("projectDescription")).toBe(prompt);
      expect(handoff.get("utm_source")).toBe("e2e-entry");
      await expect(page.locator("#projectTitle")).toHaveValue(
        "Cedar Ridge Fuel Break",
      );

      const email = `entry-${suffix()}@example.test`;
      await page.locator("#email").fill(email);
      await expect(page.getByText("Checking email...")).toHaveCount(0, {
        timeout: 10_000,
      });
      await page
        .getByRole("button", { name: /create account|continue/i })
        .click();
      await page.waitForURL(/\/check-email/, { timeout: 20_000 });

      const { db, close } = createTestDB();
      try {
        const createdProject = await waitForCreatedProject(
          db,
          email,
          "Cedar Ridge Fuel Break",
        );
        expect(createdProject.description).toBe(prompt);
      } finally {
        await close();
      }
    });

    test("Back from self-service keeps the prompt", async ({ page }) => {
      await page.goto("/");

      const prompt = "Thin 400 acres of overstocked pine near Elk Camp.";
      await promptBox(page).fill(prompt);
      await promptBox(page).press("Enter");
      await page.waitForURL(/\/self-service\?/, { timeout: 20_000 });
      await expect(page.locator("#projectTitle")).toHaveValue(
        "Thin 400 acres of overstocked pine near Elk Camp",
      );

      await page.goBack();
      await expect(promptBox(page)).toHaveValue(prompt);
    });
  });
});
