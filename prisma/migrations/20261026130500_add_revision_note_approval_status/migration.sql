ALTER TABLE "revision_notes"
ADD COLUMN "approval_status" VARCHAR(50) NOT NULL DEFAULT 'draft';
