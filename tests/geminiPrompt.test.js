'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPrompt, getPromptTemplate } = require('../services/geminiPrompt');

test('prompt template displays placeholders instead of learner data', () => {
  const prompt = getPromptTemplate();

  assert.match(prompt, /\[Question text\]/);
  assert.match(prompt, /\[Student answer\]/);
  assert.match(prompt, /\[Expected answer point\]/);
  assert.match(prompt, /\[Criterion description\]/);
  assert.match(prompt, /"awarded_marks"/);
});

test('evaluation prompt inserts question-specific data', () => {
  const prompt = buildPrompt({
    promptMarkdown: 'Explain the principle.',
    maxMarks: 5,
    expected_answer_points: ['Legal authority'],
    rubric: [{ criterion: 'Accuracy', max_marks: 5, description: 'Correct legal rule' }],
    studentAnswer: 'A sample answer.',
    assumptions: null,
  });

  assert.match(prompt, /Explain the principle\./);
  assert.match(prompt, /MAXIMUM MARKS: 5/);
  assert.match(prompt, /Legal authority/);
  assert.match(prompt, /A sample answer\./);
  assert.doesNotMatch(prompt, /STUDENT ASSUMPTIONS/);
});
