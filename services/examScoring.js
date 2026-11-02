'use strict';

// Returns weekly constants or validates a monthly database scoring policy.
function scoringConfiguration(type, policy = {}) {
  if (type === 'weekly') {
    return { correct: 2, incorrect: 0, unanswered: 0 };
  }

  const correct = Number(policy.mcq_correct);
  const incorrect = Number(policy.mcq_incorrect);
  const unanswered = Number(policy.mcq_unanswered);
  if (![correct, incorrect, unanswered].every(Number.isFinite)) {
    const error = new Error('Monthly MCQ scoring is not configured for this assessment.');
    error.status = 503;
    error.code = 'SCORING_NOT_CONFIGURED';
    error.publicMessage = 'This assessment cannot be scored right now. Please try again later.';
    throw error;
  }
  return { correct, incorrect, unanswered };
}

// Extracts string option IDs from a JSON response value.
function selectedIds(value) {
  return Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [];
}

// Compares option selections without relying on their ordering.
function sameIds(left, right) {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((id, index) => id === sortedRight[index]);
}

// Scores objective responses and returns per-question correctness details.
function scoreMcqResponses(type, policy, items, responsesByItemId) {
  const scoring = scoringConfiguration(type, policy);
  let score = 0;
  let maxScore = 0;
  const results = [];

  for (const item of items) {
    const question = item.questions;
    if (question.response_format === 'subjective') continue;
    maxScore += scoring.correct;

    const response = responsesByItemId.get(item.id);
    const selected = selectedIds(response?.selected_option_ids);
    const correct = selected.length > 0 &&
      sameIds(selected, selectedIds(question.correct_option_ids));
    const earned = selected.length === 0
      ? scoring.unanswered
      : correct ? scoring.correct : scoring.incorrect;
    score += earned;
    results.push({ itemId: item.id, response, correct, earned });
  }

  return { score, maxScore, results };
}

module.exports = {
  scoreMcqResponses,
  scoringConfiguration,
};
