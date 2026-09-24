# MBL-AI — Consolidated Product Requirements Document

**Version:** 0.6 (consolidates PRD v0.5 and the approved exam-pattern patch)  
**Date:** 8 September 2026  
**Status:** Engineering-ready MVP specification  
**Product owner:** Lokap Sahu  
**Audience:** Full-stack engineering, product design, QA, content operations and legal review  
**Target:** Responsive web LMS deployed on Vercel  

---

## 1. Product definition

MBL-AI is a private, approval-only revision and assessment LMS for Master of Business Laws learners. It converts approved material from a separately maintained MBL knowledge base into concise weekly revision sprints, practice questions, full exam simulations, feedback and progress rankings.

Its core promise is:

> Stay exam-ready across five MBL courses in approximately 2.5 hours per week—one independent 30-minute revision sprint per course.

MBL-AI is a **revision platform, not a learning platform**. It assumes learners have attended or watched lectures and reviewed prescribed material. It does not replace classes, recordings, books, independent study or professional legal advice.

The product is independent and unofficial. It must not imply affiliation with or endorsement by NLSIU or PACE and must not use their logos, seals or official visual identity.

### 1.1 Product system boundary

The complete product has two connected environments:

1. **Private content system:** the local indexed MBL wiki and question bank used to retrieve, prepare, review and approve revision content. It may contain the historical archive, extracted chunks, source provenance, answer keys and rubrics.
2. **Hosted learner LMS:** the Vercel application used for authentication, entitlements, published revision notes, assessments, attempts, feedback, leaderboards and payments.

The hosted LMS must not ingest or expose the raw 1 GB archive. Only approved, versioned content releases move from the private content system to production.

### 1.2 Primary user

A working MBL learner who cannot reliably devote full weekends to revision and needs a small, repeatable routine tied to the concepts currently being taught.

### 1.3 Core learner outcome

Within each teaching week, the learner completes at least four of five course sprints, practises syllabus-bound questions, receives useful answer feedback and knows which concepts need revision.

---

## 2. Goals, success criteria and non-goals

### 2.1 MVP goals

1. Deliver five independent 30-minute course revision sprints per teaching week.
2. Match current weekly concepts to trustworthy PYQs and practice material before generating new questions.
3. Provide immediate MCQ explanations and concise AI-assisted subjective evaluation.
4. Provide a configurable 100-mark, three-hour exam simulation.
5. Preserve question provenance and display truthful learner-facing origin badges.
6. Create consent-based competitive motivation through anonymous leaderboards.
7. Restrict access through Google sign-in and manual admin approval.
8. Support a 14-day trial and upfront paid plans through Razorpay.
9. Keep the public application secure, low-cost and operable by a non-technical product owner.

### 2.2 Success metrics

- At least 20 price-aware approved users start the trial.
- At least 50% of trial starters complete four of five available weekly sprints.
- At least 8–10 users purchase after trial.
- At least 70% of active learners return in the following teaching week.
- Weekly content releases are published within the agreed content SLA.
- At least 90% of AI evaluations complete successfully without manual intervention.
- Zero false learner-facing PYQ claims in released content.

### 2.3 Reversal triggers

- Fewer than five paid conversions after the first complete trial cohort.
- Fewer than 25% of trial users complete four weekly sprints.
- Weekly releases miss the agreed SLA twice in one month.
- Manual content verification takes more time than the product can sustainably support.
- Material copyright, privacy or source-authenticity concerns cannot be resolved.

### 2.4 MVP non-goals

- Hosting, streaming or downloading lecture recordings.
- Uploading the full historical archive into the learner-facing application.
- In-browser transcription of lectures.
- Open-ended AI chat or a general-purpose AI legal tutor.
- Teaching legal concepts from first principles.
- Personalized curricula, adaptive learning paths or per-user question generation.
- Learner-uploaded study material.
- Live classes, forums, messaging or batch networking.
- Native Android or iOS applications.
- Monthly subscriptions or instalment billing.
- Guaranteed marks, examination results, employment or salary outcomes.
- Automated publication of unreviewed AI-generated legal content.

---

## 3. Launch scope and course taxonomy

### 3.1 Launch scope

The paid MVP launches with the five Year 1 courses. The database must support Year 2 without structural changes.

| Program year | Code | Course |
|---|---|---|
| Year 1 | C01 | Contract Law |
| Year 1 | C02 | Banking Law |
| Year 1 | C03 | Corporate Law |
| Year 1 | C04 | Industrial Relations Law |
| Year 1 | C05 | Environmental Law |
| Year 2 | C06 | Investment Laws |
| Year 2 | C07 | Insurance Laws |
| Year 2 | C08 | International Commercial Transactions & Foreign Trade |
| Year 2 | C09 | Intellectual Property Laws |
| Year 2 | C10 | Taxes on Corporations & Commodities |

Course codes are permanent identifiers even if display names later change.

### 3.2 Content hierarchy

`Program → Academic year → Program year → Course → Module → Topic → Concept`

The concept is the primary bridge between weekly teaching material and the question bank.

---

## 4. Roles and permissions

| Role/state | Capabilities |
|---|---|
| Applicant | Google sign-in, profile submission and policy consent; no protected content. |
| Approved trial learner | Access content published during the active 14-day trial; attempt assessments; optionally join leaderboards. |
| Paid learner | Access content within the purchased entitlement; view attempts, results and leaderboards. |
| Expired learner | View account, payment history and paywall; no protected content. |
| Content editor | Import draft releases, edit notes/questions, run validation and submit for approval; cannot publish. |
| Admin/publisher | All content-editor functions plus user approval, publication, correction, subscriptions and payment review. |
| Public leaderboard viewer | View alias-only rankings through the unlisted link; no course content or identity data. |

Server-side role checks are mandatory. Hiding controls in the UI is not authorization.

---

## 5. Key product decisions

### 5.1 Weekly sprint

Each teaching week contains five course sprints, normally assigned Monday–Friday. The weekday is a recommendation, not an access lock. Learners may complete published sprints in any order.

| Component | Target time | Requirement |
|---|---:|---|
| Revision notes | 15 minutes | Approved structured text tied to taught concepts. |
| MCQ practice | 10 minutes | Exactly 15 questions. |
| Subjective outline | 5 minutes | One 10-mark question. |
| Total | 30 minutes | Feedback review is outside the timing promise. |

Weekly MCQ scoring:

- Correct: `+2`
- Incorrect: `0`
- Unanswered: `0`
- Negative marking: `false`
- Weekly MCQ maximum: `30`
- Weekly subjective maximum: `10`
- Weekly course-sprint maximum: `40`
- Five-course weekly aggregate maximum: `200`

### 5.2 Monthly/full exam simulation

Every four published teaching weeks may unlock one separate simulation for each of the five courses. Each course simulation follows the structure below and lasts three hours. The five course simulations are completed independently; they are not one continuous 15-hour assessment.

| Section | Composition | Marks |
|---|---|---:|
| Part A | 5 shared passages × 5 linked MCQs × 2 marks | 50 |
| Part B | 3 compulsory scenario/application questions × 10 | 30 |
| Part C | 2 compulsory doctrinal/critical questions × 10 | 20 |
| Total | 30 compulsory response items | 100 |

Rules:

- Duration: 180 continuous minutes.
- Pause: not allowed.
- All questions are compulsory in the product simulation; there is no subjective choice.
- Correct MCQ: `+2`; wrong/unanswered: `0`; no negative marking.
- The timer is server-controlled. Closing the tab, disconnecting or changing device does not pause or reset it.
- Responses autosave. Reopening restores saved answers and remaining server time.
- At expiry, all saved answers are submitted automatically.
- The UI must state: **Simulation format configured for this revision platform; official pattern may change.**

The product configuration differs deliberately from the supplied June 2026 papers, which offered choice in Parts B and C. It must never be represented as an official rule.

### 5.3 Weekly subjective mix

Across a rolling course schedule, target approximately:

- 60% Part B-style scenario/application questions.
- 40% Part C-style doctrinal/critical questions.

The ratio is measured across released questions, not within a single sprint.

### 5.4 Cadence definitions

| Cadence | Learner experience | Required content |
|---|---|---|
| Daily placement | One recommended Monday–Friday course sprint; accessible in any order after publication | 15-minute notes + 15 MCQs + one subjective outline |
| Weekly package | Five course sprints, one per Year 1 course | 75 MCQs + five subjective questions + five note sets |
| Monthly package | Five independent three-hour course simulations | Per course: 25 MCQs + five subjective questions; across five courses: 125 MCQs + 25 subjective questions |

“Daily” describes scheduling and dashboard placement, not a separate daily content-generation pipeline. Content is prepared, approved and published as a weekly package; monthly simulations are separately versioned releases.

---

## 6. Source evidence and exam-pattern governance

### 6.1 Confirmed evidence supplied to the product

- The supplied PACE assessment screenshot states that the June 2027 annual assessment comprises 50 MCQ marks and 50 subjective marks and is subject to change.
- The three supplied June 2026 papers are 100-mark, three-hour annual summative examinations.
- Those papers present four Part B questions and require any three, and present three Part C questions and require any two; every subjective question is worth 10 marks.
- Printed instructions require correct question numbering, brief and logical writing, relevant case law and explicit disclosure of additional factual assumptions.

### 6.2 Unresolved rules

Until a verified official source is added, do not claim as fact:

- That there are no formative/internal assessments.
- The official Part A item count, passage architecture or marks per item.
- Any official negative marking rule.
- A mandatory time split, answer length/page count, delivery mode, exam centre or proctoring rule.

### 6.3 Pattern-rule record

Every exam-pattern statement must be stored as data with:

```text
source_type
source_label
source_reference
effective_cohort
confidence: confirmed | corroborated | unverified | product_default
last_verified_at
subject_to_change
is_current
```

Admin may create a new version of a blueprint without code deployment. Completed attempts remain pinned to their original blueprint and scoring-policy versions.

---

## 7. Learner journeys

### 7.1 Signup and approval

1. Learner selects **Continue with Google**.
2. Request only the minimum identity scopes for subject ID, name and email.
3. Learner supplies mandatory phone number.
4. Learner accepts the current Terms and Privacy Policy through separate unticked checkboxes.
5. Account enters `pending_approval`.
6. Admin approves or rejects the application.
7. Approval immediately starts the 14-day trial and sends exact start/expiry timestamps in IST.

### 7.2 Weekly revision

1. Learner opens Dashboard and chooses a published sprint.
2. Learner reads revision notes and marks notes complete.
3. Learner starts the 15-question MCQ set plus one subjective outline.
4. The server creates an attempt and immutable question-order snapshot.
5. Responses autosave.
6. Submission scores MCQs deterministically and queues subjective evaluation.
7. The result page shows the MCQ score immediately and subjective status.
8. When evaluation completes, the combined score, feedback and eligible leaderboard rank appear.
9. Learner may review sources badges and retake the same version.

### 7.3 Monthly simulation

1. Learner reads the exam instructions and confirms the uninterrupted timer.
2. Server creates a 180-minute attempt pinned to one blueprint and content version.
3. Learner completes five passage groups, three Part B questions and two Part C questions.
4. The UI warns about unanswered items and uncovered sub-parts but never reveals answers or rubrics before submission.
5. Submission or timer expiry locks the attempt.
6. MCQs score synchronously; five subjective answers are evaluated asynchronously, preferably in one structured batch when safe.
7. Final results show section scores, feedback by question and total out of 100.

### 7.4 Trial conversion

1. Trial lasts exactly 14 consecutive days from approval.
2. It unlocks only content whose `published_at` falls inside the learner's trial window.
3. At expiry, protected content is blocked and the paywall presents the two paid plans.
4. Paid access activates only after a verified server-side Razorpay event.

---

## 8. Learner experience requirements

### 8.1 Navigation

MVP learner navigation has four destinations:

1. **Dashboard** — weekly sprints and current completion states.
2. **Monthly Revision** — available exam simulations and practice banks.
3. **Leaderboard** — rankings, opt-in/withdrawal, handle and sharing link.
4. **Account** — identity, entitlement, payment history, policies and deletion request.

### 8.2 Dashboard

Display four teaching weeks and one Monthly Revision section. Each sprint card shows course, weekday, 30-minute structure, status, best score out of 40 and Start/Continue/Review/Retake action.

Required states:

`not_started | notes_completed | test_in_progress | evaluation_pending | completed`

The dashboard and each sprint display **Revision only—not a learning platform**.

### 8.3 Revision notes

- Render sanitized Markdown as structured text.
- Support headings, lists, tables, callouts and source-safe internal links.
- Do not provide raw source downloads in MVP.
- Display:

> This material assumes you have attended or watched the relevant lectures and reviewed prescribed material. It is designed for revision and assessment practice and does not teach the course from scratch.

- Display truthful authorship copy:

> AI-assisted revision material, manually prepared and/or reviewed by Lokap after attending lectures and reviewing available course material.

### 8.4 MCQ player

- Support standalone MCQs and shared-passage MCQs.
- A passage remains visible while navigating its linked questions.
- Every item has stable option IDs; option order does not change between attempts in MVP.
- A new attempt may randomize question order only. An active attempt retains its stored order after refresh or reconnect.
- Passage groups may be reordered; linked questions never detach from their passage.
- After submission show correct answer, a 2–3-line explanation and, when authored, why the tempting distractor is wrong.

### 8.5 Subjective editor

- Preserve question and sub-part numbering.
- Provide a main answer field and optional **Assumptions** field.
- Autosave drafts.
- Enforce configurable length limits server-side and show remaining allowance.
- Label feedback **AI-assisted indicative evaluation**.
- Do not reveal the rubric or expected answer before submission.

### 8.6 Full-simulation instructions

Before starting, display:

- Enter question and sub-part numbers correctly.
- Write briefly and logically.
- Cite relevant case law.
- Clearly state any additional factual assumptions.
- All configured questions in this simulation are compulsory.
- The three-hour timer continues if the learner leaves the page or loses connectivity.
- The configured simulation pattern may change when new official instructions are verified.

Do not display a mandatory page count or official section-wise time allocation.

---

## 9. Question and assessment specification

### 9.1 Weekly MCQ composition

Each weekly course sprint contains exactly 15 MCQs. Target mix:

- 5 concept questions.
- 7 application questions.
- 3 exception/trap questions.

Questions may be standalone or grouped under one or more shared scenarios. When source limitations force a deviation, record it in release validation and require admin acknowledgement.

### 9.2 Part B validity

A Part B question must contain a factual scenario and require at least one applied output: issue resolution, advice, rights/obligations, liability, remedy, calculation, comparison, procedure or likely outcome. Pure recall is invalid.

### 9.3 Part C validity

A Part C question must require doctrinal explanation, critical commentary, agree/disagree analysis, reconciliation, distinction or another reasoned position. A one-line definition is invalid for a 10-mark question. Require authority or illustrations where appropriate.

### 9.4 Question-source priority

Use the first suitable source in this order:

1. Verified local PYQ matching concept and current syllabus/legal context.
2. Verified local practice question.
3. Reputable, traceable external practice question found through targeted research.
4. Adapt an existing sourced question while retaining lineage.
5. Generate a new question grounded in approved indexed material.

Suitability checks include course, concept, taught depth, legal currency, difficulty, answer availability, format, authenticity, rights status, duplication and recent use.

AI-generated or adapted questions require human approval before learner release. Web-sourced material must store URL, title, publisher, retrieval timestamp, locator where possible, usage-rights status and verification state. Never copy restricted/paywalled question banks without permission.

### 9.5 Learner-facing origin badges

| Origin | Badge rule |
|---|---|
| Exact verified PYQ | `Past Year Question — <course>, <year>` |
| Adapted verified PYQ | `Adapted from PYQ — <course>, <year>` |
| Local practice | `Practice Question` |
| External source | `External Practice Question` |
| Newly generated | `AI-Generated` |

Only an authenticated past examination may receive an exact PYQ badge. Learners may see course and year. File paths, chunk IDs, page-level provenance, review notes and private source metadata remain admin-only.

### 9.6 Question data contract

```json
{
  "question_id": "MBL-Q-001294",
  "version": 1,
  "course_id": "C01",
  "concept_ids": ["consideration"],
  "exam_role": "part_a | part_b | part_c | weekly | practice_only",
  "question_type": "concept | application | exception_trap | scenario_advice | multi_party_liability | comparative_regime | computation_application | procedure_consequence | evidentiary_inference | doctrinal_explanation | critical_proposition | principle_reconciliation | distinction_process | other",
  "response_format": "single_choice_mcq | multiple_select_mcq | subjective",
  "stem_form": "standalone | scenario | shared_scenario_subitem",
  "shared_passage_id": null,
  "question_number": null,
  "prompt_markdown": "...",
  "options": [],
  "correct_option_ids": [],
  "explanation_markdown": null,
  "directive_verbs": [],
  "marks": 2,
  "sub_issues": [],
  "required_authority": [],
  "required_output": [],
  "assumptions_policy": "none_needed | disclose_if_used",
  "rubric": [],
  "expected_answer_points": [],
  "origin": "pyq_reused | practice_reused | web_sourced | adapted | ai_generated",
  "source_refs": [],
  "pattern_confidence": "confirmed | corroborated | unverified | product_default",
  "approval_status": "draft | needs_review | approved | rejected | retired"
}
```

Fields that do not apply remain null/empty; never fabricate values. MCQs require complete option IDs, answer IDs and explanation before approval. A subjective rubric must sum exactly to the question's marks.

### 9.7 Shared-passage contract

A passage is a versioned object with stable ID, course/concept tags, passage text, provenance and child question IDs. Each child MCQ retains its own answer, marks, explanation and response. The attempt stores both passage and question versions.

---

## 10. Subjective scoring and AI evaluation

### 10.1 Item-specific rubric

Each subjective item has an approved rubric totaling 10 marks. Do not impose universal IRAC weights or a page-count target. Criteria may include:

- Issue and sub-part coverage.
- Accurate and relevant rules, statutes, principles and case law.
- Application to supplied facts.
- Logical organization and responsiveness to directive verbs.
- Advice, remedy, comparison, calculation, procedure, outcome or reasoned conclusion.
- Clear disclosure of additional assumptions.

Do not award marks merely for answer length.

### 10.2 Evaluator input

The runtime evaluator receives only:

1. Question and sub-parts.
2. Approved rubric.
3. Approved expected-answer points and permitted authorities.
4. Learner answer and assumptions.

It must not receive the raw recording, entire wiki or unrestricted private archive at assessment time.

### 10.3 Evaluator output

Use a strict structured schema and render 4–5 concise feedback lines:

1. **Score:** X/10 with rubric breakdown.
2. **What you answered correctly:** …
3. **Where your answer went wrong or was incomplete:** …
4. **What you could have added:** …
5. **A stronger structure:** …

### 10.4 Safety, audit and failure behavior

- Treat learner text as untrusted data, not instructions.
- Reject attempts to obtain prompts, credentials, internal files or policy changes.
- Browser clients never call the model provider directly.
- Keep provider/model, reasoning effort, prompt version and token caps configurable server-side.
- Store returned model identifier, prompt/rubric versions, token usage, latency and answer hash.
- Cache identical evaluations by question version, normalized answer hash and evaluator-prompt version.
- If evaluation fails, retain the submitted attempt as `evaluation_pending`, show the MCQ score and retry through a queue.
- Do not publish a combined score or leaderboard update until required evaluations succeed or an admin records a reviewed score.
- Provide an admin re-evaluate/manual-review action with an audit entry; do not silently overwrite the original evaluation.

---

## 11. Private wiki and content-production integration

### 11.1 Responsibility boundary

The private wiki owns discovery, OCR/text extraction, chunking, taxonomy, retrieval, recurrence analysis, source provenance and draft generation. The LMS owns approved releases, delivery, attempts, scoring, feedback, access and billing.

The engineer may implement them in one repository, but production permissions and data stores must preserve this boundary.

### 11.2 Retrieval architecture

The private content system should use PostgreSQL as the metadata source of truth, with:

- VectorChord-BM25/compatible PostgreSQL BM25 capability for lexical retrieval.
- A supported vector extension for semantic retrieval.
- Metadata filters for program year, course, module, topic, concept, source type, publication year, approval and legal currency.
- Hybrid rank fusion, initially Reciprocal Rank Fusion unless evaluation demonstrates a better weighting.
- The LLM only after retrieval, using a small evidence set rather than the full corpus.

This retrieval stack is not exposed to anonymous or learner clients.

### 11.3 Weekly release workflow

1. Admin adds current transcript/PDF/PPTX/faculty notes to the private inbox. Videos are not indexed; only their transcripts are used.
2. The private pipeline classifies and indexes approved material.
3. System identifies taught course, module, topics and concepts.
4. System retrieves relevant approved source chunks and questions using the priority in §9.4.
5. System drafts revision notes, 15 MCQs, one subjective question, answers, explanations and rubric.
6. Content editor reviews sources, legal currency, difficulty, duplicate/recent use, badges and answer correctness.
7. Notes and assessment receive separate approvals.
8. Publisher generates an immutable release and imports/synchronizes it to the hosted LMS.
9. Production validates the release again before publication.

No generated content is auto-published.

### 11.4 Monthly release workflow

The system selects approved concepts taught during the relevant period, balances coverage and recurrence, then prepares the fixed simulation blueprint: five passage groups/25 MCQs, three Part B and two Part C questions. Admin reviews section totals, compulsory counts, provenance, rubrics and legal currency before release.

### 11.5 Release transport

MVP transport is a versioned ZIP uploaded through Admin, containing:

```text
manifest.json
notes/*.md
assessments/*.json
checksums.json
```

The archive contains no videos, raw recordings or unrestricted source documents. A later phase may replace upload with an authenticated publishing API.

### 11.6 Release lifecycle

`draft → validating → needs_review → approved → scheduled → published → superseded | retired`

Published releases are immutable. Corrections create a new version. Existing attempts remain attached to the version originally used. Admin may retire a defective version for new attempts without altering submitted attempts.

---

## 12. Admin requirements

### 12.1 Content operations

Admin can:

- Upload a release ZIP or JSON package.
- View schema, checksum, provenance and content-quality validation.
- Preview notes, passage groups, questions, answers, explanations and badges.
- Edit draft notes/questions and selectively regenerate items through the private content workflow.
- Approve notes separately from assessments.
- Schedule or publish a fully approved release.
- Retire a release or issue a corrected version.
- Inspect source references without exposing private paths to learners.

Blocking validation includes:

- Unique stable IDs and supported schema version.
- Valid course/week/academic-year references.
- Exactly five weekly course sprints and one Monday–Friday assignment each.
- Exactly 15 MCQs and one 10-mark subjective item per weekly sprint.
- Monthly blueprint totals 25 MCQs/50 marks, three Part B/30 marks and two Part C/20 marks.
- All monthly questions compulsory.
- MCQ answers and explanations complete.
- Subjective rubrics total 10.
- Origin badges consistent with verification/provenance.
- No executable HTML, scripts, raw secrets, private paths or unsupported binaries.
- Answer keys and rubrics tagged server-only.

### 12.2 Users and access

Admin can approve/reject/suspend users, inspect account state, view trial/subscription history and export a minimal user list. Admin cannot view passwords because authentication is OAuth-only.

### 12.3 Configuration

Without deployment, admin can version:

- Effective cohort and assessment date.
- Formative/internal-assessment note and confidence.
- Duration, pause behavior and section counts.
- Passage groups, items per passage, marks per item and negative marking.
- Standalone-MCQ allowance.
- Part B/Part C counts.
- Delivery mode or section timing if later verified.
- Source, confidence and last verification date for each pattern rule.
- AI model/prompt version and input/output caps.

Changing configuration creates a new version and never mutates completed attempts.

### 12.4 Audit log

Record actor, action, target, old/new version IDs, timestamp and reason for approval, publication, retirement, user-state changes, entitlement changes, manual scoring and payment adjustments.

---

## 13. Authentication, access and payments

### 13.1 Account states

`pending_approval → trial_active → trial_expired → paid_active → paid_expired`

Administrative states: `rejected | suspended | deleted`.

### 13.2 Trial

- Exactly 14 consecutive days from admin approval.
- Approval timestamp, start and end stored in UTC; learner copy rendered in IST.
- Trial unlocks only releases published during the trial interval.
- Content becomes inaccessible on expiry unless paid access activates.
- Trial cannot be reset by the learner.

### 13.3 Plans

| Plan | Price | Billing | Entitlement |
|---|---:|---|---|
| Annual | ₹20,000 | 100% upfront | 1 year from confirmed payment |
| Completion | ₹35,000 | 100% upfront | 5 years from confirmed payment |

MVP adds no GST line item; order totals are exactly ₹20,000 or ₹35,000. The contracting entity and tax position require confirmation before paid launch.

### 13.4 Refund disclosure

The 14-day trial is the evaluation period. After successful purchase, no voluntary/change-of-mind/prorated refund is offered, except where applicable law requires otherwise or a payment correction is necessary. Show this before payment and capture affirmative acknowledgement.

### 13.5 Razorpay

- Create orders server-side.
- Activate access only after signature-verified, idempotently processed webhook state.
- Never trust a client success callback as payment confirmation.
- Store gateway order/payment/refund identifiers, plan, amount, currency, status and timestamps; never store card/bank credentials.
- Send a receipt after confirmed payment and a tax invoice when legally required.
- No self-service refund workflow in MVP.

---

## 14. Leaderboards

### 14.1 Consent and privacy

- Participation is optional and configured only in the Leaderboard destination.
- Require a unique anonymous handle and a separate unticked consent checkbox.
- Real name, email, phone, answers and feedback never appear publicly.
- Withdrawal removes the learner from future/public ranking responses without deleting private attempt history.
- An opted-out learner may view the board but sees **Not participating** for personal rank.

### 14.2 Weekly leaderboard

After evaluation completes, show top three opted-in handles plus the current opted-in learner's rank. Filters:

- **This course:** best single-attempt score out of 40 for the selected course/week.
- **All five courses:** aggregate of counted scores across five weekly sprints, maximum 200; unattempted sprints contribute zero.

### 14.3 Cumulative leaderboard

- Alias-only, public to anyone with an unguessable link.
- Send `noindex, nofollow` and do not expose profile pages.
- Includes weekly scores out of 40 and monthly scores out of 100 within the active academic year.
- Filters: **First attempt** and **Best of all attempts**; best is default.
- Retakes never change first-attempt totals.
- Equal totals share rank; no speed tiebreaker.
- Monthly attempts affect cumulative rankings but never weekly rankings.
- Scores reset by academic year, not by deleting historical data.

---

## 15. Data model

Use PostgreSQL. UUIDs are recommended for application IDs; retain canonical MBL source IDs as unique external keys where applicable. Store timestamps in UTC.

| Entity | Essential fields/relationships |
|---|---|
| `users` | Google subject, name, email, phone, role, account state, timestamps. |
| `consents` | User, consent type, policy version, accepted/withdrawn timestamps, IP/user agent where lawful. |
| `access_approvals` | User, admin, decision, reason, timestamp. |
| `trials` | User, start, end, state. |
| `plans` | Code, price, currency, duration, active. |
| `subscriptions` | User, plan, start, end, status, payment. |
| `payments` | Razorpay IDs, amount, currency, state, idempotency key, timestamps. |
| `academic_years` | Label, start/end, active. |
| `courses` | Permanent code, display name, program year, active. |
| `taxonomy_nodes` | Module/topic/concept type, canonical name, parent and aliases. |
| `source_records` | Private source ID, type/subtype, year, authority, verification, rights and safe citation data. |
| `source_chunks` | Private chunk ID, source, locator, taxonomy, text hash and retrieval indexes. |
| `exam_pattern_rules` | Rule key/value, source/confidence/effective cohort, version metadata. |
| `assessment_blueprints` | Type, duration, scoring policy, section configuration, version and status. |
| `content_releases` | Week/month, academic year, version, checksum, approval/publication state and timestamps. |
| `revision_notes` | Release/course, Markdown, taxonomy and version. |
| `passages` | Stable ID/version, text, course/concepts, source lineage. |
| `questions` | Stable ID/version, schema fields in §9.6, learner-safe badge and private provenance. |
| `assessment_items` | Assessment, section, passage/question version, order and compulsory flag. |
| `attempts` | User, assessment/release/blueprint versions, number, seed/snapshot, start/expiry/submission, state. |
| `responses` | Attempt/item, option or subjective answer, assumptions, autosave version/timestamp. |
| `evaluations` | Response/attempt, rubric breakdown, feedback, model/prompt versions, audit metadata and state. |
| `leaderboard_profiles` | User, unique handle, public status. |
| `leaderboard_scores` | User, academic year, assessment ID, first/best attempt references and scores. |
| `notifications` | User, template, event, delivery state and timestamps. |
| `audit_events` | Actor, action, target, before/after references, reason and timestamp. |

### 15.1 Data isolation

- Put answer keys, explanations, rubrics, expected points and private source references in server-only tables/columns and response DTOs.
- Public leaderboard queries use a dedicated projection containing only handle, score and rank.
- Never serialize hidden answers into page HTML, React server payloads, static assets or pre-submission API responses.
- Learner APIs return only learner-safe origin badge data.

### 15.2 Version invariants

- An attempt references exact release, blueprint, scoring-policy, passage, question, rubric and evaluator-prompt versions.
- Published versions are immutable.
- A scoring/config change applies only to new attempts using the new blueprint.
- Historical scores are reproducible.

---

## 16. API/service contract

Exact route names may follow framework conventions; behavior is mandatory.

### 16.1 Learner APIs

| Operation | Requirement |
|---|---|
| Get session/profile | Return role, account state, entitlement and consent state. |
| Get dashboard | Return only releases accessible to the learner and progress summaries. |
| Get notes | Entitlement check; sanitized content; no private sources. |
| Start attempt | Idempotently create attempt, expiry and order snapshot; return no answers/rubrics. |
| Autosave response | Authenticate ownership; optimistic concurrency/idempotency; reject after lock. |
| Submit attempt | Atomically lock, score MCQs and queue subjective evaluation. |
| Get result | Return scores/explanations only after submission; feedback when evaluation succeeds. |
| Retake | Create a new immutable attempt; do not mutate prior attempt. |
| Get leaderboard | Return alias-only ranked projection; rate limited. |

### 16.2 Admin APIs

- Approve/reject/suspend user.
- Validate/import release.
- Preview/approve/schedule/publish/retire release.
- Read private provenance subject to role.
- Version pattern rules and blueprints.
- Retry or refer an evaluation for manual review.
- View payment/webhook health and entitlement state.

### 16.3 Webhooks and jobs

- Razorpay webhook: signature verified, raw body preserved, event ID idempotent.
- Evaluation job: at-least-once delivery safe; duplicate execution does not duplicate score effects.
- Publication job: changes scheduled release state atomically and sends email once.
- Trial/entitlement expiry: enforce from timestamps during every protected request; scheduled jobs improve messaging but are not the access-control mechanism.

---

## 17. Transactional email

Required templates:

1. Signup received / awaiting approval.
2. Approval with trial start and expiry.
3. Rejection when a user-facing reason is supplied.
4. Weekly content published.
5. Trial expired with plan choices.
6. Payment confirmed and access activated.
7. Payment failed/unconfirmed.
8. Refund/chargeback adjustment received where applicable.
9. Paid access nearing expiry and expired; cadence remains configurable.
10. Material policy update when required.

No marketing email without separate consent. Phone number is not used for automated SMS/WhatsApp notifications in MVP.

---

## 18. Design and accessibility

Use `pbakaus/impeccable` as a quality reference and create project-level `PRODUCT.md` and `DESIGN.md` before final UI implementation.

- Mobile-first and fully usable from 360 px width.
- Operate mode for application surfaces; Read mode for revision notes.
- One dominant action per state.
- Visible loading, empty, locked, pending-approval, payment-pending, evaluation-pending and error states.
- WCAG 2.1 AA contrast target, visible keyboard focus, full keyboard navigation and minimum 44×44 px touch targets.
- Respect reduced-motion preferences.
- Avoid decorative dashboard density, nested cards, bounce motion, purple-blue SaaS gradients and implied university branding.
- Passage and question navigation must remain usable on small screens without losing context.

### Screen inventory

Public/unapproved: landing/sign-in, profile/consent, pending, rejected, paywall, unlisted leaderboard.  
Learner: dashboard, notes, weekly attempt, weekly result, monthly list, monthly simulation, leaderboard, account.  
Admin: applicant queue, content import/validation/preview, pattern configuration, users/subscriptions/payments, evaluation review and audit log.

---

## 19. Security, privacy and reliability

### 19.1 Security

- OAuth state/nonce validation and secure, HttpOnly, SameSite cookies.
- HTTPS only; CSRF protection for state changes.
- Server-side RBAC and object-level ownership checks.
- Rate limits for authentication, attempts, evaluation, imports and public leaderboards.
- Strict schemas, upload limits, archive-bomb protection, MIME verification and sanitized Markdown.
- Parameterized queries and output escaping.
- Secrets only in server-side sensitive environment variables; never `NEXT_PUBLIC_*`, source code, API output or logs.
- Separate production and preview/development credentials and databases.
- Audit material administrative actions.
- Dependency scanning and secret scanning in CI.

### 19.2 Privacy

Collect only Google identity, phone, consent, progress, answers, scores, feedback, entitlement/payment metadata, security logs and support communications required to operate the service.

- Document processors: Google, Razorpay, Vercel/hosting, database, email and AI provider.
- Do not sell personal data or use it for unrelated marketing without consent.
- Configure the AI provider not to train on learner answers where the provider offers that control.
- Account deletion and leaderboard withdrawal must be available.
- Define retention periods, deletion SLA, grievance process, data region and cross-border processing before paid launch.
- Obtain Indian counsel review of Terms, Privacy, consumer/refund, tax and five-year-plan language.

### 19.3 Reliability

- Daily database backups and tested restoration before paid launch.
- Point-in-time recovery preferred for production.
- Attempt autosave resilient to retry and intermittent connectivity.
- Monitoring for authentication, payment webhooks, publication jobs, evaluation queue, timer expiry and error rates.
- Structured logs with correlation IDs and no answer keys, secrets or unnecessary personal data.
- Define RPO/RTO before production; initial target: RPO ≤24 hours, RTO ≤8 hours.

### 19.4 Performance targets

- p75 page interaction under 2.5 seconds on a typical mobile connection for cached learner pages.
- p95 non-AI API latency under 800 ms excluding uploads and third-party calls.
- Autosave acknowledgement under 1 second p95 under normal load.
- MCQ score returned within 2 seconds after submission.
- Subjective evaluation target under 60 seconds; asynchronous status required beyond 10 seconds.
- Support at least 250 concurrently active learners without architectural redesign; load-test actual launch target.

---

## 20. Recommended implementation architecture

The engineer may propose equivalents, but must preserve the requirements and isolation model.

- **Web/app:** Next.js with TypeScript on Vercel.
- **Authentication:** Auth.js or equivalent Google OAuth integration.
- **Application database:** managed PostgreSQL with migrations and connection pooling suitable for serverless workloads.
- **ORM/query layer:** Prisma, Drizzle or equivalent with explicit transactions.
- **Object storage:** private bucket for release archives; signed server-side access only.
- **Background jobs:** durable queue/workflow provider for AI evaluation, email and scheduled publication.
- **Email:** transactional provider selected before Phase 2.
- **Payments:** Razorpay Checkout and webhooks.
- **AI:** OpenAI Responses API or approved equivalent behind a provider abstraction; model configurable server-side.
- **Private retrieval:** PostgreSQL + BM25 + vector index in the private content environment.
- **Observability:** error tracking, structured logs, uptime and queue/webhook dashboards.

Do not assume Vercel's filesystem is persistent. Long-running indexing of the 1 GB archive remains outside serverless request handlers.

---

## 21. Content release schema

Minimum manifest:

```json
{
  "schema_version": "1.0",
  "release_id": "MBL-R-2026-W07-V1",
  "release_type": "weekly | monthly | practice_bank",
  "academic_year_id": "AY-2026",
  "program_year": "Y1",
  "week_number": 7,
  "version": 1,
  "publish_at": "2026-09-14T00:00:00Z",
  "content_checksum": "sha256:...",
  "courses": [],
  "pattern_rule_refs": [],
  "approval": {
    "notes": "approved",
    "assessment": "approved"
  }
}
```

For weekly releases, each course contains notes, exactly 15 MCQs and one subjective question. For a monthly course simulation, the assessment contains five passage groups/25 MCQs, three Part B and two Part C questions under a versioned blueprint.

Server-only fields include correct answers, explanations, rubrics, expected points, detailed provenance and evaluator configuration. Import may store them in the same signed package, but production APIs and client bundles must enforce separation.

---

## 22. Functional acceptance criteria

### Authentication and entitlement

- **AUTH-01:** Google OAuth is the only learner sign-in method.
- **AUTH-02:** New users cannot access protected content before admin approval.
- **AUTH-03:** Approval starts a 14-day trial immediately and communicates exact expiry.
- **AUTH-04:** Protected requests enforce state and entitlement server-side.
- **AUTH-05:** Trial access is based on publication timestamps within the trial window.

### Content and provenance

- **CONT-01:** Admin can validate, preview, approve and publish one immutable weekly release containing five course sprints.
- **CONT-02:** No raw recording or unrestricted archive file is uploaded to or exposed by the LMS.
- **CONT-03:** Corrections create new versions; prior attempts remain reproducible.
- **CONT-04:** Exact PYQ badges appear only when provenance is verified.
- **CONT-05:** Adapted, practice, external and AI-generated questions display distinct truthful badges.
- **CONT-06:** Notes and assessments require separate approval before publication.

### Weekly assessments

- **WEEK-01:** Every sprint contains 15 MCQs and one 10-mark subjective question.
- **WEEK-02:** MCQs score +2/0/0, maximum 30, with no negative marking.
- **WEEK-03:** Combined sprint score is out of 40.
- **WEEK-04:** New attempts may change only question presentation order; refresh retains the stored order.
- **WEEK-05:** Explanations are unavailable before submission and visible after submission.
- **WEEK-06:** Rolling subjective releases report progress against the 60/40 Part B/Part C target.

### Monthly simulation

- **MONTH-01:** Default simulation contains exactly five passages with five linked MCQs each.
- **MONTH-02:** It contains exactly three compulsory Part B and two compulsory Part C questions.
- **MONTH-03:** Totals equal 50 + 30 + 20 = 100 marks.
- **MONTH-04:** Timer lasts 180 minutes, is server-controlled and cannot pause.
- **MONTH-05:** Autosave survives refresh and timer expiry auto-submits saved responses.
- **MONTH-06:** UI clearly labels the structure as a product simulation subject to official change.
- **MONTH-07:** No choice-group or unselected-question behavior exists in the default blueprint.

### Evaluation

- **EVAL-01:** Every subjective rubric sums to 10.
- **EVAL-02:** Feedback detects omitted represented sub-issues and follows the required concise structure.
- **EVAL-03:** Learner text cannot override evaluator instructions or access internal data.
- **EVAL-04:** Failed jobs remain recoverable and do not publish incomplete combined scores.
- **EVAL-05:** Evaluation records preserve question, rubric, prompt and model versions.

### Leaderboards

- **LEAD-01:** Only opted-in aliases appear.
- **LEAD-02:** Weekly course rank uses best single-attempt score out of 40; weekly aggregate is out of 200.
- **LEAD-03:** Cumulative rank includes weekly and monthly scores within the academic year.
- **LEAD-04:** First-attempt totals never change after retakes; best-attempt totals may change.
- **LEAD-05:** Public APIs never expose identity, answers or feedback.
- **LEAD-06:** Withdrawal removes the public entry without deleting private attempts.

### Payments

- **PAY-01:** Trial expiry shows ₹20,000 annual and ₹35,000 five-year plans.
- **PAY-02:** Only a verified, idempotently processed server event activates paid access.
- **PAY-03:** Checkout shows final amount and captures no-voluntary-refund acknowledgement.
- **PAY-04:** No payment credentials are stored by the application.

### Security and QA

- **SEC-01:** Answer keys/rubrics are absent from pre-submission client traffic and static artifacts.
- **SEC-02:** Non-admin users cannot call admin endpoints or read private provenance.
- **SEC-03:** Import rejects invalid counts, marks, rubrics, badges, checksums and unsafe content.
- **SEC-04:** Automated tests cover payment-webhook replay, attempt races, timer expiry and evaluation retry.

---

## 23. Testing requirements

### Automated

- Unit tests for +2/0/0 scoring, section totals, rubric totals, badges and ranking formulas.
- Schema tests for weekly/monthly releases and invalid edge cases.
- Integration tests for OAuth state, entitlement, content import/publish, attempts, autosave, timer expiry, evaluation queue and Razorpay webhook idempotency.
- Authorization tests for every role and object boundary.
- Snapshot/version tests proving historical attempts do not change after corrections.
- End-to-end tests for signup-to-trial, weekly sprint, monthly simulation, payment activation and leaderboard withdrawal.
- Security test proving correct answers and rubrics are not shipped before submission.

### Manual release checklist

- Mobile and desktop critical paths.
- Keyboard-only navigation and screen-reader labels.
- Payment test mode and failed/pending paths.
- Slow/disconnected attempt recovery.
- Trial boundary timestamps in IST.
- Admin provenance/badge verification.
- AI feedback spot-check across strong, partial, irrelevant and prompt-injection answers.

---

## 24. Delivery plan

### Phase 0 — Foundation and contracts

- Confirm open decisions in §26.
- Finalize architecture, database schema, release schema and design system.
- Create environments, CI/CD, migrations, secrets and observability.
- Build a seed release for one course/week and a seed monthly simulation.

**Exit:** schemas validate; environments deploy; no learner functionality assumed complete.

### Phase 1 — Private prototype

- Google authentication and manual approval.
- Trial/access-state enforcement.
- Admin release upload, validation, preview and publication.
- Five weekly sprints, notes, MCQs, subjective evaluation and retakes.
- Weekly and cumulative alias-only leaderboards.
- Basic emails and static paywall.

**Exit:** invited test learners complete an end-to-end week; no live payment required.

### Phase 2 — Paid MVP and exam simulation

- Razorpay live integration and entitlements.
- Full monthly simulation with shared passages and server timer.
- Production evaluation queue and admin review.
- Account deletion, leaderboard withdrawal and complete transactional email.
- Counsel-approved Terms/Privacy/refund/tax copy.
- Backup restoration, security and load testing.

**Exit:** production readiness checklist passes and paid pilot is approved by product owner.

### Phase 3 — Content-system integration and operational scale

- Structured synchronization from the local wiki, initially through signed release packages.
- Retrieval evaluation set, recurrence analytics and content-quality dashboards.
- Duplicate/recent-use controls and richer editorial workflow.
- Year 2 course activation and additional cohorts only after MVP validation.

**Exit:** weekly releases can be produced and published reliably without direct engineering intervention.

---

## 25. Definition of done for the full-stack engineer

The MVP is done only when:

1. All Phase 1 and Phase 2 acceptance criteria pass in staging.
2. Database migrations and rollback instructions are committed.
3. Seed/admin setup and release-import documentation are complete.
4. All environment variables are documented without secret values.
5. Monitoring, backups and runbooks cover payment, publication, attempt and AI failures.
6. Product owner can approve a user, import/publish content, inspect a failed evaluation and verify a payment without code changes.
7. A learner can complete the entire signup → trial → weekly sprint → monthly simulation → result → payment journey on mobile.
8. A security review confirms no pre-submission answer leakage and no public identity leakage.
9. Legal launch blockers are signed off.
10. Production deployment is explicitly approved by the product owner; completing the code does not itself authorize launch.

---

## 26. Open decisions and launch blockers

| Decision | Needed by | Status |
|---|---|---|
| Contracting entity, address, support and grievance contacts | Before paid launch | Open |
| Database provider and data region | Phase 0 | Open |
| Transactional email provider | Phase 1 | Open |
| Durable background-job provider | Phase 0 | Open |
| Final weekly publication SLA | Phase 1 | Open |
| Answer/evaluator token and character caps | Prototype test | Open |
| Data-retention periods and deletion SLA | Before paid launch | Open |
| Paid-expiry reminder cadence | Phase 2 | Open |
| Final typeface, palette and brand system | Phase 0 | Open |
| Indian legal counsel approval | Before paid launch | Open |
| Rights/permission policy for historical and external questions | Before public/paid content release | Open |
| Official status of formative/internal assessments | Awaiting verified source | Unresolved; do not claim |
| Official Part A item structure/negative marking | Awaiting verified source | Product default only |

---

## 27. Superseded v0.5 requirements

This consolidated version explicitly replaces the following v0.5 rules:

| v0.5 rule | v0.6 rule |
|---|---|
| Weekly MCQ scoring +4/−1/0; weekly total 70 | +2/0/0; weekly total 40 |
| Monthly 50 MCQs + 10 subjective; total 300 | 25 passage-linked MCQs + 5 compulsory subjective; total 100 |
| Monthly subjective batch of ten | Five compulsory subjective items |
| Universal default 2/3/3/2 rubric | Item-specific rubric totaling 10 |
| Content creation fully outside LMS scope | Private wiki/content system plus controlled admin release workflow is part of the end-to-end product |
| Generic/static provenance notice only | Truthful per-question origin badges plus private detailed provenance |
| Monthly dashboard copy: 50 MCQs + 10 subjective | Five passages/25 MCQs + Part B three + Part C two |

All other v0.5 requirements remain in force where they do not conflict with this document. This v0.6 document is the single implementation source of truth.
