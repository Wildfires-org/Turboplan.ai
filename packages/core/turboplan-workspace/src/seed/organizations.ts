/**
 * Seed script to populate organizations, offices, and template projects.
 *
 * Run with: pnpm --filter @wildfires-org/turboplan-workspace seed
 *
 * This script:
 * 1. Creates a system user if needed (for createdBy field)
 * 2. Seeds government/environmental-planner organizations with their logo and
 *    cover image URLs
 * 3. Seeds their offices with logo and cover image URLs
 * 4. Seeds template projects with cover images
 */

import { resolve } from "node:path";
import { config } from "dotenv";

// INIT_CWD is set by pnpm to the directory where the command was invoked.
// This lets us find the .env.local file regardless of which package cwd pnpm uses.
const root = process.env.INIT_CWD || process.cwd();
config({ path: resolve(root, "apps/turboplan/.env.local") });

// Loaded after env so getR2Env() (called lazily inside uploadFile) sees the
// right bucket credentials for whichever environment the seed is run against.
const { uploadFile } = await import("@wildfires-org/turboplan-upload/server");

// Dynamic imports: env must be loaded before these modules resolve (they trigger env validation)
const { and, eq } = await import("drizzle-orm");
const {
  generatedImages,
  OfficeStatus,
  OrganizationStatus,
  OrganizationType,
  office,
  officeUsers,
  organization,
  organizationUsers,
  project,
  projectUsers,
  user,
} = await import("@wildfires-org/turboplan-db");
const { closeDB, db, getDB } = await import(
  "@wildfires-org/turboplan-db/db-client"
);

import { OFFICE_SEEDS, ORGANIZATION_SEEDS } from "./data";
import { getTemplateSeeds } from "./template-data";

if (!process.env.SYSTEM_USER_EMAIL) {
  throw new Error("Missing SYSTEM_USER_EMAIL environment variable");
}

const SYSTEM_USER_EMAIL: string = process.env.SYSTEM_USER_EMAIL;

// Seed data URLs (data.ts) always point at the dev R2 bucket — that's where
// the source assets live. Mirror each into the current env's own bucket
// (getR2Env(), resolved lazily by uploadFile) instead of writing the dev
// bucket's URL straight into the DB, which next/image's remotePatterns
// allowlist would reject in any env whose bucket differs from dev.
const mirroredAssetCache = new Map<string, string>();

async function mirrorSeedAsset(sourceUrl: string): Promise<string> {
  const cached = mirroredAssetCache.get(sourceUrl);
  if (cached) {
    return cached;
  }

  const key = new URL(sourceUrl).pathname.replace(/^\/+/, "");

  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch seed asset ${sourceUrl}: ${response.status} ${response.statusText}`,
    );
  }
  const contentType =
    response.headers.get("content-type") ?? "application/octet-stream";
  const body = await response.arrayBuffer();

  const { url } = await uploadFile(key, body, contentType);
  mirroredAssetCache.set(sourceUrl, url);
  return url;
}

async function createCoverImage(
  entityType: "organization" | "office",
  entityId: string,
  coverImageUrl: string,
  systemUserId: string,
): Promise<string> {
  const [image] = await db
    .insert(generatedImages)
    .values({
      entityId,
      entityType,
      imageUrl: coverImageUrl,
      prompt: "Seed image",
      createdBy: systemUserId,
    })
    .returning();

  return image.id;
}

/**
 * Get or create the system user for seeding purposes
 */
async function getOrCreateSystemUser(): Promise<string> {
  // Check if system user exists
  const [existingUser] = await db
    .select()
    .from(user)
    .where(eq(user.email, SYSTEM_USER_EMAIL));

  if (existingUser) {
    return existingUser.id;
  }

  // Create system user
  const [newUser] = await db
    .insert(user)
    .values({
      email: SYSTEM_USER_EMAIL,
    })
    .returning();

  console.log(`  Created system user: ${SYSTEM_USER_EMAIL}`);
  return newUser.id;
}

/**
 * Get organization by slug
 */
async function getOrganizationBySlug(slug: string) {
  const [existing] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, slug));
  return existing;
}

/**
 * Get an office by slug
 */
async function getOfficeBySlug(slug: string) {
  const [existing] = await db
    .select()
    .from(office)
    .where(eq(office.slug, slug));

  return existing;
}

/**
 * Get organization ID by slug
 */
async function getOrganizationIdBySlug(slug: string): Promise<string | null> {
  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, slug));
  return org?.id || null;
}

async function seedOrganizations(systemUserId: string) {
  console.log("\n📁 Seeding organizations...\n");

  let created = 0;
  let updated = 0;
  let skipped = 0;

  const now = new Date();

  for (const seed of ORGANIZATION_SEEDS) {
    try {
      const existingOrg = await getOrganizationBySlug(seed.slug);
      const emailDomains = seed.emailDomains ?? [];

      if (existingOrg) {
        const updates: Partial<typeof organization.$inferInsert> = {};
        if (!existingOrg.logoUrl && seed.logoUrl) {
          updates.logoUrl = await mirrorSeedAsset(seed.logoUrl);
        }
        if (!existingOrg.coverImageId && seed.coverImageUrl) {
          updates.coverImageId = await createCoverImage(
            "organization",
            existingOrg.id,
            await mirrorSeedAsset(seed.coverImageUrl),
            systemUserId,
          );
        }
        if (emailDomains.length > 0 && existingOrg.emailDomains.length === 0) {
          updates.emailDomains = emailDomains;
        }

        if (Object.keys(updates).length > 0) {
          await db
            .update(organization)
            .set({ ...updates, updatedAt: now })
            .where(eq(organization.id, existingOrg.id));

          console.log(
            `  🔁 Updated: ${seed.shortName} (${seed.slug}) - ${Object.keys(updates).join(", ")}`,
          );
          updated++;
          continue;
        }

        console.log(
          `  ⏭️  Skipped: ${seed.shortName} (${seed.slug}) - already exists`,
        );
        skipped++;
        continue;
      }

      const [newOrg] = await db
        .insert(organization)
        .values({
          name: seed.name,
          shortName: seed.shortName,
          slug: seed.slug,
          description: seed.description,
          country: seed.country,
          emailDomains,
          logoUrl: seed.logoUrl ? await mirrorSeedAsset(seed.logoUrl) : null,
          type: seed.type ?? OrganizationType.GOVERNMENT,
          status: seed.status ?? OrganizationStatus.ACTIVE,
          createdBy: systemUserId,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (seed.coverImageUrl) {
        const coverImageId = await createCoverImage(
          "organization",
          newOrg.id,
          await mirrorSeedAsset(seed.coverImageUrl),
          systemUserId,
        );
        await db
          .update(organization)
          .set({ coverImageId })
          .where(eq(organization.id, newOrg.id));
      }

      // Add seed user as owner
      await db.insert(organizationUsers).values({
        userId: systemUserId,
        organizationId: newOrg.id,
        role: "owner",
      });

      console.log(`  ✅ Created: ${seed.shortName} (${seed.slug})`);
      created++;
    } catch (error) {
      console.error(`  ❌ Failed to seed ${seed.shortName}:`, error);
    }
  }

  console.log(
    `\n  Organizations: ${created} created, ${updated} updated, ${skipped} skipped`,
  );
}

async function seedOffices(systemUserId: string) {
  console.log("\n🏢 Seeding offices...\n");

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const now = new Date();

  for (const seed of OFFICE_SEEDS) {
    try {
      // Get parent organization ID
      const organizationId = await getOrganizationIdBySlug(
        seed.organizationSlug,
      );

      if (!organizationId) {
        console.log(
          `  ⚠️  Skipped: ${seed.name} - parent org ${seed.organizationSlug} not found`,
        );
        errors++;
        continue;
      }

      const existingOffice = await getOfficeBySlug(seed.slug);

      if (existingOffice) {
        const updates: Partial<typeof office.$inferInsert> = {};
        if (!existingOffice.logoUrl && seed.logoUrl) {
          updates.logoUrl = await mirrorSeedAsset(seed.logoUrl);
        }
        if (!existingOffice.coverImageId && seed.coverImageUrl) {
          updates.coverImageId = await createCoverImage(
            "office",
            existingOffice.id,
            await mirrorSeedAsset(seed.coverImageUrl),
            systemUserId,
          );
        }

        if (Object.keys(updates).length > 0) {
          await db
            .update(office)
            .set({ ...updates, updatedAt: now })
            .where(eq(office.id, existingOffice.id));

          console.log(
            `  🔁 Updated: ${seed.name} (${seed.slug}) - ${Object.keys(updates).join(", ")}`,
          );
          updated++;
          continue;
        }

        console.log(
          `  ⏭️  Skipped: ${seed.name} (${seed.slug}) - already exists`,
        );
        skipped++;
        continue;
      }

      const [newOffice] = await db
        .insert(office)
        .values({
          name: seed.name,
          slug: seed.slug,
          description: seed.description,
          organizationId,
          logoUrl: seed.logoUrl ? await mirrorSeedAsset(seed.logoUrl) : null,
          status: seed.status ?? OfficeStatus.ACTIVE,
          createdBy: systemUserId,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (seed.coverImageUrl) {
        const coverImageId = await createCoverImage(
          "office",
          newOffice.id,
          await mirrorSeedAsset(seed.coverImageUrl),
          systemUserId,
        );
        await db
          .update(office)
          .set({ coverImageId })
          .where(eq(office.id, newOffice.id));
      }

      // Add seed user as owner
      await db.insert(officeUsers).values({
        userId: systemUserId,
        officeId: newOffice.id,
        role: "owner",
      });

      console.log(`  ✅ Created: ${seed.name} (${seed.slug})`);
      created++;
    } catch (error) {
      console.error(`  ❌ Failed to seed ${seed.name}:`, error);
      errors++;
    }
  }

  console.log(
    `\n  Offices: ${created} created, ${updated} updated, ${skipped} skipped, ${errors} errors`,
  );
}

/**
 * Check if a template project with the given slug already exists
 */
async function templateExists(slug: string): Promise<boolean> {
  const [existing] = await db
    .select()
    .from(project)
    .where(and(eq(project.slug, slug), eq(project.isTemplate, true)));
  return !!existing;
}

/**
 * Look up an office by slug + organization slug
 */
async function getOfficeId(
  officeSlug: string,
  organizationSlug: string,
): Promise<string | null> {
  const [result] = await db
    .select({ id: office.id })
    .from(office)
    .innerJoin(organization, eq(office.organizationId, organization.id))
    .where(
      and(eq(office.slug, officeSlug), eq(organization.slug, organizationSlug)),
    );
  return result?.id || null;
}

async function seedTemplates(systemUserId: string) {
  console.log("\n📋 Seeding template projects...\n");

  let created = 0;
  let skipped = 0;
  let errors = 0;

  const now = new Date();

  for (const seed of getTemplateSeeds()) {
    try {
      const exists = await templateExists(seed.slug);
      if (exists) {
        console.log(
          `  ⏭️  Skipped: ${seed.name} (${seed.slug}) - already exists`,
        );
        skipped++;
        continue;
      }

      const officeId = await getOfficeId(
        seed.officeSlug,
        seed.organizationSlug,
      );

      if (!officeId) {
        console.log(
          `  ⚠️  Skipped: ${seed.name} - office ${seed.officeSlug} in ${seed.organizationSlug} not found`,
        );
        errors++;
        continue;
      }

      // Create the project
      const [newProject] = await db
        .insert(project)
        .values({
          name: seed.name,
          slug: seed.slug,
          description: seed.description,
          officeId,
          isTemplate: true,
          isPublic: true,
          status: "active",
          createdBy: systemUserId,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      // Create the cover image
      const [image] = await db
        .insert(generatedImages)
        .values({
          entityId: newProject.id,
          entityType: "project",
          imageUrl: await mirrorSeedAsset(seed.coverImageUrl),
          prompt: "Seed image",
          createdBy: systemUserId,
        })
        .returning();

      // Set the cover image on the project
      await db
        .update(project)
        .set({ coverImageId: image.id })
        .where(eq(project.id, newProject.id));

      // Add system user as owner
      await db.insert(projectUsers).values({
        userId: systemUserId,
        projectId: newProject.id,
        role: "owner",
      });

      console.log(`  ✅ Created: ${seed.name} (${seed.slug})`);
      created++;
    } catch (error) {
      console.error(`  ❌ Failed to seed ${seed.name}:`, error);
      errors++;
    }
  }

  console.log(
    `\n  Templates: ${created} created, ${skipped} skipped, ${errors} errors`,
  );
}

async function main() {
  console.log("🌱 Starting seed...\n");

  // Ensure DB is initialized
  getDB();

  // Get or create system user
  console.log("👤 Setting up system user...");
  const systemUserId = await getOrCreateSystemUser();
  console.log(`  Using system user ID: ${systemUserId}`);

  // Seed organizations
  await seedOrganizations(systemUserId);

  // Seed offices
  await seedOffices(systemUserId);

  // Seed templates
  await seedTemplates(systemUserId);

  console.log("\n🌱 Seed complete!");
}

// Run the seed
main()
  .then(() => {
    console.log("\n✨ Done!");
    return closeDB();
  })
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
