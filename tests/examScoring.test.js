'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreMcqResponses } = require('../services/examScoring');

function item(id, correctOptionIds, responseFormat = 'single_choice_mcq') {
  return {
    id,
    questions: {
      response_format: responseFormat,
      correct_option_ids: correctOptionIds,
    },
  };
}

test('weekly MCQs score +2 correct, 0 incorrect, and 0 unanswered', () => {
  const items = [
    item('correct', ['A']),
    item('incorrect', ['A']),
    item('unanswered', ['A']),
  ];
  const responses = new Map([
    ['correct', { selected_option_ids: ['A'] }],
    ['incorrect', { selected_option_ids: ['B'] }],
  ]);

  assert.deepEqual(
    scoreMcqResponses('weekly', {}, items, responses),
    {
      score: 2,
      maxScore: 6,
      results: [
        { itemId: 'correct', response: responses.get('correct'), correct: true, earned: 2 },
        { itemId: 'incorrect', response: responses.get('incorrect'), correct: false, earned: 0 },
        { itemId: 'unanswered', response: undefined, correct: false, earned: 0 },
      ],
    }
  );
});

test('monthly MCQ scoring is read from the database blueprint policy', () => {
  const items = [item('right', ['A']), item('wrong', ['B']), item('blank', ['C'])];
  const responses = new Map([
    ['right', { selected_option_ids: ['A'] }],
    ['wrong', { selected_option_ids: ['A'] }],
  ]);

  const result = scoreMcqResponses('monthly', {
    mcq_correct: 3,
    mcq_incorrect: -1,
    mcq_unanswered: 0,
  }, items, responses);

  assert.equal(result.score, 2);
  assert.equal(result.maxScore, 9);
  assert.throws(
    () => scoreMcqResponses('monthly', {}, items, responses),
    { code: 'SCORING_NOT_CONFIGURED', status: 503 }
  );
});

test('multiple-select MCQs require an exact matching option set', () => {
  const items = [item('multi', ['A', 'C'], 'multiple_select_mcq')];
  const exact = scoreMcqResponses('monthly', {
    mcq_correct: 2,
    mcq_incorrect: 0,
    mcq_unanswered: 0,
  }, items, new Map([['multi', { selected_option_ids: ['C', 'A'] }]]));
  const partial = scoreMcqResponses('monthly', {
    mcq_correct: 2,
    mcq_incorrect: 0,
    mcq_unanswered: 0,
  }, items, new Map([['multi', { selected_option_ids: ['A'] }]]));

  assert.equal(exact.score, 2);
  assert.equal(partial.score, 0);
});
