'use strict';

// Calculates total score and percentage for an attempt if it qualifies for leaderboard ranking
function scoreAttempt(attempt) {
  // Only fully evaluated, manually submitted attempts with valid objective scores qualify
  if (
    attempt.state !== 'evaluated' ||
    !attempt.submitted_at ||
    attempt.submitted_via !== 'manual' ||
    attempt.objective_score === null ||
    attempt.objective_max_score === null ||
    !Number.isFinite(Number(attempt.objective_score)) ||
    !Number.isFinite(Number(attempt.objective_max_score))
  ) {
    return null;
  }

  // Find all subjective questions in this assessment
  const assessmentItems = attempt.assessments.assessment_items;
  const subjectiveItems = assessmentItems.filter(
    (item) => item.questions.response_format === 'subjective'
  );
  const subjectiveScores = new Map();

  // Collect completed scores for each answered subjective question
  for (const response of attempt.responses) {
    if (
      response.assessment_items.questions.response_format !== 'subjective' ||
      !response.subjective_answer?.trim()
    ) {
      continue;
    }

    // Must have a completed evaluation with a valid numeric score
    const evaluation = response.evaluations.find(
      (item) =>
        item.state === 'completed' &&
        item.score !== null &&
        Number.isFinite(Number(item.score))
    );
    if (!evaluation) return null;
    subjectiveScores.set(response.assessment_item_id, Number(evaluation.score));
  }

  // If any answered subjective question is not yet scored, attempt is not ready for ranking
  const hasUnscoredSubjectiveAnswer = attempt.responses.some((response) =>
    response.assessment_items.questions.response_format === 'subjective' &&
    response.subjective_answer?.trim() &&
    !subjectiveScores.has(response.assessment_item_id)
  );
  if (hasUnscoredSubjectiveAnswer) return null;

  // Sum maximum marks and total earned marks (objective + subjective)
  const subjectiveMaximum = subjectiveItems.reduce(
    (total, item) => total + Number(item.questions.marks),
    0
  );
  const score = Number(attempt.objective_score) +
    [...subjectiveScores.values()].reduce((total, value) => total + value, 0);
  const max = Number(attempt.objective_max_score) + subjectiveMaximum;

  return {
    score,
    max,
    // Calculate rounded percentage up to 2 decimal places
    percentage: max > 0 ? Math.round((score / max) * 10000) / 100 : 0,
    attemptNumber: attempt.attempt_number,
    assessmentId: attempt.assessment_id,
  };
}

// Selects either the learner's first attempt or best attempt based on chosen mode
function selectAttempt(attempts, mode) {
  const eligible = attempts.map(scoreAttempt).filter(Boolean);
  if (!eligible.length) return null;

  // Sort chronologically by attempt number
  eligible.sort((left, right) => left.attemptNumber - right.attemptNumber);
  if (mode === 'first') return eligible[0];
  // Otherwise return attempt with the highest score
  return eligible.reduce((best, current) =>
    current.score > best.score ? current : best
  );
}

// Assigns ranks with standard competition ranking (equal percentages share the same rank)
function rankRows(rows) {
  // Sort descending by percentage, tie-breaking alphabetically by alias
  const sorted = [...rows].sort(
    (left, right) =>
      right.percentage - left.percentage ||
      left.alias.localeCompare(right.alias)
  );
  let previousPercentage = null;
  let rank = 0;

  return sorted.map((row, index) => {
    // Increment rank only when percentage changes
    if (row.percentage !== previousPercentage) {
      rank = index + 1;
      previousPercentage = row.percentage;
    }
    return { ...row, rank };
  });
}

// Builds aggregated leaderboard rows for opted-in learners
function buildRows(attempts, profiles, assessmentType, mode, userId) {
  // Map user IDs to public handles for learners who opted in
  const optedInProfiles = new Map(
    profiles.map((profile) => [profile.user_id, profile.handle])
  );
  const attemptsByLearner = new Map();

  // Group qualifying attempts by learner and assessment
  for (const attempt of attempts) {
    if (attempt.assessments.type !== assessmentType ||
        !optedInProfiles.has(attempt.user_id)) continue;
    if (!attemptsByLearner.has(attempt.user_id)) {
      attemptsByLearner.set(attempt.user_id, new Map());
    }
    const assessments = attemptsByLearner.get(attempt.user_id);
    if (!assessments.has(attempt.assessment_id)) {
      assessments.set(attempt.assessment_id, []);
    }
    assessments.get(attempt.assessment_id).push(attempt);
  }

  const rows = [];
  // Calculate aggregated scores across all assessments for each learner
  for (const [learnerId, assessments] of attemptsByLearner) {
    let score = 0;
    let max = 0;
    let assessmentCount = 0;
    for (const assessmentAttempts of assessments.values()) {
      const selected = selectAttempt(assessmentAttempts, mode);
      if (!selected) continue;
      score += selected.score;
      max += selected.max;
      assessmentCount += 1;
    }
    if (!assessmentCount) continue;
    rows.push({
      userId: learnerId,
      alias: optedInProfiles.get(learnerId),
      score,
      max,
      percentage: max > 0 ? Math.round((score / max) * 10000) / 100 : 0,
      assessmentCount,
      isMe: learnerId === userId,
    });
  }

  // Sort and apply rank numbers
  return rankRows(rows);
}

module.exports = { scoreAttempt, buildRows };
