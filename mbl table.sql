-- =========================================================
-- MBL-AI LMS DATABASE
-- PostgreSQL Schema
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- ENUM TYPES
-- =========================================================

CREATE TYPE user_role AS ENUM (
    'applicant',
    'approved_trial_learner',
    'paid_learner',
    'expired_learner',
    'content_editor',
    'admin_publisher',
    'public_leaderboard_viewer'
);

CREATE TYPE account_state AS ENUM (
    'pending_approval',
    'trial_active',
    'trial_expired',
    'paid_active',
    'paid_expired',
    'rejected',
    'suspended',
    'deleted'
);

CREATE TYPE consent_type AS ENUM (
    'terms',
    'privacy',
    'leaderboard',
    'marketing'
);

CREATE TYPE approval_decision AS ENUM (
    'approved',
    'rejected'
);

CREATE TYPE trial_state AS ENUM (
    'active',
    'expired',
    'cancelled'
);

CREATE TYPE subscription_status AS ENUM (
    'pending',
    'active',
    'expired',
    'cancelled',
    'suspended'
);

CREATE TYPE payment_state AS ENUM (
    'created',
    'authorized',
    'captured',
    'failed',
    'refunded',
    'partially_refunded'
);

CREATE TYPE taxonomy_type AS ENUM (
    'module',
    'topic',
    'concept'
);

CREATE TYPE verification_state AS ENUM (
    'verified',
    'unverified',
    'pending_review',
    'rejected'
);

CREATE TYPE release_type AS ENUM (
    'weekly',
    'monthly',
    'practice_bank'
);

CREATE TYPE release_status AS ENUM (
    'draft',
    'validating',
    'needs_review',
    'approved',
    'scheduled',
    'published',
    'superseded',
    'retired'
);

CREATE TYPE assessment_type AS ENUM (
    'weekly',
    'monthly',
    'practice'
);

CREATE TYPE assessment_status AS ENUM (
    'draft',
    'approved',
    'published',
    'retired'
);

CREATE TYPE question_origin AS ENUM (
    'pyq_reused',
    'practice_reused',
    'web_sourced',
    'adapted',
    'ai_generated'
);

CREATE TYPE question_pattern_confidence AS ENUM (
    'confirmed',
    'corroborated',
    'unverified',
    'product_default'
);

CREATE TYPE question_approval_status AS ENUM (
    'draft',
    'needs_review',
    'approved',
    'rejected',
    'retired'
);

CREATE TYPE response_format AS ENUM (
    'single_choice_mcq',
    'multiple_select_mcq',
    'subjective'
);

CREATE TYPE stem_form AS ENUM (
    'standalone',
    'scenario',
    'shared_scenario_subitem'
);

CREATE TYPE attempt_state AS ENUM (
    'in_progress',
    'submitted',
    'expired',
    'evaluation_pending',
    'evaluated',
    'cancelled'
);

CREATE TYPE evaluation_state AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'manual_review'
);

CREATE TYPE leaderboard_status AS ENUM (
    'opted_in',
    'opted_out'
);

CREATE TYPE notification_state AS ENUM (
    'pending',
    'sent',
    'failed',
    'cancelled'
);

-- =========================================================
-- 1. USERS
-- =========================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    google_subject VARCHAR(255) NOT NULL UNIQUE,

    name VARCHAR(150) NOT NULL,

    email VARCHAR(320) NOT NULL UNIQUE,

    phone VARCHAR(30),

    role user_role NOT NULL DEFAULT 'applicant',

    account_state account_state NOT NULL DEFAULT 'pending_approval',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_users_role
    ON users(role);

CREATE INDEX idx_users_account_state
    ON users(account_state);


-- =========================================================
-- 2. CONSENTS
-- =========================================================

CREATE TABLE consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    consent_type consent_type NOT NULL,

    policy_version VARCHAR(50) NOT NULL,

    accepted_at TIMESTAMPTZ NOT NULL,

    withdrawn_at TIMESTAMPTZ,

    ip_address INET,

    user_agent TEXT,

    -- created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consents_user
    ON consents(user_id);


-- =========================================================
-- 3. ACCESS APPROVALS
-- =========================================================

CREATE TABLE access_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id),

    admin_id UUID NOT NULL
        REFERENCES users(id),

    decision approval_decision NOT NULL,

    reason TEXT,

    -- created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_access_approvals_user
    ON access_approvals(user_id);


-- =========================================================
-- 4. TRIALS
-- =========================================================

CREATE TABLE trials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id),

    starts_at TIMESTAMPTZ NOT NULL,

    ends_at TIMESTAMPTZ NOT NULL,

    state trial_state NOT NULL DEFAULT 'active',

    -- created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT trial_dates_valid
        CHECK (ends_at > starts_at)
);

CREATE INDEX idx_trials_user
    ON trials(user_id);


-- =========================================================
-- 5. PLANS
-- =========================================================

CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code VARCHAR(50) NOT NULL UNIQUE,

    price NUMERIC(12,2) NOT NULL,

    currency CHAR(3) NOT NULL DEFAULT 'INR',

    duration_months INTEGER,

    duration_years INTEGER,

    active BOOLEAN NOT NULL DEFAULT TRUE,

     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT plan_price_valid
        CHECK (price >= 0)
);


-- =========================================================
-- 6. PAYMENTS
-- =========================================================

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id),

    razorpay_order_id VARCHAR(255) UNIQUE,

    razorpay_payment_id VARCHAR(255) UNIQUE,

    razorpay_signature VARCHAR(512),

    amount NUMERIC(12,2) NOT NULL,

    currency CHAR(3) NOT NULL DEFAULT 'INR',

    state payment_state NOT NULL DEFAULT 'created',

    idempotency_key VARCHAR(255) NOT NULL UNIQUE,

    raw_webhook_event JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_user
    ON payments(user_id);


-- =========================================================
-- 7. SUBSCRIPTIONS
-- =========================================================

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id),

    plan_id UUID NOT NULL
        REFERENCES plans(id),

    payment_id UUID
        REFERENCES payments(id),

    starts_at TIMESTAMPTZ NOT NULL,

    ends_at TIMESTAMPTZ NOT NULL,

    status subscription_status NOT NULL DEFAULT 'pending',

     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT subscription_dates_valid
        CHECK (ends_at > starts_at)
);

CREATE INDEX idx_subscriptions_user
    ON subscriptions(user_id);

CREATE INDEX idx_subscriptions_status
    ON subscriptions(status);


-- =========================================================
-- 8. ACADEMIC YEARS
-- =========================================================

CREATE TABLE academic_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- external_id VARCHAR(100) UNIQUE,

    label VARCHAR(50) NOT NULL UNIQUE,

    starts_at TIMESTAMPTZ NOT NULL,

    ends_at TIMESTAMPTZ NOT NULL,

    active BOOLEAN NOT NULL DEFAULT FALSE,

     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT academic_year_dates_valid
        CHECK (ends_at > starts_at)
);


-- =========================================================
-- 9. COURSES
-- =========================================================

CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code VARCHAR(50) NOT NULL UNIQUE,

    display_name VARCHAR(200) NOT NULL,

    program_year VARCHAR(20) NOT NULL,

    active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- 10. TAXONOMY NODES
-- =========================================================

CREATE TABLE taxonomy_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    external_id VARCHAR(255) UNIQUE,

    type taxonomy_type NOT NULL,

    canonical_name VARCHAR(255) NOT NULL,

    parent_id UUID
        REFERENCES taxonomy_nodes(id)
        ON DELETE SET NULL,

    aliases TEXT[] NOT NULL DEFAULT '{}',

     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(type, canonical_name)
);

CREATE INDEX idx_taxonomy_parent
    ON taxonomy_nodes(parent_id);


-- =========================================================
-- 11. SOURCE RECORDS
-- =========================================================

CREATE TABLE source_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    private_source_id VARCHAR(255) NOT NULL UNIQUE,

    source_type VARCHAR(100) NOT NULL,

    source_subtype VARCHAR(100),

    publication_year INTEGER,

    authority VARCHAR(255),

    verification verification_state NOT NULL DEFAULT 'pending_review',

    rights_status VARCHAR(100),

    title TEXT,

    publisher TEXT,

    source_url TEXT,

    retrieval_timestamp TIMESTAMPTZ,

    locator TEXT,

    safe_citation TEXT,

    private_path TEXT,

    review_notes TEXT,

     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- 12. SOURCE CHUNKS
-- =========================================================

CREATE TABLE source_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    private_chunk_id VARCHAR(255) NOT NULL UNIQUE,

    source_record_id UUID NOT NULL
        REFERENCES source_records(id)
        ON DELETE CASCADE,

    locator TEXT,

    taxonomy_node_id UUID
        REFERENCES taxonomy_nodes(id)
        ON DELETE SET NULL,

    chunk_text TEXT NOT NULL,

    text_hash VARCHAR(128) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_source_chunks_source
    ON source_chunks(source_record_id);

CREATE INDEX idx_source_chunks_taxonomy
    ON source_chunks(taxonomy_node_id);

CREATE INDEX idx_source_chunks_hash
    ON source_chunks(text_hash);


-- =========================================================
-- 13. EXAM PATTERN RULES
-- =========================================================

CREATE TABLE exam_pattern_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    rule_key VARCHAR(150) NOT NULL,

    rule_value JSONB NOT NULL,

    source TEXT,

    confidence VARCHAR(50),

    effective_cohort VARCHAR(100),

    version INTEGER NOT NULL DEFAULT 1,

    -- active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(rule_key, version)
);


-- =========================================================
-- 14. ASSESSMENT BLUEPRINTS
-- =========================================================

CREATE TABLE assessment_blueprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- code VARCHAR(100) NOT NULL,

    version INTEGER NOT NULL DEFAULT 1,

    type assessment_type NOT NULL,

    duration_minutes INTEGER NOT NULL,

    scoring_policy JSONB NOT NULL,

    section_configuration JSONB NOT NULL,

    status assessment_status NOT NULL DEFAULT 'draft',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(code, version)
);


-- =========================================================
-- 15. CONTENT RELEASES
-- =========================================================

CREATE TABLE content_releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    release_id VARCHAR(255) NOT NULL UNIQUE,

    release_type release_type NOT NULL,

    academic_year_id UUID NOT NULL
        REFERENCES academic_years(id),

    program_year VARCHAR(20) NOT NULL,

    week_number INTEGER,

    month_number INTEGER,

    version INTEGER NOT NULL,

    publish_at TIMESTAMPTZ,

    content_checksum VARCHAR(255),

    status release_status NOT NULL DEFAULT 'draft',

    notes_approval_status VARCHAR(50),

    assessment_approval_status VARCHAR(50),

    manifest JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(release_id, version)
);

CREATE INDEX idx_content_releases_academic_year
    ON content_releases(academic_year_id);

CREATE INDEX idx_content_releases_status
    ON content_releases(status);


-- =========================================================
-- 16. REVISION NOTES
-- =========================================================

CREATE TABLE revision_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    stable_id VARCHAR(255) NOT NULL,

    version INTEGER NOT NULL DEFAULT 1,

    release_id UUID NOT NULL
        REFERENCES content_releases(id),

    course_id UUID NOT NULL
        REFERENCES courses(id),

    markdown TEXT NOT NULL,

    taxonomy_node_id UUID
        REFERENCES taxonomy_nodes(id)
        ON DELETE SET NULL,

     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(stable_id, version)
);

CREATE INDEX idx_revision_notes_release
    ON revision_notes(release_id);

CREATE INDEX idx_revision_notes_course
    ON revision_notes(course_id);


-- =========================================================
-- 17. PASSAGES
-- =========================================================

CREATE TABLE passages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    stable_id VARCHAR(255) NOT NULL,

    version INTEGER NOT NULL DEFAULT 1,

    course_id UUID NOT NULL
        REFERENCES courses(id),

    passage_text TEXT NOT NULL,

    source_lineage JSONB NOT NULL DEFAULT '[]',

     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(stable_id, version)
);

CREATE INDEX idx_passages_course
    ON passages(course_id);


-- =========================================================
-- 18. PASSAGE ↔ TAXONOMY
-- =========================================================

CREATE TABLE passage_taxonomy (
    passage_id UUID NOT NULL
        REFERENCES passages(id)
        ON DELETE CASCADE,

    taxonomy_node_id UUID NOT NULL
        REFERENCES taxonomy_nodes(id)
        ON DELETE CASCADE,

    PRIMARY KEY(passage_id, taxonomy_node_id)
);


-- =========================================================
-- 19. QUESTIONS
-- =========================================================

CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    question_id VARCHAR(255) NOT NULL,

    version INTEGER NOT NULL DEFAULT 1,

    course_id UUID NOT NULL
        REFERENCES courses(id),

    concept_ids JSONB NULL DEFAULT '[]',

    exam_role VARCHAR(50) NOT NULL,

    question_type VARCHAR(100) NOT NULL,

    response_format response_format NOT NULL,

    stem_form stem_form NOT NULL,

    shared_passage_id UUID
        REFERENCES passages(id)
        ON DELETE SET NULL,

    question_number INTEGER,

    prompt_markdown TEXT NOT NULL,

    options JSONB NOT NULL DEFAULT '[]',

    correct_option_ids JSONB NOT NULL DEFAULT '[]',

    explanation_markdown TEXT,

    directive_verbs JSONB NOT NULL DEFAULT '[]',

    marks NUMERIC(6,2) NOT NULL,

    sub_issues JSONB NOT NULL DEFAULT '[]',

    required_authority JSONB NOT NULL DEFAULT '[]',

    required_output JSONB NOT NULL DEFAULT '[]',

    assumptions_policy VARCHAR(50),

    rubric JSONB NOT NULL DEFAULT '[]',

    expected_answer_points JSONB NOT NULL DEFAULT '[]',

    origin question_origin NOT NULL,

    source_refs JSONB NOT NULL DEFAULT '[]',

    pattern_confidence question_pattern_confidence NOT NULL,

    approval_status question_approval_status NOT NULL DEFAULT 'draft',

    learner_badge VARCHAR(100),

    private_provenance JSONB,

     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(question_id, version)
);

CREATE INDEX idx_questions_course
    ON questions(course_id);

CREATE INDEX idx_questions_passage
    ON questions(shared_passage_id);

CREATE INDEX idx_questions_status
    ON questions(approval_status);


-- =========================================================
-- 20. QUESTION ↔ TAXONOMY
-- =========================================================

CREATE TABLE question_taxonomy (
    question_id UUID NOT NULL
        REFERENCES questions(id)
        ON DELETE CASCADE,

    taxonomy_node_id UUID NOT NULL
        REFERENCES taxonomy_nodes(id)
        ON DELETE CASCADE,

    PRIMARY KEY(question_id, taxonomy_node_id)
);


-- =========================================================
-- 21. ASSESSMENTS
-- =========================================================

CREATE TABLE assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    assessment_id VARCHAR(255) NOT NULL UNIQUE,

    release_id UUID
        REFERENCES content_releases(id),

    course_id UUID NOT NULL
        REFERENCES courses(id),

    academic_year_id UUID NOT NULL
        REFERENCES academic_years(id),

    blueprint_id UUID NOT NULL
        REFERENCES assessment_blueprints(id),

    type assessment_type NOT NULL,

    title VARCHAR(255),

    status assessment_status NOT NULL DEFAULT 'draft',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assessments_course
    ON assessments(course_id);

CREATE INDEX idx_assessments_release
    ON assessments(release_id);


-- =========================================================
-- 22. ASSESSMENT ITEMS
-- =========================================================

CREATE TABLE assessment_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    assessment_id UUID NOT NULL
        REFERENCES assessments(id)
        ON DELETE CASCADE,

    section VARCHAR(50) NOT NULL,

    question_id UUID NOT NULL
        REFERENCES questions(id),

    passage_id UUID
        REFERENCES passages(id),

    item_order INTEGER NOT NULL,

    compulsory BOOLEAN NOT NULL DEFAULT TRUE,

     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(assessment_id, item_order)
);

CREATE INDEX idx_assessment_items_assessment
    ON assessment_items(assessment_id);


-- =========================================================
-- 23. ATTEMPTS
-- =========================================================

CREATE TABLE attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id),

    assessment_id UUID NOT NULL
        REFERENCES assessments(id),

    release_id UUID
        REFERENCES content_releases(id),

    blueprint_id UUID
        REFERENCES assessment_blueprints(id),

    attempt_number INTEGER NOT NULL,

    seed VARCHAR(255),

    snapshot JSONB,

    started_at TIMESTAMPTZ NOT NULL,

    expires_at TIMESTAMPTZ,

    submitted_at TIMESTAMPTZ,

    state attempt_state NOT NULL DEFAULT 'in_progress',

    -- mcq_score NUMERIC(8,2) DEFAULT 0,

    -- subjective_score NUMERIC(8,2) DEFAULT 0,

    -- total_score NUMERIC(8,2) DEFAULT 0,

    -- max_score NUMERIC(8,2),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, assessment_id, attempt_number)
);

CREATE INDEX idx_attempts_user
    ON attempts(user_id);

CREATE INDEX idx_attempts_assessment
    ON attempts(assessment_id);

CREATE INDEX idx_attempts_state
    ON attempts(state);


-- =========================================================
-- 24. RESPONSES
-- =========================================================

CREATE TABLE responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    attempt_id UUID NOT NULL
        REFERENCES attempts(id)
        ON DELETE CASCADE,

    assessment_item_id UUID NOT NULL
        REFERENCES assessment_items(id),

    selected_option_ids JSONB,

    subjective_answer TEXT,

    assumptions TEXT,

    autosave_version INTEGER NOT NULL DEFAULT 1,

    last_autosaved_at TIMESTAMPTZ,

    submitted_at TIMESTAMPTZ,

    -- score NUMERIC(8,2),

    reated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(attempt_id, assessment_item_id)
);

CREATE INDEX idx_responses_attempt
    ON responses(attempt_id);


-- =========================================================
-- 25. EVALUATIONS
-- =========================================================

CREATE TABLE evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    response_id UUID NOT NULL
        REFERENCES responses(id)
        ON DELETE CASCADE,

    attempt_id UUID NOT NULL
        REFERENCES attempts(id)
        ON DELETE CASCADE,

    state evaluation_state NOT NULL DEFAULT 'pending',

    score NUMERIC(8,2),

    rubric_breakdown JSONB,
    feedback JSONB,

    model_version VARCHAR(100),
    prompt_version VARCHAR(100),
    rubric_version VARCHAR(100),

    reasoning_effort VARCHAR(100),

    input_tokens INTEGER,
    output_tokens INTEGER,
    latency_ms INTEGER,

    answer_hash VARCHAR(128),
    normalized_answer_hash VARCHAR(128),

    error_message TEXT,

    reviewed_by UUID
        REFERENCES users(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_evaluations_response
    ON evaluations(response_id);

CREATE INDEX idx_evaluations_attempt
    ON evaluations(attempt_id);

CREATE INDEX idx_evaluations_state
    ON evaluations(state);


-- =========================================================
-- 26. LEADERBOARD PROFILES
-- =========================================================

CREATE TABLE leaderboard_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL UNIQUE
        REFERENCES users(id)
        ON DELETE CASCADE,

    handle VARCHAR(100) NOT NULL UNIQUE,

    status leaderboard_status NOT NULL DEFAULT 'opted_out',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- 27. LEADERBOARD SCORES
-- =========================================================

CREATE TABLE leaderboard_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id),

    academic_year_id UUID NOT NULL
        REFERENCES academic_years(id),

    assessment_id UUID NOT NULL
        REFERENCES assessments(id),

    first_attempt_id UUID
        REFERENCES attempts(id),

    best_attempt_id UUID
        REFERENCES attempts(id),

    first_score NUMERIC(8,2),

    best_score NUMERIC(8,2),

    max_score NUMERIC(8,2),

    score_type VARCHAR(50) NOT NULL,

    week_number INTEGER,

    month_number INTEGER,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leaderboard_scores_year
    ON leaderboard_scores(academic_year_id);

CREATE INDEX idx_leaderboard_scores_user
    ON leaderboard_scores(user_id);

CREATE INDEX idx_leaderboard_scores_assessment
    ON leaderboard_scores(assessment_id);


-- =========================================================
-- 28. NOTIFICATIONS
-- =========================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    template VARCHAR(100) NOT NULL,

    event VARCHAR(150) NOT NULL,

    delivery_state notification_state NOT NULL DEFAULT 'pending',

    -- payload JSONB,

    sent_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user
    ON notifications(user_id);

CREATE INDEX idx_notifications_state
    ON notifications(delivery_state);


-- =========================================================
-- 29. AUDIT EVENTS
-- =========================================================

CREATE TABLE audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    actor_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    action VARCHAR(150) NOT NULL,

    target_type VARCHAR(100),

    target_id UUID,

    before_data JSONB,

    after_data JSONB,

    reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_events_actor
    ON audit_events(actor_id);

CREATE INDEX idx_audit_events_target
    ON audit_events(target_type, target_id);

CREATE INDEX idx_audit_events_created
    ON audit_events(created_at);