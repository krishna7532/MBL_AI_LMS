'use strict';

require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const prisma = require('../config/db');
const exams = require('../services/examService');
const trials = require('../services/trialExpiryService');

const enabled = process.env.RUN_EXAM_DB_TESTS === '1';

test('Prisma exam workflow persists, scores, authorizes, and expires attempts', {
  skip: !enabled && 'Set RUN_EXAM_DB_TESTS=1 to run against the configured PostgreSQL database.',
}, async () => {
  let user;
  try {
    const [weekly, monthlies] = await Promise.all([
      prisma.assessments.findFirst({
        where: {
          type: 'weekly',
          status: 'approved',
          content_releases: { is: { release_type: 'weekly', status: 'published' } },
        },
        select: {
          id: true,
          assessment_items: {
            orderBy: { item_order: 'asc' },
            select: {
              id: true,
              questions: {
                select: {
                  response_format: true,
                  correct_option_ids: true,
                  options: true,
                },
              },
            },
          },
        },
      }),
      prisma.assessments.findMany({
        where: {
          type: 'monthly',
          status: 'approved',
          content_releases: { is: { release_type: 'monthly', status: 'published' } },
        },
        take: 2,
        select: {
          id: true,
          assessment_items: {
            orderBy: { item_order: 'asc' },
            select: {
              id: true,
              questions: {
                select: {
                  response_format: true,
                  correct_option_ids: true,
                  options: true,
                },
              },
            },
          },
        },
      }),
    ]);
    assert.ok(weekly && monthlies.length === 2, 'Published weekly and monthly test assessments are required.');

    user = await prisma.users.create({
      data: {
        google_subject: `exam-test-${randomUUID()}`,
        name: 'Temporary Exam Workflow Test',
        email: `exam-test-${randomUUID()}@example.invalid`,
        role: 'approved_trial_learner',
        account_state: 'active',
      },
      select: { id: true },
    });

    const weeklyAttempt = await exams.ensureAttempt(user.id, weekly.id, 'weekly');
    const weeklyAnswers = buildAnswers(weekly);
    await assert.rejects(
      exams.submitAttempt(user.id, weeklyAttempt.id, weekly.id, [
        { assessmentItemId: 'not-an-assessment-item', selectedOptionIds: ['A'] },
      ]),
      { code: 'INVALID_QUESTION' }
    );
    assert.equal((await exams.getAttempt(user.id, weeklyAttempt.id)).state, 'in_progress');

    await exams.saveResponses(user.id, weeklyAttempt.id, weekly.id, [weeklyAnswers[0]]);
    const restored = await exams.getAttempt(user.id, weeklyAttempt.id, weekly.id);
    assert.deepEqual(restored.savedResponses[weeklyAnswers[0].assessmentItemId].selectedOptionIds, weeklyAnswers[0].selectedOptionIds);

    const weeklySubmissions = await Promise.allSettled([
      exams.submitAttempt(user.id, weeklyAttempt.id, weekly.id, weeklyAnswers),
      exams.submitAttempt(user.id, weeklyAttempt.id, weekly.id, weeklyAnswers),
    ]);
    assert.equal(weeklySubmissions.filter((result) => result.status === 'fulfilled').length, 1);
    const weeklyResult = await exams.getAttemptResult(user.id, weeklyAttempt.id);
    assert.equal(weeklyResult.objective.earned, 2);
    assert.equal(weeklyResult.subjective.status, 'evaluation_pending');
    assert.equal(
      await prisma.responses.count({ where: { attempt_id: weeklyAttempt.id } }),
      weekly.assessment_items.length
    );
    const anotherLearner = await prisma.users.findFirst({
      where: { id: { not: user.id } },
      select: { id: true },
    });
    if (anotherLearner) {
      await assert.rejects(
        exams.getAttemptResult(anotherLearner.id, weeklyAttempt.id),
        { code: 'RESULT_NOT_FOUND' }
      );
    }

    const monthlyAttempt = await exams.ensureAttempt(user.id, monthlies[0].id, 'monthly');
    const monthlyAnswers = buildAnswers(monthlies[0]);
    const monthlySubmission = await exams.submitAttempt(
      user.id,
      monthlyAttempt.id,
      monthlies[0].id,
      monthlyAnswers
    );
    assert.equal(monthlySubmission.objectiveScore, 2);
    assert.equal((await exams.getAttemptResult(user.id, monthlyAttempt.id)).subjective.status, 'evaluation_pending');
    assert.ok((await exams.listResults(user.id)).some((result) =>
      result.id === monthlyAttempt.id && result.assessmentId === monthlies[0].id
    ));
    const retake = await exams.ensureAttempt(user.id, monthlies[0].id, 'monthly', {
      newAttempt: true,
    });
    assert.notEqual(retake.id, monthlyAttempt.id);
    assert.equal(
      (await exams.ensureAttempt(user.id, monthlies[0].id, 'monthly')).id,
      retake.id
    );

    const expiringAttempt = await exams.ensureAttempt(user.id, monthlies[1].id, 'monthly');
    await prisma.attempts.update({
      where: { id: expiringAttempt.id },
      data: { expires_at: new Date(Date.now() - 1000) },
    });
    await exams.expireDueAttempts();
    const automaticResult = await exams.getAttemptResult(user.id, expiringAttempt.id);
    assert.equal(automaticResult.submittedVia, 'automatic');
    assert.equal(automaticResult.state, 'expired');
    assert.equal(automaticResult.objective.earned, 0);
    await assert.rejects(
      exams.saveResponses(user.id, expiringAttempt.id, monthlies[1].id, []),
      { code: 'ATTEMPT_FINALIZED' }
    );

    const expiredAt = new Date(Date.now() - 1000);
    const trial = await prisma.trials.create({
      data: {
        user_id: user.id,
        starts_at: new Date(expiredAt.getTime() - 14 * 24 * 60 * 60 * 1000),
        ends_at: expiredAt,
      },
      select: { id: true },
    });
    await prisma.users.update({
      where: { id: user.id },
      data: { role: 'approved_trial_learner', account_state: 'trial_active' },
    });

    assert.deepEqual(await trials.expireDueTrials(new Date()), {
      trialsExpired: 1,
      usersExpired: 1,
    });
    const expiredUser = await prisma.users.findUnique({
      where: { id: user.id },
      select: { role: true, account_state: true },
    });
    assert.deepEqual(expiredUser, {
      role: 'expired_learner',
      account_state: 'trial_expired',
    });
    assert.equal(
      (await prisma.trials.findUnique({ where: { id: trial.id } })).state,
      'expired'
    );
    assert.deepEqual(await trials.expireDueTrials(new Date()), {
      trialsExpired: 0,
      usersExpired: 0,
    });
  } finally {
    if (user) {
      await prisma.trials.deleteMany({ where: { user_id: user.id } });
      const attempts = await prisma.attempts.findMany({
        where: { user_id: user.id },
        select: { id: true },
      });
      const attemptIds = attempts.map((attempt) => attempt.id);
      if (attemptIds.length) {
        await prisma.evaluations.deleteMany({ where: { attempt_id: { in: attemptIds } } });
        await prisma.responses.deleteMany({ where: { attempt_id: { in: attemptIds } } });
        await prisma.attempts.deleteMany({ where: { id: { in: attemptIds } } });
      }
      await prisma.users.delete({ where: { id: user.id } });
    }
    await prisma.$disconnect();
  }
});

function buildAnswers(assessment) {
  const mcqs = assessment.assessment_items.filter(
    (item) => item.questions.response_format !== 'subjective'
  );
  const subjective = assessment.assessment_items.find(
    (item) => item.questions.response_format === 'subjective'
  );
  const correctQuestion = mcqs[0];
  const incorrectQuestion = mcqs[1];
  const correctId = correctQuestion.questions.correct_option_ids[0];
  const wrongId = incorrectQuestion.questions.options.find(
    (option) => !incorrectQuestion.questions.correct_option_ids.includes(option.id)
  )?.id;
  const responses = [
    { assessmentItemId: correctQuestion.id, selectedOptionIds: [correctId] },
    { assessmentItemId: incorrectQuestion.id, selectedOptionIds: [wrongId] },
  ];
  if (subjective) {
    responses.push({
      assessmentItemId: subjective.id,
      subjectiveAnswer: 'A temporary integration-test answer.',
      assumptions: 'Temporary test assumption.',
    });
  }
  return responses;
}
