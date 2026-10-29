-- Slugs used to be cut to 40 characters after their edge hyphens were trimmed,
-- so a long name could end in "-" (e.g. the office
-- "pipeline-and-hazardous-materials-safety-"). The public API rejects those
-- slugs, so their catalog pages were unreachable. Trim the trailing hyphens and
-- keep the old slug in slug_history, which the app already resolves and
-- redirects. A row is left alone when its trimmed slug is already taken —
-- as a current or historical slug — in the same scope, and only one row per
-- trimmed value is renamed, so the unique indexes can't be violated.

WITH candidates AS (
  SELECT DISTINCT ON (regexp_replace("slug", '-+$', ''))
    "id", regexp_replace("slug", '-+$', '') AS new_slug
  FROM "organization"
  WHERE "slug" ~ '-$'
  ORDER BY regexp_replace("slug", '-+$', ''), "created_at"
)
UPDATE "organization" AS o
SET "slug" = c.new_slug,
    "slug_history" = (o."slug_history"::jsonb || jsonb_build_array(o."slug"))::json
FROM candidates AS c
WHERE o."id" = c."id"
  AND c.new_slug <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "organization" AS other
    WHERE other."id" <> o."id"
      AND (other."slug" = c.new_slug
        OR other."slug_history"::jsonb @> jsonb_build_array(c.new_slug))
  );
--> statement-breakpoint
WITH candidates AS (
  SELECT DISTINCT ON ("organization_id", regexp_replace("slug", '-+$', ''))
    "id", regexp_replace("slug", '-+$', '') AS new_slug
  FROM "office"
  WHERE "slug" ~ '-$'
  ORDER BY "organization_id", regexp_replace("slug", '-+$', ''), "created_at"
)
UPDATE "office" AS o
SET "slug" = c.new_slug,
    "slug_history" = (o."slug_history"::jsonb || jsonb_build_array(o."slug"))::json
FROM candidates AS c
WHERE o."id" = c."id"
  AND c.new_slug <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "office" AS other
    WHERE other."organization_id" = o."organization_id"
      AND other."id" <> o."id"
      AND (other."slug" = c.new_slug
        OR other."slug_history"::jsonb @> jsonb_build_array(c.new_slug))
  );
--> statement-breakpoint
WITH candidates AS (
  SELECT DISTINCT ON ("office_id", regexp_replace("slug", '-+$', ''))
    "id", regexp_replace("slug", '-+$', '') AS new_slug
  FROM "project"
  WHERE "slug" ~ '-$'
  ORDER BY "office_id", regexp_replace("slug", '-+$', ''), "created_at"
)
UPDATE "project" AS p
SET "slug" = c.new_slug,
    "slug_history" = (p."slug_history"::jsonb || jsonb_build_array(p."slug"))::json
FROM candidates AS c
WHERE p."id" = c."id"
  AND c.new_slug <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "project" AS other
    WHERE other."office_id" = p."office_id"
      AND other."id" <> p."id"
      AND (other."slug" = c.new_slug
        OR other."slug_history"::jsonb @> jsonb_build_array(c.new_slug))
  );
