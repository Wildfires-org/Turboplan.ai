import { expect, test } from "@playwright/test";

import { OfficeFeaturesMySignaturesPage } from "../../pages/office-features-my-signatures";
import {
  createTestOrganization,
  getGovWorkspace,
  type TestOrganization,
} from "../../utils";

/**
 * `/[orgSlug]/my-signatures`: the signed-in member's pending signing requests
 * in an organization. Runs as the gov user in a fresh organization it owns, so
 * no signing request can exist there and the page must show its empty state.
 */

const shortId = (): string => Math.random().toString(36).substring(2, 8);

// The page is not found while the signing package is off; the route smoke
// test covers that case.
const isSigningEnabled = [
  process.env.IS_SIGNING_PACKAGE_ENABLED,
  process.env.NEXT_PUBLIC_IS_SIGNING_PACKAGE_ENABLED,
].some((value) => value?.trim().toLowerCase() === "true");

test.describe("My signatures page", () => {
  test.use({ storageState: "./storage/auth/gov.json" });
  test.skip(!isSigningEnabled, "Signing module is disabled");

  let organization: TestOrganization;

  test.beforeAll(async () => {
    const { userId } = await getGovWorkspace();
    organization = await createTestOrganization({
      ownerId: userId,
      name: `E2E Signatures Org ${shortId()}`,
    });
  });

  test("loads and shows the empty state for an organization without requests", async ({
    page,
  }) => {
    const signatures = new OfficeFeaturesMySignaturesPage(page);
    const params = {
      orgSlug: organization.slug,
      organizationId: organization.id,
    };

    await signatures.goto(params);
    await signatures.expectEmptyState();
    await expect(page).toHaveURL(
      new RegExp(`${OfficeFeaturesMySignaturesPage.path(organization.slug)}$`),
    );

    // Still empty when loaded again from scratch.
    await signatures.goto(params);
    await signatures.expectEmptyState();
  });
});
