'use strict';

require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');
const { _test } = require('../services/examService');

const items = [
  {
    id: 'mcq-item',
    questions: {
      response_format: 'single_choice_mcq',
      options: [{ id: 'A' }, { id: 'B' }],
    },
  },
  {
    id: 'written-item',
    questions: {
      response_format: 'subjective',
      options: [],
    },
  },
];

test('validates exam item and option membership before persistence', () => {
  assert.throws(
    () => _test.normalizeResponses([{ assessmentItemId: 'other', selectedOptionIds: ['A'] }], items, 'weekly'),
    { code: 'INVALID_QUESTION', status: 400 }
  );
  assert.throws(
    () => _test.normalizeResponses([{ assessmentItemId: 'mcq-item', selectedOptionIds: ['C'] }], items, 'weekly'),
    { code: 'INVALID_OPTION', status: 400 }
  );
  assert.throws(
    () => _test.normalizeResponses([{ assessmentItemId: 'mcq-item', selectedOptionIds: ['A', 'B'] }], items, 'weekly'),
    { code: 'TOO_MANY_OPTIONS', status: 400 }
  );
});

test('rejects duplicate question responses and overlong written answers', () => {
  assert.throws(
    () => _test.normalizeResponses([
      { assessmentItemId: 'mcq-item', selectedOptionIds: ['A'] },
      { assessmentItemId: 'mcq-item', selectedOptionIds: ['B'] },
    ], items, 'weekly'),
    { code: 'INVALID_QUESTION', status: 400 }
  );
  assert.throws(
    () => _test.normalizeResponses([
      { assessmentItemId: 'written-item', subjectiveAnswer: 'x'.repeat(3001) },
    ], items, 'weekly'),
    { code: 'ANSWER_TOO_LONG', status: 400 }
  );
});

test('normalizes valid MCQ and written answers without trusting client scores', () => {
  const result = _test.normalizeResponses([
    {
      assessmentItemId: 'mcq-item',
      selectedOptionIds: ['B'],
      correct: true,
      score: 999,
    },
    {
      assessmentItemId: 'written-item',
      subjectiveAnswer: 'My response',
      assumptions: 'Assumption',
    },
  ], items, 'weekly');

  assert.equal(result.length, 2);
  assert.deepEqual(result[0].selected_option_ids, ['B']);
  assert.equal(result[0].correct, undefined);
  assert.equal(result[0].score, undefined);
  assert.equal(result[1].subjective_answer, 'My response');
});
