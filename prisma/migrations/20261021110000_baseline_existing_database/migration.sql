-- The existing schema uses gen_random_uuid() for UUID defaults.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CreateEnum
CREATE TYPE "account_state" AS ENUM ('pending_approval', 'active', 'trial_active', 'trial_expired', 'paid_active', 'paid_expired', 'rejected', 'suspended', 'deleted');

-- CreateEnum
CREATE TYPE "approval_decision" AS ENUM ('approved', 'rejected');

-- CreateEnum
CREATE TYPE "assessment_status" AS ENUM ('draft', 'approved', 'published', 'retired');

-- CreateEnum
CREATE TYPE "assessment_type" AS ENUM ('weekly', 'monthly', 'practice');

-- CreateEnum
CREATE TYPE "attempt_state" AS ENUM ('in_progress', 'submitted', 'expired', 'evaluation_pending', 'evaluated', 'cancelled');

-- CreateEnum
CREATE TYPE "consent_type" AS ENUM ('terms', 'privacy', 'leaderboard', 'marketing');

-- CreateEnum
CREATE TYPE "evaluation_state" AS ENUM ('pending', 'processing', 'completed', 'failed', 'manual_review');

-- CreateEnum
CREATE TYPE "leaderboard_status" AS ENUM ('opted_in', 'opted_out');

-- CreateEnum
CREATE TYPE "notification_state" AS ENUM ('pending', 'sent', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "payment_state" AS ENUM ('created', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded');

-- CreateEnum
CREATE TYPE "question_approval_status" AS ENUM ('draft', 'needs_review', 'approved', 'rejected', 'retired');

-- CreateEnum
CREATE TYPE "question_origin" AS ENUM ('pyq_reused', 'practice_reused', 'web_sourced', 'adapted', 'ai_generated');

-- CreateEnum
CREATE TYPE "question_pattern_confidence" AS ENUM ('confirmed', 'corroborated', 'unverified', 'product_default');

-- CreateEnum
CREATE TYPE "release_status" AS ENUM ('draft', 'validating', 'needs_review', 'approved', 'scheduled', 'published', 'superseded', 'retired');

-- CreateEnum
CREATE TYPE "release_type" AS ENUM ('weekly', 'monthly', 'practice_bank');

-- CreateEnum
CREATE TYPE "response_format" AS ENUM ('single_choice_mcq', 'multiple_select_mcq', 'subjective');

-- CreateEnum
CREATE TYPE "stem_form" AS ENUM ('standalone', 'scenario', 'shared_scenario_subitem');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('pending', 'active', 'expired', 'cancelled', 'suspended');

-- CreateEnum
CREATE TYPE "taxonomy_type" AS ENUM ('module', 'topic', 'concept');

-- CreateEnum
CREATE TYPE "trial_state" AS ENUM ('active', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('applicant', 'approved_trial_learner', 'paid_learner', 'expired_learner', 'content_editor', 'admin_publisher', 'public_leaderboard_viewer');

-- CreateEnum
CREATE TYPE "verification_state" AS ENUM ('verified', 'unverified', 'pending_review', 'rejected');

-- CreateTable
CREATE TABLE "academic_years" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "label" VARCHAR(50) NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_approvals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "decision" "approval_decision" NOT NULL,
    "reason" TEXT,

    CONSTRAINT "access_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_blueprints" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "version" INTEGER NOT NULL DEFAULT 1,
    "type" "assessment_type" NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "scoring_policy" JSONB NOT NULL,
    "section_configuration" JSONB NOT NULL,
    "status" "assessment_status" NOT NULL DEFAULT 'draft',

    CONSTRAINT "assessment_blueprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assessment_id" UUID NOT NULL,
    "section" VARCHAR(50) NOT NULL,
    "question_id" UUID NOT NULL,
    "passage_id" UUID,
    "item_order" INTEGER NOT NULL,
    "compulsory" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "assessment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assessment_id" VARCHAR(255) NOT NULL,
    "release_id" UUID,
    "course_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "blueprint_id" UUID NOT NULL,
    "type" "assessment_type" NOT NULL,
    "title" VARCHAR(255),
    "status" "assessment_status" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "release_id" UUID,
    "blueprint_id" UUID,
    "attempt_number" INTEGER NOT NULL,
    "seed" VARCHAR(255),
    "snapshot" JSONB,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6),
    "submitted_at" TIMESTAMPTZ(6),
    "state" "attempt_state" NOT NULL DEFAULT 'in_progress',

    CONSTRAINT "attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID,
    "action" VARCHAR(150) NOT NULL,
    "target_type" VARCHAR(100),
    "target_id" UUID,
    "before_data" JSONB,
    "after_data" JSONB,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "consent_type" "consent_type" NOT NULL,
    "policy_version" VARCHAR(50) NOT NULL,
    "accepted_at" TIMESTAMPTZ(6) NOT NULL,
    "withdrawn_at" TIMESTAMPTZ(6),
    "ip_address" INET,
    "user_agent" TEXT,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_releases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "release_id" VARCHAR(255) NOT NULL,
    "release_type" "release_type" NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "program_year" VARCHAR(20) NOT NULL,
    "week_number" INTEGER,
    "month_number" INTEGER,
    "version" INTEGER NOT NULL,
    "publish_at" TIMESTAMPTZ(6),
    "content_checksum" VARCHAR(255),
    "status" "release_status" NOT NULL DEFAULT 'draft',
    "notes_approval_status" VARCHAR(50),
    "assessment_approval_status" VARCHAR(50),
    "manifest" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archive_path" TEXT,

    CONSTRAINT "content_releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "program_year" VARCHAR(20) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "response_id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "state" "evaluation_state" NOT NULL DEFAULT 'pending',
    "score" DECIMAL(8,2),
    "rubric_breakdown" JSONB,
    "feedback" JSONB,
    "model_version" VARCHAR(100),
    "prompt_version" VARCHAR(100),
    "rubric_version" VARCHAR(100),
    "reasoning_effort" VARCHAR(100),
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "latency_ms" INTEGER,
    "answer_hash" VARCHAR(128),
    "normalized_answer_hash" VARCHAR(128),
    "error_message" TEXT,
    "reviewed_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_pattern_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rule_key" VARCHAR(150) NOT NULL,
    "rule_value" JSONB NOT NULL,
    "source" TEXT,
    "confidence" VARCHAR(50),
    "effective_cohort" VARCHAR(100),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "exam_pattern_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "handle" VARCHAR(100) NOT NULL,
    "status" "leaderboard_status" NOT NULL DEFAULT 'opted_out',

    CONSTRAINT "leaderboard_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_scores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "first_attempt_id" UUID,
    "best_attempt_id" UUID,
    "first_score" DECIMAL(8,2),
    "best_score" DECIMAL(8,2),

    CONSTRAINT "leaderboard_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "template" VARCHAR(100) NOT NULL,
    "event" VARCHAR(150) NOT NULL,
    "delivery_state" "notification_state" NOT NULL DEFAULT 'pending',
    "sent_at" TIMESTAMPTZ(6),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "stable_id" VARCHAR(255) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "course_id" UUID NOT NULL,
    "passage_text" TEXT NOT NULL,
    "source_lineage" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "passages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "razorpay_order_id" VARCHAR(255),
    "razorpay_payment_id" VARCHAR(255),
    "razorpay_signature" VARCHAR(512),
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "state" "payment_state" NOT NULL DEFAULT 'created',
    "idempotency_key" VARCHAR(255) NOT NULL,
    "raw_webhook_event" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "duration_months" INTEGER,
    "duration_years" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "question_id" VARCHAR(255) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "course_id" UUID NOT NULL,
    "concept_ids" JSONB DEFAULT '[]',
    "exam_role" VARCHAR(50) NOT NULL,
    "question_type" VARCHAR(100) NOT NULL,
    "response_format" "response_format" NOT NULL,
    "stem_form" "stem_form" NOT NULL,
    "shared_passage_id" UUID,
    "question_number" INTEGER,
    "prompt_markdown" TEXT NOT NULL,
    "options" JSONB NOT NULL DEFAULT '[]',
    "correct_option_ids" JSONB NOT NULL DEFAULT '[]',
    "explanation_markdown" TEXT,
    "directive_verbs" JSONB NOT NULL DEFAULT '[]',
    "marks" DECIMAL(6,2) NOT NULL,
    "sub_issues" JSONB NOT NULL DEFAULT '[]',
    "required_authority" JSONB NOT NULL DEFAULT '[]',
    "required_output" JSONB NOT NULL DEFAULT '[]',
    "assumptions_policy" VARCHAR(50),
    "rubric" JSONB NOT NULL DEFAULT '[]',
    "expected_answer_points" JSONB NOT NULL DEFAULT '[]',
    "origin" "question_origin" NOT NULL,
    "source_refs" JSONB NOT NULL DEFAULT '[]',
    "pattern_confidence" "question_pattern_confidence" NOT NULL,
    "approval_status" "question_approval_status" NOT NULL DEFAULT 'draft',
    "learner_badge" VARCHAR(100),
    "private_provenance" JSONB,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "responses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attempt_id" UUID NOT NULL,
    "assessment_item_id" UUID NOT NULL,
    "selected_option_ids" JSONB,
    "subjective_answer" TEXT,
    "assumptions" TEXT,
    "autosave_version" INTEGER NOT NULL DEFAULT 1,
    "last_autosaved_at" TIMESTAMPTZ(6),
    "submitted_at" TIMESTAMPTZ(6),

    CONSTRAINT "responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revision_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "stable_id" VARCHAR(255) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "release_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "markdown" TEXT NOT NULL,
    "taxonomy_node_id" UUID,

    CONSTRAINT "revision_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schema_migrations" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "applied_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_chunks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "private_chunk_id" VARCHAR(255) NOT NULL,
    "source_record_id" UUID NOT NULL,
    "locator" TEXT,
    "taxonomy_node_id" UUID,
    "chunk_text" TEXT NOT NULL,
    "text_hash" VARCHAR(128) NOT NULL,

    CONSTRAINT "source_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "private_source_id" VARCHAR(255) NOT NULL,
    "source_type" VARCHAR(100) NOT NULL,
    "source_subtype" VARCHAR(100),
    "publication_year" INTEGER,
    "authority" VARCHAR(255),
    "verification" "verification_state" NOT NULL DEFAULT 'pending_review',
    "rights_status" VARCHAR(100),
    "title" TEXT,
    "publisher" TEXT,
    "source_url" TEXT,
    "retrieval_timestamp" TIMESTAMPTZ(6),
    "locator" TEXT,
    "safe_citation" TEXT,
    "private_path" TEXT,
    "review_notes" TEXT,

    CONSTRAINT "source_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "payment_id" UUID,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "subscription_status" NOT NULL DEFAULT 'pending',

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taxonomy_nodes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "external_id" VARCHAR(255),
    "type" "taxonomy_type" NOT NULL,
    "canonical_name" VARCHAR(255) NOT NULL,
    "parent_id" UUID,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "taxonomy_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "state" "trial_state" NOT NULL DEFAULT 'active',

    CONSTRAINT "trials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "google_subject" VARCHAR(255) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "phone" VARCHAR(30),
    "role" "user_role" NOT NULL DEFAULT 'applicant',
    "account_state" "account_state" NOT NULL DEFAULT 'pending_approval',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "academic_years_label_key" ON "academic_years"("label");

-- CreateIndex
CREATE INDEX "idx_access_approvals_user" ON "access_approvals"("user_id");

-- CreateIndex
CREATE INDEX "idx_assessment_items_assessment" ON "assessment_items"("assessment_id");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_items_assessment_id_item_order_key" ON "assessment_items"("assessment_id", "item_order");

-- CreateIndex
CREATE UNIQUE INDEX "assessments_assessment_id_key" ON "assessments"("assessment_id");

-- CreateIndex
CREATE INDEX "idx_assessments_course" ON "assessments"("course_id");

-- CreateIndex
CREATE INDEX "idx_assessments_release" ON "assessments"("release_id");

-- CreateIndex
CREATE INDEX "idx_attempts_assessment" ON "attempts"("assessment_id");

-- CreateIndex
CREATE INDEX "idx_attempts_state" ON "attempts"("state");

-- CreateIndex
CREATE INDEX "idx_attempts_user" ON "attempts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "attempts_user_id_assessment_id_attempt_number_key" ON "attempts"("user_id", "assessment_id", "attempt_number");

-- CreateIndex
CREATE INDEX "idx_audit_events_actor" ON "audit_events"("actor_id");

-- CreateIndex
CREATE INDEX "idx_audit_events_created" ON "audit_events"("created_at");

-- CreateIndex
CREATE INDEX "idx_audit_events_target" ON "audit_events"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "idx_consents_user" ON "consents"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_releases_release_id_key" ON "content_releases"("release_id");

-- CreateIndex
CREATE INDEX "idx_content_releases_academic_year" ON "content_releases"("academic_year_id");

-- CreateIndex
CREATE INDEX "idx_content_releases_status" ON "content_releases"("status");

-- CreateIndex
CREATE UNIQUE INDEX "content_releases_release_id_version_key" ON "content_releases"("release_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "courses_code_key" ON "courses"("code");

-- CreateIndex
CREATE INDEX "idx_evaluations_attempt" ON "evaluations"("attempt_id");

-- CreateIndex
CREATE INDEX "idx_evaluations_response" ON "evaluations"("response_id");

-- CreateIndex
CREATE INDEX "idx_evaluations_state" ON "evaluations"("state");

-- CreateIndex
CREATE UNIQUE INDEX "exam_pattern_rules_rule_key_version_key" ON "exam_pattern_rules"("rule_key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_profiles_user_id_key" ON "leaderboard_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_profiles_handle_key" ON "leaderboard_profiles"("handle");

-- CreateIndex
CREATE INDEX "idx_leaderboard_scores_assessment" ON "leaderboard_scores"("assessment_id");

-- CreateIndex
CREATE INDEX "idx_leaderboard_scores_user" ON "leaderboard_scores"("user_id");

-- CreateIndex
CREATE INDEX "idx_leaderboard_scores_year" ON "leaderboard_scores"("academic_year_id");

-- CreateIndex
CREATE INDEX "idx_notifications_state" ON "notifications"("delivery_state");

-- CreateIndex
CREATE INDEX "idx_notifications_user" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "idx_passages_course" ON "passages"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "passages_stable_id_version_key" ON "passages"("stable_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "payments_razorpay_order_id_key" ON "payments"("razorpay_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_razorpay_payment_id_key" ON "payments"("razorpay_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "idx_payments_user" ON "payments"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE INDEX "idx_questions_course" ON "questions"("course_id");

-- CreateIndex
CREATE INDEX "idx_questions_passage" ON "questions"("shared_passage_id");

-- CreateIndex
CREATE INDEX "idx_questions_status" ON "questions"("approval_status");

-- CreateIndex
CREATE UNIQUE INDEX "questions_question_id_version_key" ON "questions"("question_id", "version");

-- CreateIndex
CREATE INDEX "idx_responses_attempt" ON "responses"("attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "responses_attempt_id_assessment_item_id_key" ON "responses"("attempt_id", "assessment_item_id");

-- CreateIndex
CREATE INDEX "idx_revision_notes_course" ON "revision_notes"("course_id");

-- CreateIndex
CREATE INDEX "idx_revision_notes_release" ON "revision_notes"("release_id");

-- CreateIndex
CREATE UNIQUE INDEX "revision_notes_stable_id_version_key" ON "revision_notes"("stable_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "schema_migrations_name_key" ON "schema_migrations"("name");

-- CreateIndex
CREATE UNIQUE INDEX "source_chunks_private_chunk_id_key" ON "source_chunks"("private_chunk_id");

-- CreateIndex
CREATE INDEX "idx_source_chunks_hash" ON "source_chunks"("text_hash");

-- CreateIndex
CREATE INDEX "idx_source_chunks_source" ON "source_chunks"("source_record_id");

-- CreateIndex
CREATE INDEX "idx_source_chunks_taxonomy" ON "source_chunks"("taxonomy_node_id");

-- CreateIndex
CREATE UNIQUE INDEX "source_records_private_source_id_key" ON "source_records"("private_source_id");

-- CreateIndex
CREATE INDEX "idx_subscriptions_status" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "idx_subscriptions_user" ON "subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "taxonomy_nodes_external_id_key" ON "taxonomy_nodes"("external_id");

-- CreateIndex
CREATE INDEX "idx_taxonomy_parent" ON "taxonomy_nodes"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "taxonomy_nodes_type_canonical_name_key" ON "taxonomy_nodes"("type", "canonical_name");

-- CreateIndex
CREATE INDEX "idx_trials_user" ON "trials"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_subject_key" ON "users"("google_subject");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_account_state" ON "users"("account_state");

-- CreateIndex
CREATE INDEX "idx_users_role" ON "users"("role");

-- AddForeignKey
ALTER TABLE "access_approvals" ADD CONSTRAINT "access_approvals_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "access_approvals" ADD CONSTRAINT "access_approvals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "assessment_items" ADD CONSTRAINT "assessment_items_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "assessment_items" ADD CONSTRAINT "assessment_items_passage_id_fkey" FOREIGN KEY ("passage_id") REFERENCES "passages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "assessment_items" ADD CONSTRAINT "assessment_items_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_blueprint_id_fkey" FOREIGN KEY ("blueprint_id") REFERENCES "assessment_blueprints"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "content_releases"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_blueprint_id_fkey" FOREIGN KEY ("blueprint_id") REFERENCES "assessment_blueprints"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "content_releases"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "content_releases" ADD CONSTRAINT "content_releases_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "responses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "leaderboard_profiles" ADD CONSTRAINT "leaderboard_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "leaderboard_scores" ADD CONSTRAINT "leaderboard_scores_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "leaderboard_scores" ADD CONSTRAINT "leaderboard_scores_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "leaderboard_scores" ADD CONSTRAINT "leaderboard_scores_best_attempt_id_fkey" FOREIGN KEY ("best_attempt_id") REFERENCES "attempts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "leaderboard_scores" ADD CONSTRAINT "leaderboard_scores_first_attempt_id_fkey" FOREIGN KEY ("first_attempt_id") REFERENCES "attempts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "leaderboard_scores" ADD CONSTRAINT "leaderboard_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "passages" ADD CONSTRAINT "passages_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_shared_passage_id_fkey" FOREIGN KEY ("shared_passage_id") REFERENCES "passages"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_assessment_item_id_fkey" FOREIGN KEY ("assessment_item_id") REFERENCES "assessment_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "revision_notes" ADD CONSTRAINT "revision_notes_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "revision_notes" ADD CONSTRAINT "revision_notes_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "content_releases"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "revision_notes" ADD CONSTRAINT "revision_notes_taxonomy_node_id_fkey" FOREIGN KEY ("taxonomy_node_id") REFERENCES "taxonomy_nodes"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "source_chunks" ADD CONSTRAINT "source_chunks_source_record_id_fkey" FOREIGN KEY ("source_record_id") REFERENCES "source_records"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "source_chunks" ADD CONSTRAINT "source_chunks_taxonomy_node_id_fkey" FOREIGN KEY ("taxonomy_node_id") REFERENCES "taxonomy_nodes"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "taxonomy_nodes" ADD CONSTRAINT "taxonomy_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "taxonomy_nodes"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "trials" ADD CONSTRAINT "trials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Prisma Schema Language does not represent these existing check constraints.
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_year_dates_valid" CHECK ("ends_at" > "starts_at");
ALTER TABLE "plans" ADD CONSTRAINT "plan_price_valid" CHECK ("price" >= 0);
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscription_dates_valid" CHECK ("ends_at" > "starts_at");
ALTER TABLE "trials" ADD CONSTRAINT "trial_dates_valid" CHECK ("ends_at" > "starts_at");
