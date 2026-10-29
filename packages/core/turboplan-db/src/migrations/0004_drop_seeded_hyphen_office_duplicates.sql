-- Migration 0003 renamed slugs that ended in "-" (e.g. the DOT office
-- "pipeline-and-hazardous-materials-safety-"). The government seed, which runs
-- on every deploy and matches offices by current slug, still listed the old
-- slug, so the next deploy re-inserted that office as an empty duplicate. The
-- seed data now uses the trimmed slug; this removes the duplicates it created.
--
-- An office is removed only when it is unreachable (its slug ends in "-"),
-- another office in the same organization already holds the trimmed slug, and
-- nothing but memberships refers to it: no project, submission or cataloger
-- record. Memberships cascade; intended-submission pointers are set null.

DELETE FROM "office" AS dup
WHERE dup."slug" ~ '-$'
  AND EXISTS (
    SELECT 1 FROM "office" AS kept
    WHERE kept."organization_id" = dup."organization_id"
      AND kept."id" <> dup."id"
      AND kept."slug" = regexp_replace(dup."slug", '-+$', '')
  )
  AND NOT EXISTS (SELECT 1 FROM "project" WHERE "office_id" = dup."id")
  AND NOT EXISTS (
    SELECT 1 FROM "project_submission"
    WHERE "target_office_id" = dup."id" OR "source_office_id" = dup."id"
  );
