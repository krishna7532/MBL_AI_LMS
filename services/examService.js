'use strict';

const prisma = require('../config/db');
const examScoring = require('./examScoring');
const { Prisma } = require('@prisma/client');

const MAX_RESPONSE_COUNT = 100;
const SCORING_RETRIES = 3;

// Creates an application error with an HTTP status and stable API code.
function examError(status, message, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.publicMessage = message;
  return error;
}

// Extracts valid selected-option strings from a database JSON value.
function selectedIdsFromJson(value) {
  return Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [];
}

// Validates and normalizes submitted responses against the assessment questions.
function normalizeResponses(input, assessmentItems, assessmentType) {
  if (!Array.isArray(input) || input.length > MAX_RESPONSE_COUNT) {
    throw examError(400, 'Responses must be an array with no more than 100 answers.', 'INVALID_RESPONSES');
  }

  const items = new Map(assessmentItems.map((item) => [item.id, item]));
  const seen = new Set();
  const maxAnswerLength = assessmentType === 'monthly' ? 4000 : 3000;
  const normalized = [];

  for (const entry of input) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw examError(400, 'Each response must be an object.', 'INVALID_RESPONSE');
    }
    const itemId = entry.assessmentItemId;
    if (typeof itemId !== 'string' || !items.has(itemId) || seen.has(itemId)) {
      throw examError(400, 'A response references an invalid or repeated exam question.', 'INVALID_QUESTION');
    }
    seen.add(itemId);

    const item = items.get(itemId);
    const question = item.questions;
    if (question.response_format === 'subjective') {

      if (entry.selectedOptionIds !== undefined &&
        (!Array.isArray(entry.selectedOptionIds) || entry.selectedOptionIds.length > 0)) {
        throw examError(400, 'Written questions cannot contain selected options.', 'INVALID_RESPONSE');
      }
      const answer = entry.subjectiveAnswer === undefined ? '' : entry.subjectiveAnswer;
      const assumptions = entry.assumptions === undefined ? '' : entry.assumptions;

      if (typeof answer !== 'string' || answer.length > maxAnswerLength ||
        typeof assumptions !== 'string' || assumptions.length > 500) {
        throw examError(400, 'The written answer or assumptions exceed the allowed length.', 'ANSWER_TOO_LONG');
      }
      normalized.push({
        assessment_item_id: itemId,
        selected_option_ids: Prisma.DbNull,
        subjective_answer: answer,
        assumptions,
      });
      continue;
    }

    const selected = entry.selectedOptionIds === undefined ? [] : entry.selectedOptionIds;
    if (!Array.isArray(selected) || selected.some((id) => typeof id !== 'string') ||
      new Set(selected).size !== selected.length) {
      throw examError(400, 'Selected options must be a list of unique option IDs.', 'INVALID_OPTIONS');
    }
    const options = Array.isArray(question.options) ? question.options : [];
    const optionIds = new Set(options.map((option) => String(option.id)));
    if (selected.some((id) => !optionIds.has(id))) {
      throw examError(400, 'A selected option does not belong to this question.', 'INVALID_OPTION');
    }
    if (question.response_format === 'single_choice_mcq' && selected.length > 1) {
      throw examError(400, 'Choose only one option for this question.', 'TOO_MANY_OPTIONS');
    }
    normalized.push({
      assessment_item_id: itemId,
      selected_option_ids: selected,
      subjective_answer: null,
      assumptions: null,
    });
  }
  return normalized;
}

// Loads an approved, published assessment and its learner-safe exam data.
async function findPublishedAssessment(tx, assessmentId, type) {
  return tx.assessments.findFirst({
    where: {
      id: assessmentId,
      type,
      status: 'approved',
      content_releases: {
        is: {
          release_type: type,
          status: 'published',
          ...(type === 'weekly' ? { publish_at: { lte: new Date() } } : {}),
        },
      },
      assessment_blueprints: { is: { type } },
    },
    select: {
      id: true,
      release_id: true,
      blueprint_id: true,
      type: true,
      title: true,
      assessment_blueprints: {
        select: {
          duration_minutes: true,
          scoring_policy: true,
          section_configuration: true,
        },
      },
      courses: { select: { display_name: true } },
      content_releases: {
        select: { week_number: true, month_number: true },
      },
      assessment_items: {
        orderBy: { item_order: 'asc' },
        select: {
          id: true,
          section: true,
          item_order: true,
          questions: {
            select: {
              id: true,
              question_number: true,
              response_format: true,
              options: true,
              correct_option_ids: true,
              marks: true,
              prompt_markdown: true,
            },
          },
        },
      },
    },
  });
}

// Computes the authoritative deadline from attempt or blueprint data.
function deadlineFor(attempt) {
  if (attempt.expires_at) return attempt.expires_at;
  const duration = attempt.assessment_blueprints?.duration_minutes;
  if (!duration || !attempt.started_at) {
    throw examError(503, 'The attempt timer is not configured.', 'TIMER_NOT_CONFIGURED');
  }
  return new Date(attempt.started_at.getTime() + duration * 60 * 1000);
}

// Retrieves an attempt and its assessment data for its owning learner.
async function fetchAttempt(tx, attemptId, userId) {
  return tx.attempts.findFirst({
    where: { id: attemptId, user_id: userId },
    select: {
      id: true,
      user_id: true,
      assessment_id: true,
      release_id: true,
      blueprint_id: true,
      attempt_number: true,
      started_at: true,
      expires_at: true,
      submitted_at: true,
      submitted_via: true,
      objective_score: true,
      objective_max_score: true,
      state: true,
      assessments: {
        select: {
          id: true,
          type: true,
          title: true,
          assessment_blueprints: {
            select: {
              duration_minutes: true,
              scoring_policy: true,
              section_configuration: true,
            },
          },
          courses: { select: { display_name: true } },
          content_releases: { select: { week_number: true, month_number: true } },
          assessment_items: {
            orderBy: { item_order: 'asc' },
            select: {
              id: true,
              section: true,
              item_order: true,
              questions: {
                select: {
                  id: true,
                  question_number: true,
                  response_format: true,
                  options: true,
                  correct_option_ids: true,
                  marks: true,
                  prompt_markdown: true,
                },
              },
            },
          },
        },
      },
      responses: {
        select: {
          id: true,
          assessment_item_id: true,
          selected_option_ids: true,
          subjective_answer: true,
          assumptions: true,
        },
      },
    },
  });
}

// Creates or updates one persisted answer in an attempt.
async function upsertResponse(tx, attemptId, entry, now) {
  const where = {
    attempt_id_assessment_item_id: {
      attempt_id: attemptId,
      assessment_item_id: entry.assessment_item_id,
    },
  };
  await tx.responses.upsert({
    where,
    create: {
      attempt_id: attemptId,
      ...entry,
      last_autosaved_at: now,
    },
    update: {
      selected_option_ids: entry.selected_option_ids,
      subjective_answer: entry.subjective_answer,
      assumptions: entry.assumptions,
      autosave_version: { increment: 1 },
      last_autosaved_at: now,
    },
  });
}

// Atomically saves responses, evaluates MCQs, and finalizes an attempt once.
async function finalizeAttempt(attemptId, userId, mode, submittedResponses, expectedAssessmentId) {
  for (let retry = 0; retry < SCORING_RETRIES; retry += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const attempt = await fetchAttempt(tx, attemptId, userId);
        if (!attempt) throw examError(404, 'Attempt not found.', 'ATTEMPT_NOT_FOUND');
        if (expectedAssessmentId && attempt.assessment_id !== expectedAssessmentId) {
          throw examError(404, 'Attempt not found for this assessment.', 'ATTEMPT_NOT_FOUND');
        }
        if (attempt.state !== 'in_progress') {
          throw examError(409, 'This attempt has already been submitted or expired.', 'ATTEMPT_FINALIZED');
        }

        const now = new Date();
        const expired = now >= deadlineFor(attempt);
        if (mode === 'automatic' && !expired) {
          throw examError(409, 'The exam deadline has not been reached.', 'ATTEMPT_NOT_EXPIRED');
        }
        const submissionMethod = mode === 'automatic' || expired ? 'automatic' : 'manual';
        const normalized = submissionMethod === 'manual'
          ? normalizeResponses(
            submittedResponses === undefined ? [] : submittedResponses,
            attempt.assessments.assessment_items,
            attempt.assessments.type
          )
          : [];

        const claim = await tx.attempts.updateMany({
          where: {
            id: attemptId,
            user_id: userId,
            state: 'in_progress',
            expires_at: submissionMethod === 'automatic' ? { lte: now } : { gt: now },
          },
          data: {
            state: 'submitted',
            submitted_at: now,
            submitted_via: submissionMethod,
          },
        });
        if (claim.count !== 1) {
          throw examError(409, 'This attempt has already been submitted or expired.', 'ATTEMPT_FINALIZED');
        }

        for (const entry of normalized) {
          await upsertResponse(tx, attemptId, entry, now);
        }

        const savedBeforeDefaults = await tx.responses.findMany({
          where: { attempt_id: attemptId },
          select: {
            id: true,
            assessment_item_id: true,
            selected_option_ids: true,
            subjective_answer: true,
            assumptions: true,
          },
        });
        const savedItemIds = new Set(
          savedBeforeDefaults.map((response) => response.assessment_item_id)
        );
        const unansweredItems = attempt.assessments.assessment_items.filter(
          (item) => !savedItemIds.has(item.id)
        );
        if (unansweredItems.length) {
          await tx.responses.createMany({
            data: unansweredItems.map((item) => ({
              attempt_id: attemptId,
              assessment_item_id: item.id,
              selected_option_ids: item.questions.response_format === 'subjective'
                ? Prisma.DbNull
                : [],
              subjective_answer: item.questions.response_format === 'subjective' ? '' : null,
              assumptions: item.questions.response_format === 'subjective' ? '' : null,
              submitted_at: now,
            })),
          });
        }
        const savedResponses = await tx.responses.findMany({
          where: { attempt_id: attemptId },
          select: {
            id: true,
            assessment_item_id: true,
            selected_option_ids: true,
            subjective_answer: true,
            assumptions: true,
          },
        });
        const responseByItem = new Map(savedResponses.map((response) => [
          response.assessment_item_id,
          response,
        ]));
        const objective = examScoring.scoreMcqResponses(
          attempt.assessments.type,
          attempt.assessments.assessment_blueprints.scoring_policy || {},
          attempt.assessments.assessment_items,
          responseByItem
        );
        let objectiveScore = objective.score;
        const objectiveMax = objective.maxScore;
        let pendingSubjective = 0;

        for (const item of attempt.assessments.assessment_items) {
          const question = item.questions;
          const response = responseByItem.get(item.id);
          //for blank subjective answer
          if (question.response_format === 'subjective') {
            const hasAnswer = Boolean(response?.subjective_answer?.trim());
            if (hasAnswer) {
              pendingSubjective += 1;
              await tx.evaluations.upsert({
                where: { response_id: response.id },
                create: {
                  response_id: response.id,
                  attempt_id: attemptId,
                  state: 'pending',
                },
                update: {
                  state: 'pending',
                  score: null,
                  error_message: null,
                  completed_at: null,
                  updated_at: now,
                },
              });
            }
            continue;
          }

          const mcqResult = objective.results.find((result) => result.itemId === item.id);
          if (response) {
            await tx.evaluations.upsert({
              where: { response_id: response.id },
              create: {
                response_id: response.id,
                attempt_id: attemptId,
                state: 'completed',
                score: mcqResult.earned,
                rubric_breakdown: { objective: true, correct: mcqResult.correct },
                completed_at: now,
              },
              update: {
                state: 'completed',
                score: mcqResult.earned,
                rubric_breakdown: { objective: true, correct: mcqResult.correct },
                error_message: null,
                completed_at: now,
                updated_at: now,
              },
            });
          }
        }

        await tx.responses.updateMany({
          where: { attempt_id: attemptId },
          data: { submitted_at: now },
        });
        const state = submissionMethod === 'automatic'
          ? 'expired'
          : pendingSubjective ? 'evaluation_pending' : 'evaluated';
        const updated = await tx.attempts.update({
          where: { id: attemptId },
          data: {
            state,
            objective_score: objectiveScore,
            objective_max_score: objectiveMax,
          },
          select: {
            id: true,
            state: true,
            submitted_at: true,
            submitted_via: true,
            objective_score: true,
            objective_max_score: true,
          },
        });

        return {
          attemptId: updated.id,
          state: updated.state,
          submittedAt: updated.submitted_at,
          submittedVia: updated.submitted_via,
          objectiveScore: Number(updated.objective_score),
          objectiveMaxScore: Number(updated.objective_max_score),
          evaluationStatus: pendingSubjective ? 'pending' : 'completed',
          resultUrl: `/results/${updated.id}`,
        };
      }, { isolationLevel: 'Serializable', timeout: 15000 });
    } catch (error) {
      if (error.code === 'P2034' && retry + 1 < SCORING_RETRIES) continue;
      throw error;
    }
  }
  throw examError(409, 'The attempt could not be finalized due to a concurrent update.', 'CONCURRENT_SUBMISSION');
}

// Resumes an active attempt or creates a new weekly/monthly attempt.
async function ensureAttempt(userId, assessmentId, expectedType, { newAttempt = false } = {}) {

  for (let retry = 0; retry < SCORING_RETRIES; retry += 1) {
    try {
      const attemptId = await prisma.$transaction(async (tx) => {
        const assessment = await findPublishedAssessment(tx, assessmentId, expectedType);
        if (!assessment) throw examError(404, 'Published assessment not found.', 'ASSESSMENT_NOT_FOUND');
        const duration = Number(assessment.assessment_blueprints.duration_minutes);
        if (!Number.isFinite(duration) || duration <= 0) {
          throw examError(503, 'The exam duration is not configured.', 'TIMER_NOT_CONFIGURED');
        }
        const existing = await tx.attempts.findFirst({
          where: { user_id: userId, assessment_id: assessmentId, state: 'in_progress' },
          orderBy: { attempt_number: 'desc' },
          select: { id: true, expires_at: true, started_at: true },
        });
        if (existing) return existing.id;

        const latest = await tx.attempts.findFirst({
          where: { user_id: userId, assessment_id: assessmentId },
          orderBy: { attempt_number: 'desc' },
          select: { id: true, attempt_number: true, state: true },
        });
        if (latest && !newAttempt) return latest.id;
        const now = new Date();
        return (await tx.attempts.create({
          data: {
            user_id: userId,
            assessment_id: assessment.id,
            release_id: assessment.release_id,
            blueprint_id: assessment.blueprint_id,
            attempt_number: (latest?.attempt_number || 0) + 1,
            started_at: now,
            expires_at: new Date(now.getTime() + duration * 60 * 1000),
            state: 'in_progress',
          },
          select: { id: true },
        })).id;
      }, { isolationLevel: 'Serializable', timeout: 10000 });

      const attempt = await fetchAttempt(prisma, attemptId, userId);
      if (!attempt) throw examError(404, 'Attempt not found.', 'ATTEMPT_NOT_FOUND');
      if (attempt.state === 'in_progress' && new Date() >= deadlineFor(attempt)) {
        await finalizeAttempt(attempt.id, userId, 'automatic', []);
        return getAttempt(userId, attempt.id);
      }
      return getAttempt(userId, attempt.id);
    } catch (error) {
      if ((error.code === 'P2034' || error.code === 'P2002') && retry + 1 < SCORING_RETRIES) continue;
      throw error;
    }
  }
  throw examError(409, 'Could not start or resume the exam because of a concurrent request.', 'CONCURRENT_START');
}

// Maps a database attempt into the response shape used by exam pages.
function toAttemptView(attempt) {
  const responses = {};
  for (const response of attempt.responses) {
    responses[response.assessment_item_id] = {
      selectedOptionIds: selectedIdsFromJson(response.selected_option_ids),
      subjectiveAnswer: response.subjective_answer || '',
      assumptions: response.assumptions || '',
    };
  }
  return {
    id: attempt.id,
    assessmentId: attempt.assessment_id,
    type: attempt.assessments.type,
    state: attempt.state,
    startedAt: attempt.started_at,
    expiresAt: deadlineFor({
      ...attempt,
      assessment_blueprints: attempt.assessments.assessment_blueprints,
    }),
    durationMinutes: attempt.assessments.assessment_blueprints.duration_minutes,
    savedResponses: responses,
    objectiveScore: attempt.objective_score === null ? null : Number(attempt.objective_score),
    objectiveMaxScore: attempt.objective_max_score === null ? null : Number(attempt.objective_max_score),
    submittedAt: attempt.submitted_at,
    submittedVia: attempt.submitted_via,
    resultUrl: `/results/${attempt.id}`,
    autosaveUrl: `/api/${attempt.assessments.type === 'weekly' ? 'weekly-sprints' : 'monthly-simulations'}/${attempt.assessment_id}/attempts/${attempt.id}/autosave`,
    submitUrl: `/api/${attempt.assessments.type === 'weekly' ? 'weekly-sprints' : 'monthly-simulations'}/${attempt.assessment_id}/attempts/${attempt.id}/submit`,
  };
}

// Loads one attempt after confirming that it belongs to the learner.
async function getAttempt(userId, attemptId, expectedAssessmentId) {
  const attempt = await fetchAttempt(prisma, attemptId, userId);
  if (!attempt) throw examError(404, 'Attempt not found.', 'ATTEMPT_NOT_FOUND');
  if (expectedAssessmentId && attempt.assessment_id !== expectedAssessmentId) {
    throw examError(404, 'Attempt not found for this assessment.', 'ATTEMPT_NOT_FOUND');
  }
  return toAttemptView(attempt);
}

// Validates and persists answer drafts while the attempt deadline is open.
async function saveResponses(userId, attemptId, expectedAssessmentId, input) {
  const attempt = await fetchAttempt(prisma, attemptId, userId);
  if (!attempt) throw examError(404, 'Attempt not found.', 'ATTEMPT_NOT_FOUND');
  if (attempt.assessment_id !== expectedAssessmentId) {
    throw examError(404, 'Attempt not found for this assessment.', 'ATTEMPT_NOT_FOUND');
  }
  if (attempt.state !== 'in_progress') {
    throw examError(409, 'This attempt is no longer accepting answers.', 'ATTEMPT_FINALIZED');
  }
  if (new Date() >= deadlineFor({
    ...attempt,
    assessment_blueprints: attempt.assessments.assessment_blueprints,
  })) {
    await finalizeAttempt(attemptId, userId, 'automatic', [], expectedAssessmentId);
    throw examError(409, 'The deadline passed; the attempt was automatically submitted.', 'ATTEMPT_EXPIRED');
  }
  const responses = normalizeResponses(
    input,
    attempt.assessments.assessment_items,
    attempt.assessments.type
  );
  let savedAt;
  await prisma.$transaction(async (tx) => {
    const now = new Date();
    savedAt = now;
    const lock = await tx.attempts.updateMany({
      where: {
        id: attemptId,
        user_id: userId,
        state: 'in_progress',
        expires_at: { gt: now },
      },
      data: { expires_at: attempt.expires_at },
    });
    if (lock.count !== 1) {
      throw examError(409, 'The attempt is no longer accepting answers.', 'ATTEMPT_FINALIZED');
    }
    if (new Date() >= deadlineFor({
      ...attempt,
      assessment_blueprints: attempt.assessments.assessment_blueprints,
    })) {
      throw examError(409, 'The deadline passed; the attempt no longer accepts answers.', 'ATTEMPT_EXPIRED');
    }
    for (const response of responses) {
      await upsertResponse(tx, attemptId, response, now);
    }
  }, { isolationLevel: 'Serializable', timeout: 10000 });
  return { attemptId, savedAt, savedCount: responses.length };
}

// Finalizes an attempt using the learner's submitted response payload.
async function submitAttempt(userId, attemptId, expectedAssessmentId, responses) {
  return finalizeAttempt(attemptId, userId, 'manual', responses, expectedAssessmentId);
}

// Finalizes an expired attempt using only responses already saved in the database.
async function autoSubmitAttempt(userId, attemptId, expectedAssessmentId) {
  return finalizeAttempt(attemptId, userId, 'automatic', [], expectedAssessmentId);
}

// Lists a bounded batch of attempts whose persisted deadline has passed.
async function listDueAttempts(now = new Date(), take = 100) {
  return prisma.attempts.findMany({
    where: {
      state: 'in_progress',
      expires_at: { lte: now },
    },
    orderBy: { expires_at: 'asc' },
    take,
    select: { id: true, user_id: true },
  });
}

// Automatically submits all currently expired attempts.
async function expireDueAttempts() {
  const due = await listDueAttempts(new Date());
  const outcomes = await Promise.allSettled(
    due.map((attempt) => autoSubmitAttempt(attempt.user_id, attempt.id))
  );
  const failures = outcomes.filter((outcome) => outcome.status === 'rejected' &&
    !['ATTEMPT_FINALIZED'].includes(outcome.reason?.code));
  if (failures.length) {
    throw new AggregateError(failures.map((failure) => failure.reason), 'One or more expired exam attempts could not be finalized.');
  }
  return outcomes.length;
}

// Builds a detailed result for a submitted attempt owned by the learner.
async function getAttemptResult(userId, attemptId) {
  const attempt = await prisma.attempts.findFirst({
    where: { id: attemptId, user_id: userId, submitted_at: { not: null } },
    select: {
      id: true,
      assessment_id: true,
      attempt_number: true,
      started_at: true,
      submitted_at: true,
      submitted_via: true,
      state: true,
      objective_score: true,
      objective_max_score: true,
      assessments: {
        select: {
          type: true,
          title: true,
          assessment_blueprints: { select: { section_configuration: true } },
          courses: { select: { display_name: true } },
          content_releases: { select: { week_number: true, month_number: true } },
          assessment_items: {
            select: {
              section: true,
              questions: { select: { response_format: true, marks: true } },
            },
          },
        },
      },
      evaluations: {
        select: {
          state: true,
          score: true,
          feedback:true,
          rubric_breakdown:true,
          responses: {
            select: {
              assessment_items: {
                select: { questions: { 
                  select:{
                      response_format: true,
                      marks:true,
                      question_number:true,
                      prompt_markdown:true,
                     } } },
              },
            },
          },
        },
      },
    },
  });
  if (!attempt) throw examError(404, 'Submitted result not found.', 'RESULT_NOT_FOUND');

  const subjectiveItems = attempt.assessments.assessment_items.filter(
    (item) => item.questions.response_format === 'subjective'
  );
  const subjectiveEvaluations = attempt.evaluations.filter((evaluation) =>
    evaluation.responses.assessment_items.questions.response_format === 'subjective'
  );
  const pendingEvaluations = subjectiveEvaluations.filter((evaluation) =>
    evaluation.state !== 'completed'
  ).length;
  const subjectiveEarned = subjectiveEvaluations.reduce(
    (total, evaluation) => total + (evaluation.score === null ? 0 : Number(evaluation.score)),
    0
  );
  const subjectiveMax = subjectiveItems.reduce(
    (total, item) => total + Number(item.questions.marks),
    0
  );
  const evaluationComplete = pendingEvaluations === 0;
  // Formats completed subjective evaluations and feedback for learner result display
  const subjectiveFeedback=subjectiveEvaluations.filter((ev)=>ev.state==='completed'||ev.state==='manual_review')
  .map((ev)=>{
    const q=ev.responses.assessment_items.questions;
    const fb=ev.feedback && typeof ev.feedback==='object'?ev.feedback:{};
    return {
      questionNumber:q.question_number,
      promptPreview:q.prompt_markdown.slice(0,200),
      score:ev.score===null?null:Number(ev.score),
      maxMarks:Number(q.marks),
      state:ev.state,
      summary:typeof fb.summary==='string'?fb.summary:'',
      strengths: Array.isArray(fb.strengths) ? fb.strengths : [],
      missingPoints: Array.isArray(fb.missingPoints) ? fb.missingPoints : [],
      incorrectPoints: Array.isArray(fb.incorrectPoints) ? fb.incorrectPoints : [],
      criterionMarks: Array.isArray(ev.rubric_breakdown) ? ev.rubric_breakdown : [],
      requiresHumanReview: ev.state === 'manual_review',
    };
  });
  const objectiveEarned = Number(attempt.objective_score || 0);
  const objectiveMax = Number(attempt.objective_max_score || 0);
  const totalMax = attempt.assessments.assessment_items.reduce(
    (total, item) => total + Number(item.questions.marks),
    0
  );

  return {
    id: attempt.id,
    assessmentId: attempt.assessment_id,
    isDatabaseResult: true,
    attemptNumber: attempt.attempt_number,
    kind: attempt.assessments.type,
    title: attempt.assessments.title,
    courseName: attempt.assessments.courses.display_name,
    weekNumber: attempt.assessments.content_releases?.week_number,
    month: attempt.assessments.content_releases?.month_number,
    submittedAt: attempt.submitted_at,
    submittedVia: attempt.submitted_via,
    state: attempt.state,
    objective: { earned: objectiveEarned, max: objectiveMax },
    subjective: {
      earned: evaluationComplete ? subjectiveEarned : null,
      max: subjectiveMax,
      status: evaluationComplete ? 'evaluated' : 'evaluation_pending',
      pendingCount: pendingEvaluations,
    },
    total: {
      earned: evaluationComplete ? objectiveEarned + subjectiveEarned : objectiveEarned,
      max: evaluationComplete ? totalMax : objectiveMax,
      provisional: !evaluationComplete,
    },
    subjectiveFeedback,
  };
}

// Lists recent submitted results and summarizes their evaluation state.
async function listResults(userId, limit) {
  const attempts = await prisma.attempts.findMany({
    where: { user_id: userId, submitted_at: { not: null } },
    orderBy: { submitted_at: 'desc' },
    ...(limit === undefined ? {} : { take: limit }),
    select: {
      id: true,
      assessment_id: true,
      attempt_number: true,
      submitted_at: true,
      state: true,
      objective_score: true,
      objective_max_score: true,
      assessments: {
        select: {
          type: true,
          title: true,
          courses: { select: { display_name: true } },
          content_releases: { select: { week_number: true, month_number: true } },
          assessment_items: {
            select: { questions: { select: { response_format: true, marks: true } } },
          },
        },
      },
      evaluations: {
        select: {
          state: true,
          score: true,
          responses: {
            select: {
              assessment_items: {
                select: { questions: { select: { response_format: true } } },
              },
            },
          },
        },
      },
    },
  });
  return attempts.map((attempt) => {
    const subjectiveMax = attempt.assessments.assessment_items.reduce((total, item) =>
      item.questions.response_format === 'subjective' ? total + Number(item.questions.marks) : total, 0);
    const subjectiveEvaluations = attempt.evaluations.filter((evaluation) =>
      evaluation.responses.assessment_items.questions.response_format === 'subjective'
    );
    const pending = subjectiveEvaluations.some((evaluation) => evaluation.state !== 'completed');
    const subjectiveScore = subjectiveEvaluations.reduce((total, evaluation) =>
      total + (evaluation.score === null ? 0 : Number(evaluation.score)), 0);
    const objective = Number(attempt.objective_score || 0);
    return {
      id: attempt.id,
      assessmentId: attempt.assessment_id,
      _id: attempt.id,
      title: attempt.assessments.title || attempt.assessments.courses.display_name,
      kind: attempt.assessments.type,
      courseName: attempt.assessments.courses.display_name,
      weekNumber: attempt.assessments.content_releases?.week_number,
      month: attempt.assessments.content_releases?.month_number,
      attemptNumber: attempt.attempt_number,
      submittedAt: attempt.submitted_at,
      earned: pending ? objective : objective + subjectiveScore,
      max: pending ? Number(attempt.objective_max_score || 0) :
        Number(attempt.objective_max_score || 0) + subjectiveMax,
      evaluationPending: pending,
    };
  });
}

// Periodically finalizes expired attempts and reports worker failures.
function startExpiryWorker({ intervalMs = 15000, onError = console.error } = {}) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await expireDueAttempts();
    } catch (error) {
      onError('Expired exam attempt processing failed:', error);
    } finally {
      running = false;
    }
  };
  const interval = setInterval(tick, intervalMs);
  interval.unref();
  tick();
  return () => clearInterval(interval);
}

module.exports = {
  autoSubmitAttempt,
  ensureAttempt,
  expireDueAttempts,
  getAttempt,
  getAttemptResult,
  listDueAttempts,
  listResults,
  saveResponses,
  startExpiryWorker,
  submitAttempt,
  _test: { normalizeResponses },
};
