import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  isValidSlug,
  RESERVED_SLUGS,
  type SlugLevel,
} from "@wildfires-org/turboplan-utils/server";

/**
 * Sync guard for RESERVED_SLUGS. Dashboard URLs are `/:org/:office/:project`,
 * and a static route folder wins over the dynamic segment beside it, so an
 * org, office or project whose slug equals one would be unreachable. This
 * walks the route tree and fails when a new static segment is not reserved
 * at its level. (Rewrites in next.config.ts, such as /ingest, are not walked:
 * reserve those by hand.)
 */

const APP_DIR = path.join(__dirname, "..", "app");
const PUBLIC_DIR = path.join(__dirname, "..", "public");

// Folders that add no URL segment: route groups `(name)` and parallel route
// slots `@name`.
const isTransparentFolder = (name: string) => {
  return (name.startsWith("(") && name.endsWith(")")) || name.startsWith("@");
};

// Dynamic `[slug]` folders and private `_folder`s add no static segment.
const isSkippedFolder = (name: string) => {
  return name.startsWith("[") || name.startsWith("_");
};

const listFolders = (dir: string): string[] => {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
};

/** Static route segments directly under `dir`, looking through groups. */
const getStaticSegments = (dir: string): string[] => {
  return listFolders(dir).flatMap((name) => {
    if (isTransparentFolder(name)) {
      return getStaticSegments(path.join(dir, name));
    }
    if (isSkippedFolder(name)) {
      return [];
    }
    return [name];
  });
};

/** `[dynamic]` folders directly under `dir`, looking through groups. */
const getDynamicFolders = (dir: string): string[] => {
  return listFolders(dir).flatMap((name) => {
    const folder = path.join(dir, name);
    if (isTransparentFolder(name)) {
      return getDynamicFolders(folder);
    }
    if (name.startsWith("[") && !name.startsWith("[...")) {
      return [folder];
    }
    return [];
  });
};

/** Segments a slug could equal (others, like `.well-known`, never collide). */
const getMissingReserved = (level: SlugLevel, segments: string[]) => {
  const reserved: readonly string[] = RESERVED_SLUGS[level];
  return [...new Set(segments)]
    .filter((segment) => isValidSlug(segment))
    .filter((segment) => !reserved.includes(segment))
    .sort();
};

const assertAllReserved = (
  level: SlugLevel,
  segments: string[],
  where: string,
) => {
  const missing = getMissingReserved(level, segments);
  assert.deepStrictEqual(
    missing,
    [],
    `Static route segment(s) ${missing.map((s) => `"${s}"`).join(", ")} ${where} would shadow ${level} slugs. Add them to RESERVED_SLUGS.${level} in packages/core/turboplan-utils/src/slug.ts (rebuild the package before re-running).`,
  );
};

const getSingleDynamicFolder = (dir: string, label: string): string => {
  const folders = getDynamicFolders(dir);
  assert.strictEqual(
    folders.length,
    1,
    `Expected exactly one ${label} folder under ${path.relative(APP_DIR, dir) || "app/"}, found: ${folders.join(", ") || "none"}. Update this guard if the dashboard route tree moved.`,
  );
  return folders[0];
};

describe("RESERVED_SLUGS stays in sync with the route tree", () => {
  const orgDir = getSingleDynamicFolder(APP_DIR, "[orgSlug]");
  const officeDir = getSingleDynamicFolder(orgDir, "[officeSlug]");

  it("finds the dashboard's dynamic route folders", () => {
    assert.strictEqual(path.basename(orgDir), "[orgSlug]");
    assert.strictEqual(path.basename(officeDir), "[officeSlug]");
    assert.strictEqual(
      path.basename(getSingleDynamicFolder(officeDir, "[projectSlug]")),
      "[projectSlug]",
    );
  });

  it("reserves every root route folder and public/ entry as an organization slug", () => {
    const publicEntries = fs.readdirSync(PUBLIC_DIR);
    const rootSegments = getStaticSegments(APP_DIR);

    // The walk must see the known root routes, or it is looking in the wrong place.
    assert.ok(rootSegments.includes("login"));
    assert.ok(rootSegments.includes("api"));

    assertAllReserved(
      "organization",
      [...rootSegments, ...publicEntries],
      "at the app root (/:org)",
    );
  });

  it("reserves every org-level route folder as an office slug", () => {
    const orgSegments = getStaticSegments(orgDir);

    // Includes pages inside the `(org)` route group.
    assert.ok(orgSegments.includes("members"));
    assert.ok(orgSegments.includes("context"));

    assertAllReserved("office", orgSegments, "under /:org (/:org/:office)");
  });

  it("reserves every office-level route folder as a project slug", () => {
    const officeSegments = getStaticSegments(officeDir);

    assert.ok(officeSegments.includes("templates"));

    assertAllReserved(
      "project",
      officeSegments,
      "under /:org/:office (/:org/:office/:project)",
    );
  });
});
