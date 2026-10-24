
BEGIN;

-- A single migration timestamp is used where no reliable creation history exists.
ALTER TABLE public."_prisma_migrations"
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ;
UPDATE public."_prisma_migrations"
  SET "created_at" = COALESCE("started_at", NOW())
  WHERE "created_at" IS NULL;
ALTER TABLE public."_prisma_migrations"
  ALTER COLUMN "created_at" SET DEFAULT NOW(),
  ALTER COLUMN "created_at" SET NOT NULL;

ALTER TABLE public."academic_years" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ;
UPDATE public."academic_years" SET "created_at" = NOW() WHERE "created_at" IS NULL;
ALTER TABLE public."academic_years"
  ALTER COLUMN "created_at" SET DEFAULT NOW(),
  ALTER COLUMN "created_at" SET NOT NULL;

ALTER TABLE public."access_approvals" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ;
UPDATE public."access_approvals" SET "created_at" = NOW() WHERE "created_at" IS NULL;
ALTER TABLE public."access_approvals"
  ALTER COLUMN "created_at" SET DEFAULT NOW(),
  ALTER COLUMN "created_at" SET NOT NULL;

ALTER TABLE public."assessment_blueprints" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ;
UPDATE public."assessment_blueprints" SET "created_at" = NOW() WHERE "created_at" IS NULL;
ALTER TABLE public."assessment_blueprints"
  ALTER COLUMN "created_at" SET DEFAULT NOW(),
  ALTER COLUMN "created_at" SET NOT NULL;

ALTER TABLE public."assessment_items" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ;
UPDATE public."assessment_items" ai
  SET "created_at" = COALESCE(
    (SELECT a."created_at" FROM public."assessments" a WHERE a.id = ai.assessment_id),
    NOW()
  )
  WHERE ai."created_at" IS NULL;
ALTER TABLE public."assessment_items"
  ALTER COLUMN "created_at" SET DEFAULT NOW(),
  ALTER COLUMN "created_at" SET NOT NULL;

ALTER TABLE public."attempts" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ;
UPDATE public."attempts" SET "created_at" = NOW() WHERE "created_at" IS NULL;
ALTER TABLE public."attempts"
  ALTER COLUMN "created_at" SET DEFAULT NOW(),
  ALTER COLUMN "created_at" SET NOT NULL;

ALTER TABLE public."consents" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ;
UPDATE public."consents" c
  SET "created_at" = COALESCE(c."accepted_at", NOW())
  WHERE c."created_at" IS NULL;
ALTER TABLE public."consents"
  ALTER COLUMN "created_at" SET DEFAULT NOW(),
  ALTER COLUMN "created_at" SET NOT NULL;

ALTER TABLE public."courses" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ;
UPDATE public."courses" SET "created_at" = NOW() WHERE "created_at" IS NULL;
ALTER TABLE public."courses"
  ALTER COLUMN "created_at" SET DEFAULT NOW(),
  ALTER COLUMN "created_at" SET NOT NULL;

ALTER TABLE public."exam_pattern_rules" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ;
UPDATE public."exam_pattern_rules" SET "created_at" = NOW() WHERE "created_at" IS NULL;
ALTER TABLE public."exam_pattern_rules"
  ALTER COLUMN "created_at" SET DEFAULT NOW(),
  ALTER COLUMN "created_at" SET NOT NULL;

ALTER TABLE public."leaderboard_profiles" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ;
UPDATE public."leaderboard_profiles" SET "created_at" = NOW() WHERE "created_at" IS NULL;
ALTER TABLE public."leaderboard_profiles"
  ALTER COLUMN "created_at" SET DEFAULT NOW(),
  ALTER COLUMN "created_at" SET NOT NULL;

ALTER TABLE public."leaderboard_scores" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ;
UPDATE public."leaderboard_scores" SET "created_at" = NOW() WHERE "created_at" IS NULL;
ALTER TABLE public."leaderboard_scores"
  ALTER COLUMN "created_at" SET DEFAULT NOW(),
  ALTER COLUMN "created_at" SET NOT NULL;

ALTER TABLE public."notifications" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ;
UPDATE public."notifications" SET "created_at" = NOW() WHERE "created_at" IS NULL;
ALTER TABLE public."notifications"
  ALTER COLUMN "created_at" SET DEFAULT NOW(),
  ALTER COLUMN "created_at" SET NOT NULL;

ALTER TABLE public."passages" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ;
UPDATE public."passages" p
  SET "created_at" = COALESCE(
    (
      SELECT MIN(a."created_at")
      FROM public."assessment_items" ai
      JOIN public."assessments" a ON a.id = ai.assessment_id
      WHERE ai.passage_id = p.id
    ),
    NOW()
  )
  WHERE p."created_at" IS NULL;
ALTER TABLE public."passages"
  ALTER COLUMN "created_at" SET DEFAULT NOW(),
  ALTER COLUMN "created_at" SET NOT NULL;

ALTER TABLE public."plans" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ;
UPDATE public."plans" SET "created_at" = NOW() WHERE "created_at" IS NULL;
ALTER TABLE public."plans"
  ALTER COLUMN "created_at" SET DEFAULT NOW(),
  ALTER COLUMN "created_at" SET NOT NULL;

ALTER TABLE public."questions" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ;
UPDATE public."questions" q
  SET "created_at" = COALESCE(
    (
      SELECT MIN(a."created_at")
      FROM public."assessment_items" ai
      JOIN public."assessments" a ON a.id = ai.assessment_id
      WHERE ai.question_id = q.id
    ),
    NOW()
  )
  WHERE q."created_at" IS NULL;
ALTER TABLE public."questions"
  ALTER COLUMN "created_at" SET DEFAULT NOW(),
  ALTER COLUMN "created_at" SET NOT NULL;

ALTER TABLE public."responses" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ;
UPDATE public."responses" SET "created_at" = NOW() WHERE "created_at" IS NULL;
ALTER TABLE public."responses"
  ALTER COLUMN "created_at" SET DEFAULT NOW(),
  ALTER COLUMN "created_at" SET NOT NULL;

ALTER TABLE public."revision_notes" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ;
UPDATE public."revision_notes" rn
  SET "created_at" = COALESCE(
    (SELECT r."created_at" FROM public."content_releases" r WHERE r.id = rn.release_id),
    NOW()
  )
  WHERE rn."created_at" IS NULL;
ALTER TABLE public."revision_notes"
  ALTER COLUMN "created_at" SET DEFAULT NOW(),
  ALTER COLUMN "created_at" SET NOT NULL;

ALTER TABLE public."schema_migrations" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ;
UPDATE public."schema_migrations" sm
  SET "created_at" = COALESCE(sm."applied_at", NOW())
  WHERE sm."created_at" IS NULL;
ALTER TABLE public."schema_migrations"
  ALTER COLUMN "created_at" SET DEFAULT NOW(),
  ALTER COLUMN "created_at" SET NOT NULL;

ALTER TABLE public."source_chunks" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ;
UPDATE public."source_chunks" SET "created_at" = NOW() WHERE "created_at" IS NULL;
ALTER TABLE public."source_chunks"
  ALTER COLUMN "created_at" SET DEFAULT NOW(),
  ALTER COLUMN "created_at" SET NOT NULL;

ALTER TABLE public."source_records" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ;
UPDATE public."source_records" SET "created_at" = NOW() WHERE "created_at" IS NULL;
ALTER TABLE public."source_records"
  ALTER COLUMN "created_at" SET DEFAULT NOW(),
  ALTER COLUMN "created_at" SET NOT NULL;

ALTER TABLE public."subscriptions" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ;
UPDATE public."subscriptions" SET "created_at" = NOW() WHERE "created_at" IS NULL;
ALTER TABLE public."subscriptions"
  ALTER COLUMN "created_at" SET DEFAULT NOW(),
  ALTER COLUMN "created_at" SET NOT NULL;

ALTER TABLE public."taxonomy_nodes" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ;
UPDATE public."taxonomy_nodes" SET "created_at" = NOW() WHERE "created_at" IS NULL;
ALTER TABLE public."taxonomy_nodes"
  ALTER COLUMN "created_at" SET DEFAULT NOW(),
  ALTER COLUMN "created_at" SET NOT NULL;

ALTER TABLE public."trials" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ;
UPDATE public."trials" t
  SET "created_at" = COALESCE(t."starts_at", NOW())
  WHERE t."created_at" IS NULL;
ALTER TABLE public."trials"
  ALTER COLUMN "created_at" SET DEFAULT NOW(),
  ALTER COLUMN "created_at" SET NOT NULL;

COMMIT;
