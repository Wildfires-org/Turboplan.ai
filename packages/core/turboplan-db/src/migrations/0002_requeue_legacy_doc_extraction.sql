-- Legacy Word (.doc) files can now be extracted. Rows the extractor marked
-- "unsupported" before that are put back in the queue so the research-agent
-- poller picks them up; rows with any other status are left alone.
UPDATE "project_document"
SET "extraction_status" = 'pending', "extraction_error" = NULL
WHERE "mime_type" = 'application/msword'
  AND "extraction_status" = 'unsupported';
