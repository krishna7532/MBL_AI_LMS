'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildRows } = require('../services/leaderboardCalculations');

function attempt({
  userId = 'learner-1',
  assessmentId,
  type = 'weekly',
  score = 0,
  objectiveMax = 10,
  state = 'evaluated',
  submittedVia = 'manual',
  submittedAt = new Date('2026-10-30T00:00:00.000Z'),
  items = [],
  responses = [],
} = {}) {
  return {
    user_id: userId,
    assessment_id: assessmentId,
    attempt_number: 1,
    state,
    submitted_at: submittedAt,
    submitted_via: submittedVia,
    objective_score: score,
    objective_max_score: objectiveMax,
    assessments: {
      type,
      assessment_items: items.map((item) => ({
        id: item.id,
        questions: {
          response_format: item.responseFormat || 'mcq_single',
          marks: item.marks || 0,
        },
      })),
    },
    responses,
  };
}

function profile(userId, handle = userId) {
  return { user_id: userId, handle };
}

function subjectiveResponse({
  itemId = 'subjective-1',
  answer = 'An answer',
  state = 'completed',
  score = 6,
} = {}) {
  return {
    assessment_item_id: itemId,
    subjective_answer: answer,
    assessment_items: { questions: { response_format: 'subjective' } },
    evaluations: [{ state, score }],
  };
}

test('aggregates every eligible weekly assessment and calculates percentage from total marks', () => {
  const attempts = [
    attempt({ assessmentId: 'w1', score: 9, objectiveMax: 10 }),
    attempt({ assessmentId: 'w2', score: 1, objectiveMax: 100 }),
  ];

  const [row] = buildRows(attempts, [profile('learner-1', 'A')], 'weekly', 'best');
  assert.equal(row.assessmentCount, 2);
  assert.equal(row.score, 10);
  assert.equal(row.max, 110);
  assert.equal(row.percentage, 9.09);
});

test('monthly leaderboard uses multiple monthly assessments and excludes weekly marks', () => {
  const attempts = [
    attempt({ assessmentId: 'w1', type: 'weekly', score: 10, objectiveMax: 10 }),
    attempt({ assessmentId: 'm1', type: 'monthly', score: 9, objectiveMax: 10 }),
    attempt({ assessmentId: 'm2', type: 'monthly', score: 1, objectiveMax: 100 }),
  ];

  const [row] = buildRows(attempts, [profile('learner-1')], 'monthly', 'best');
  assert.equal(row.assessmentCount, 2);
  assert.equal(row.score, 10);
  assert.equal(row.max, 110);
  assert.equal(row.percentage, 9.09);
});

test('learners with only weekly or only monthly results appear only in that leaderboard', () => {
  const attempts = [
    attempt({ userId: 'weekly-only', assessmentId: 'w1', score: 8 }),
    attempt({ userId: 'monthly-only', assessmentId: 'm1', type: 'monthly', score: 7 }),
  ];
  const profiles = [profile('weekly-only'), profile('monthly-only')];

  assert.deepEqual(
    buildRows(attempts, profiles, 'weekly', 'best').map((row) => row.userId),
    ['weekly-only']
  );
  assert.deepEqual(
    buildRows(attempts, profiles, 'monthly', 'best').map((row) => row.userId),
    ['monthly-only']
  );
});

test('pending subjective evaluation excludes only that assessment, not as zero marks', () => {
  const attempts = [
    attempt({ assessmentId: 'w-complete', score: 8 }),
    attempt({
      assessmentId: 'w-pending',
      objectiveMax: 0,
      items: [{ id: 'subjective-1', responseFormat: 'subjective', marks: 10 }],
      responses: [subjectiveResponse({ state: 'pending', score: null })],
    }),
    attempt({
      userId: 'pending-only',
      assessmentId: 'w-pending-only',
      objectiveMax: 0,
      items: [{ id: 'subjective-1', responseFormat: 'subjective', marks: 10 }],
      responses: [subjectiveResponse({ state: 'processing', score: null })],
    }),
  ];

  const rows = buildRows(
    attempts,
    [profile('learner-1'), profile('pending-only')],
    'weekly',
    'best'
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].assessmentCount, 1);
  assert.equal(rows[0].score, 8);
});

test('subjective marks are included only after a completed evaluation', () => {
  const scored = attempt({
    assessmentId: 'monthly-subjective',
    type: 'monthly',
    objectiveMax: 0,
    items: [{ id: 'subjective-1', responseFormat: 'subjective', marks: 10 }],
    responses: [subjectiveResponse({ score: 6 })],
  });

  const [row] = buildRows([scored], [profile('learner-1')], 'monthly', 'best');
  assert.equal(row.score, 6);
  assert.equal(row.max, 10);
  assert.equal(row.percentage, 60);
});

test('incomplete and expired attempts are not ranked', () => {
  const attempts = [
    attempt({ assessmentId: 'in-progress', state: 'in_progress', score: 10 }),
    attempt({ assessmentId: 'expired', state: 'evaluated', submittedVia: 'automatic', score: 10 }),
    attempt({ assessmentId: 'not-submitted', state: 'evaluated', submittedAt: null, score: 10 }),
  ];

  assert.deepEqual(buildRows(attempts, [profile('learner-1')], 'weekly', 'best'), []);
});

test('equal percentages share a competition rank and sort by handle', () => {
  const attempts = [
    attempt({ userId: 'z-user', assessmentId: 'a', score: 5, objectiveMax: 10 }),
    attempt({ userId: 'a-user', assessmentId: 'b', score: 50, objectiveMax: 100 }),
    attempt({ userId: 'c-user', assessmentId: 'c', score: 4, objectiveMax: 10 }),
  ];

  const rows = buildRows(
    attempts,
    [profile('z-user', 'Zulu'), profile('a-user', 'Alpha'), profile('c-user', 'Charlie')],
    'weekly',
    'best'
  );
  assert.deepEqual(rows.map((row) => [row.alias, row.rank]), [
    ['Alpha', 1],
    ['Zulu', 1],
    ['Charlie', 3],
  ]);
});

test('zero maximum marks safely produces a zero percentage', () => {
  const rows = buildRows(
    [attempt({ assessmentId: 'zero', score: 0, objectiveMax: 0 })],
    [profile('learner-1')],
    'weekly',
    'best'
  );
  assert.equal(rows[0].max, 0);
  assert.equal(rows[0].percentage, 0);
});

test('first/best attempt choice counts one attempt per assessment', () => {
  const attempts = [
    attempt({ assessmentId: 'repeat', score: 4, objectiveMax: 10 }),
    { ...attempt({ assessmentId: 'repeat', score: 9, objectiveMax: 10 }), attempt_number: 2 },
  ];
  const profiles = [profile('learner-1')];

  const [first] = buildRows(attempts, profiles, 'weekly', 'first');
  const [best] = buildRows(attempts, profiles, 'weekly', 'best');
  assert.equal(first.assessmentCount, 1);
  assert.equal(first.score, 4);
  assert.equal(best.assessmentCount, 1);
  assert.equal(best.score, 9);
});
