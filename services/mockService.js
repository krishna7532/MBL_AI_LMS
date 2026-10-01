'use strict';

/**
 * STAGE 1 — MOCK DATA BOUNDARY.
 *
 * Controllers only talk to this module. Stage 2 replaces each function with a real
 * service backed by PostgreSQL and server-side entitlement checks, without touching
 * the controllers or views.
 *
 * Learner-safe contract (PRD §15.1): anything returned for a page that a learner can
 * open BEFORE submitting an attempt must never include correct answers, explanations,
 * rubrics or private provenance. `publicMcq()` and `publicSubjective()` enforce that.
 */

const d = require('./mockData');
const renderMarkdown = require('./markdown');
const adminQueries = require('../query/adminQueries');

const COURSE_IDS = ['C01', 'C02', 'C03', 'C04', 'C05'];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Standard competition ranking: equal scores share a rank (PRD §14.3). */
function rankRows(rows, scoreKey) {
  const sorted = [...rows].sort((a, b) => b[scoreKey] - a[scoreKey] || a.alias.localeCompare(b.alias));
  let lastScore = null;
  let lastRank = 0;
  return sorted.map((row, idx) => {
    if (row[scoreKey] !== lastScore) { lastRank = idx + 1; lastScore = row[scoreKey]; }
    return { ...row, rank: lastRank };
  });
}

function hash(str) {
  let h = 7;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 9973;
  return h;
}

function findCourse(id) {
  return d.courses.find((c) => c._id === id) || null;
}

// ── Users / session context ──────────────────────────────────────────────────

exports.getLearner = () => d.demoUser;
exports.getAdminUser = () => d.adminUser;
exports.getUnreadCount = () => d.notifications.filter((n) => !n.read).length;
exports.getPlans = () => d.plans;

// ── Courses ──────────────────────────────────────────────────────────────────

exports.getCourses = () => ({ year1: d.courses, year2: d.year2Courses });

exports.getCourse = (id) => {
  const course = findCourse(id);
  if (!course) return null;
  const sprints = allWeeks()
    .filter((w) => w.sprints.length)
    .flatMap((w) => w.sprints.filter((s) => s.courseId === id).map((s) => ({ ...s, weekNumber: w.number })));
  return { ...course, sprints };
};

// ── Weekly sprints & dashboard ───────────────────────────────────────────────

// Week 6 mock sprints (Stage 1 only) — kept consistent with leaderboard overrides below.
const WEEK6 = {
  C01: { title: 'Consideration and Capacity to Contract', score: 30 },
  C02: { title: 'Banking Regulation Act — Licensing and Control', score: 28 },
  C03: { title: 'Share Capital and Membership', score: 33 },
  C04: { title: 'Trade Unions — Registration and Immunities', score: 26 },
  C05: { title: 'Air and Water Pollution Control', score: 31 },
};
const WEEKDAYS = { C01: 'Monday', C02: 'Tuesday', C03: 'Wednesday', C04: 'Thursday', C05: 'Friday' };

function week6Sprints() {
  return COURSE_IDS.map((cid) => ({
    _id: `sprint_w06_${cid}`,
    courseId: cid,
    courseName: findCourse(cid).name,
    weekNumber: 6,
    weekday: WEEKDAYS[cid],
    title: WEEK6[cid].title,
    status: 'completed',
    bestScore: WEEK6[cid].score,
    maxScore: 40,
    mcqCount: 15,
    subjectiveCount: 1,
    publishedAt: '2026-09-01T00:00:00+05:30',
  }));
}

function allWeeks() {
  const trialStart = d.demoUser.trial.startDate;
  return [
    { number: 7, state: 'current', publishedAt: '2026-09-08T00:00:00+05:30', sprints: d.weeklySprints },
    { number: 6, state: 'published', publishedAt: '2026-09-01T00:00:00+05:30', sprints: week6Sprints() },
    // Published before the trial window opened → locked for trial users (PRD §7.4)
    { number: 5, state: 'locked', publishedAt: '2026-08-25T00:00:00+05:30', sprints: [], trialStart },
    { number: 8, state: 'upcoming', publishedAt: null, sprints: [] },
  ];
}

exports.getDashboard = () => {
  const weeks = allWeeks();
  const current = weeks[0];
  const completed = current.sprints.filter((s) => s.status === 'completed').length;
  const monthly = exports.getMonthly();
  return {
    weeks,
    week: {
      number: current.number,
      completed,
      goal: 4,
      total: current.sprints.length,
      bestTotal: current.sprints.reduce((sum, s) => sum + (s.bestScore || 0), 0),
      maxTotal: current.sprints.length * 40,
    },
    monthlyFeatured: monthly.find((m) => m.status === 'available') || monthly[0],
    monthlyOpen: monthly.filter((m) => m.status === 'available').length,
    recentResults: exports.getResults().slice(0, 3),
    leaderboardTop: exports.getLeaderboard({}).weekly.top,
  };
};

/** Where the primary action on a sprint card should point. */
exports.sprintHref = (sprint) => {
  if (sprint.status === 'completed' && sprint._id === 'sprint_w07_C02') return '/results/attempt_001';
  return `/weekly/${sprint._id}`;
};

exports.getWeeklyOverview = () => allWeeks().filter((w) => w.sprints.length);

function publicMcq(q) {
  // Deliberately omits correctOptionIds and explanation (PRD §15.1, SEC-01).
  return {
    id: q._id,
    number: q.questionNumber,
    prompt: q.prompt,
    options: q.options.map((o) => ({ id: o.id, text: o.text })),
    badge: q.originBadge,
    stemForm: q.stemForm,
  };
}

function publicSubjective(q) {
  // Deliberately omits rubric and expected-answer points (PRD §8.5).
  return { id: q._id, prompt: q.prompt, marks: q.marks, subParts: q.subParts, badge: q.originBadge };
}

exports.getSprint = (sprintId) => {
  const sprint = allWeeks().flatMap((w) => w.sprints).find((s) => s._id === sprintId);
  if (!sprint) return null;

  const hasContent = sprintId === 'sprint_w07_C01';
  const base = { sprint, hasContent, resultHref: sprint.status === 'completed' && sprintId === 'sprint_w07_C02' ? '/results/attempt_001' : null };
  if (!hasContent) return base;

  return {
    ...base,
    notes: {
      title: d.weeklySprintNotes.title,
      readTime: d.weeklySprintNotes.readTime,
      html: renderMarkdown(d.weeklySprintNotes.content),
    },
    mcqs: d.weeklyMCQs.map(publicMcq),
    subjective: publicSubjective(d.weeklySubjective),
    limits: { subjectiveMaxChars: 3000, subjectiveWarnChars: 2500, assumptionsMaxChars: 500 },
  };
};

// ── Results ──────────────────────────────────────────────────────────────────

const PREVIEW_SELECTIONS = {
  // questionNumber → selected option id (deterministic mock answers; #4 left unanswered)
  1: 'A', 2: 'C', 3: 'A', 5: 'C', 6: 'B', 7: 'B', 8: 'B', 9: 'A', 10: 'B',
  11: 'C', 12: 'A', 13: 'B', 14: 'C', 15: 'B',
};

function buildPreviewAttempt() {
  const review = d.weeklyMCQs.map((q) => {
    const selectedId = PREVIEW_SELECTIONS[q.questionNumber] || null;
    const correctId = q.correctOptionIds[0];
    return {
      number: q.questionNumber,
      prompt: q.prompt,
      options: q.options,
      badge: q.originBadge,
      selectedId,
      correctId,
      state: selectedId === null ? 'unanswered' : selectedId === correctId ? 'correct' : 'incorrect',
      explanation: q.explanation,
    };
  });
  const correct = review.filter((r) => r.state === 'correct').length;
  const incorrect = review.filter((r) => r.state === 'incorrect').length;
  const unanswered = review.filter((r) => r.state === 'unanswered').length;
  // +2 / 0 / 0 — no negative marking (PRD §5.1)
  return {
    _id: 'attempt_preview',
    kind: 'weekly',
    isSample: true,
    courseName: 'Contract Law',
    weekNumber: 7,
    attemptNumber: 1,
    submittedAt: null,
    mcq: { earned: correct * 2, max: 30, correct, incorrect, unanswered },
    subjective: { status: 'evaluation_pending', max: 10 },
    total: null, // no combined score until evaluation succeeds (PRD §10.4)
    feedback: null,
    review,
  };
}

function buildEvaluatedAttempt() {
  const r = d.sampleResult;
  return {
    _id: r._id,
    kind: 'weekly',
    courseName: r.courseName,
    weekNumber: r.weekNumber,
    attemptNumber: r.attemptNumber,
    submittedAt: r.submittedAt,
    mcq: r.scores.mcq,
    subjective: { status: r.scores.subjective.status, earned: r.scores.subjective.earned, max: r.scores.subjective.max },
    total: r.scores.total,
    feedback: r.feedback,
    review: null, // MCQ review data for this mock attempt is not part of the mock set
  };
}

function buildMonthlyAttempt() {
  return {
    _id: 'attempt_m02_c02',
    kind: 'monthly',
    courseName: 'Banking Law',
    monthNumber: 2,
    attemptNumber: 1,
    submittedAt: '2026-09-05T18:40:00+05:30',
    sections: [
      { label: 'Part A — Passage-linked MCQs', earned: 34, max: 50 },
      { label: 'Part B — Scenario / application', earned: 20, max: 30 },
      { label: 'Part C — Doctrinal / critical', earned: 18, max: 20 },
    ],
    total: { earned: 72, max: 100, percentage: 72 },
  };
}

exports.getResults = () => [
  { _id: 'attempt_001', kind: 'weekly', title: 'Banking Law — Week 7 sprint', submittedAt: d.sampleResult.submittedAt, earned: 32, max: 40, status: 'completed' },
  { _id: 'attempt_m02_c02', kind: 'monthly', title: 'Banking Law — Monthly simulation (Weeks 5–8)', submittedAt: '2026-09-05T18:40:00+05:30', earned: 72, max: 100, status: 'completed' },
];

exports.getResult = (id) => {
  if (id === 'attempt_001') return buildEvaluatedAttempt();
  if (id === 'attempt_m02_c02') return buildMonthlyAttempt();
  if (id === 'attempt_preview') return buildPreviewAttempt();
  return null;
};

// ── Monthly simulation ───────────────────────────────────────────────────────

const SIM_COURSES = ['C01', 'C02', 'C03', 'C04', 'C05'];

exports.getMonthly = () => {
  const real = d.monthlySimulations;
  return SIM_COURSES.map((cid) => {
    const found = real.find((s) => s.courseId === cid);
    if (found) return found;
    return {
      _id: `sim_m02_${cid}`,
      courseId: cid,
      courseName: findCourse(cid).name,
      month: 2,
      title: `${findCourse(cid).name} — Monthly Simulation (Weeks 5–8)`,
      duration: 180,
      totalMarks: 100,
      status: 'not_released',
      sections: real[0].sections,
      bestScore: null,
      attempts: 0,
      publishedAt: null,
    };
  });
};

exports.getSimulationSummary = (id) => exports.getMonthly().find((s) => s._id === id) || null;

/** Learner-safe simulation payload. No answers, explanations or rubrics. */
exports.getSimulationPlayer = (id) => {
  const summary = exports.getSimulationSummary(id);
  if (!summary || summary._id !== 'sim_m02_C01') return null;

  const realPassage = d.simulationPassages[0];
  const partA = [];
  let qNo = 0;
  for (let p = 1; p <= 5; p++) {
    const src = p === 1 ? realPassage : null;
    partA.push({
      id: src ? src._id : `passage_placeholder_${p}`,
      number: p,
      title: src ? src.title : `Passage ${p}`,
      text: src
        ? src.text
        : 'Placeholder passage. Stage 1 mock data contains one full passage; the remaining four passages appear here only so the 5 × 5 layout can be previewed. Real passages arrive with content releases (PRD §9.7).',
      isPlaceholder: !src,
      questions: Array.from({ length: 5 }, (_, i) => {
        qNo += 1;
        const q = src ? src.questions[i] : null;
        return {
          id: q ? q._id : `placeholder_q_${qNo}`,
          number: qNo,
          prompt: q ? q.prompt : `Placeholder question ${qNo} for passage ${p}.`,
          options: q
            ? q.options.map((o) => ({ id: o.id, text: o.text }))
            : ['A', 'B', 'C', 'D'].map((o) => ({ id: o, text: `Placeholder option ${o}` })),
        };
      }),
    });
  }

  const flat = (arr) => arr.map((q) => ({ id: q._id, number: q.questionNumber, label: q.sectionLabel, prompt: q.prompt, marks: q.marks }));

  return {
    id: summary._id,
    title: summary.title,
    courseName: summary.courseName,
    durationMinutes: summary.duration,
    totalMarks: summary.totalMarks,
    partA,
    partB: flat(d.simulationPartB),
    partC: flat(d.simulationPartC),
    limits: { subjectiveMaxChars: 4000, assumptionsMaxChars: 500 },
  };
};

// ── Leaderboards ─────────────────────────────────────────────────────────────

const PEOPLE = ['CorporateCounsel', 'LawNavigator', 'LegalEagle42', 'BriefWriter99', 'PrecedentHunter', 'ConstitutionFan', 'EquityScholar', 'TortReformer'];
const ME = d.demoUser.leaderboardAlias;

// The demo learner's real (mock) sprint scores, consistent with the dashboard. null = not attempted.
const ME_SCORES = {
  7: { C01: null, C02: 34, C03: null, C04: null, C05: null },
  6: Object.fromEntries(COURSE_IDS.map((c) => [c, WEEK6[c].score])),
};

function courseScore(alias, courseId, week) {
  if (alias === ME) return (ME_SCORES[week] || {})[courseId] ?? null;
  if (week === 7 && courseId === 'C02') {
    const row = d.weeklyLeaderboard.find((r) => r.alias === alias);
    return row ? row.score : null; // TortReformer has not attempted this sprint
  }
  return 22 + (hash(`${alias}|${courseId}|${week}`) % 17); // 22–38, deterministic mock
}

const FIRST_ATTEMPT_DROP = { CorporateCounsel: [6, 4], LawNavigator: [8, 2], LegalEagle42: [5, 6], BriefWriter99: [12, 3], PrecedentHunter: [4, 9], ConstitutionFan: [7, 5], EquityScholar: [10, 4], TortReformer: [3, 2] };

exports.getLeaderboard = (query = {}) => {
  const scope = query.scope === 'all' ? 'all' : 'course';
  const courseId = COURSE_IDS.includes(query.course) ? query.course : 'C02';
  const week = [6, 7].includes(parseInt(query.week, 10)) ? parseInt(query.week, 10) : 7;
  const attempt = query.attempt === 'first' ? 'first' : 'best';
  const tab = query.tab === 'cumulative' ? 'cumulative' : 'weekly';
  const optIn = query.optout === '1' ? false : d.demoUser.leaderboardOptIn;
  // Opted-out learners must not appear in any public ranking (PRD §14.1, LEAD-01).
  const visible = (alias) => optIn || alias !== ME;

  // Weekly
  const weeklyRows = PEOPLE.filter(visible).map((alias) => {
    let score;
    if (scope === 'course') score = courseScore(alias, courseId, week);
    else score = COURSE_IDS.reduce((sum, c) => sum + (courseScore(alias, c, week) || 0), 0); // unattempted = 0
    return { alias, score };
  }).filter((r) => r.score !== null && (scope === 'course' || r.score > 0));
  const weeklyRanked = rankRows(weeklyRows, 'score').map((r) => ({ ...r, isMe: r.alias === ME }));
  const weeklyMe = weeklyRanked.find((r) => r.isMe) || null;

  // Cumulative (alias-only; PRD §14.3)
  const cumulativeRows = d.aggregateLeaderboard.filter((r) => visible(r.alias)).map((r) => {
    const drop = FIRST_ATTEMPT_DROP[r.alias] || [0, 0];
    const weeklyTotal = attempt === 'first' ? r.weeklyTotal - drop[0] : r.weeklyTotal;
    const monthlyTotal = attempt === 'first' ? r.monthlyTotal - drop[1] : r.monthlyTotal;
    return { alias: r.alias, weeklyTotal, monthlyTotal, total: weeklyTotal + monthlyTotal };
  });
  const cumulativeRanked = rankRows(cumulativeRows, 'total').map((r) => ({ ...r, isMe: r.alias === ME }));

  return {
    tab,
    courses: d.courses.map((c) => ({ id: c._id, name: c.name })),
    // `?optout=1` previews the opted-out state (PRD §14.1). Stage 2 reads this from leaderboard_profiles.
    participation: { optIn, alias: d.demoUser.leaderboardAlias },
    weekly: {
      scope, courseId, week,
      courseName: findCourse(courseId).name,
      max: scope === 'all' ? 200 : 40,
      weeks: [7, 6],
      top: weeklyRanked.slice(0, 3), // PRD §14.2: top three plus the learner's own rank
      me: weeklyMe,
      meOutsideTop: !!weeklyMe && weeklyMe.rank > 3,
    },
    cumulative: { attempt, rows: cumulativeRanked, me: cumulativeRanked.find((r) => r.isMe) || null },
  };
};

// ── Notifications ────────────────────────────────────────────────────────────

exports.getNotifications = () => d.notifications;

// ── Admin ────────────────────────────────────────────────────────────────────

exports.getAdminOverview = async () => {
  const result = await adminQueries.getPendingApprovals();

  return {
    stats: d.adminStats,
    pending: result.rows.map((user) => ({
      _id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || '—',
      createdAt: user.created_at,
    })),
    recentAudit: d.auditLogs.slice(0, 5),
    releases: d.releases
      .filter((r) => r.status !== 'published')
      .concat(
        d.releases
          .filter((r) => r.status === 'published')
          .slice(0, 1)
      ),
  };
};

exports.getAdminUsers = () => ({
  pending: d.allUsers.filter((u) => u.accountState === 'pending_approval'),
  users: d.allUsers.filter((u) => u.role !== 'admin'),
});

exports.getContentItems = () => d.contentItems;
exports.getAssessmentItems = () => d.assessmentItems;
exports.getAuditLogs = () => d.auditLogs;

const RELEASE_STEPS = ['draft', 'validating', 'needs_review', 'approved', 'scheduled', 'published'];
exports.getReleases = () =>
  d.releases.map((r) => {
    const idx = RELEASE_STEPS.indexOf(r.status);
    return { ...r, steps: RELEASE_STEPS.map((s, i) => ({ key: s, state: i < idx ? 'completed' : i === idx ? 'active' : '' })) };
  });

// Pattern-rule records follow PRD §6.3. Values here are display-only mock records.
exports.getAdminSettings = () => ({
  patternRules: [
    { key: 'annual_assessment_composition', value: '50 MCQ marks + 50 subjective marks (June 2027 annual assessment)', sourceType: 'screenshot', sourceLabel: 'PACE assessment screenshot supplied to product', cohort: 'June 2027', confidence: 'confirmed', verifiedAt: '2026-09-08', subjectToChange: true, isCurrent: true },
    { key: 'june_2026_paper_format', value: '100 marks, three hours, annual summative examination', sourceType: 'papers', sourceLabel: 'Three June 2026 papers supplied to product', cohort: 'June 2026', confidence: 'confirmed', verifiedAt: '2026-09-08', subjectToChange: true, isCurrent: false },
    { key: 'june_2026_subjective_choice', value: 'Part B: attempt any 3 of 4. Part C: attempt any 2 of 3. Each question 10 marks.', sourceType: 'papers', sourceLabel: 'Three June 2026 papers supplied to product', cohort: 'June 2026', confidence: 'confirmed', verifiedAt: '2026-09-08', subjectToChange: true, isCurrent: false },
    { key: 'sim_part_a_structure', value: '5 shared passages × 5 linked MCQs × 2 marks = 50', sourceType: 'product', sourceLabel: 'Product default (no verified official Part A structure)', cohort: 'Simulation', confidence: 'product_default', verifiedAt: null, subjectToChange: true, isCurrent: true },
    { key: 'sim_subjective_choice', value: 'All 5 subjective questions compulsory (no choice)', sourceType: 'product', sourceLabel: 'Deliberate product configuration; differs from June 2026 papers', cohort: 'Simulation', confidence: 'product_default', verifiedAt: null, subjectToChange: true, isCurrent: true },
    { key: 'negative_marking', value: 'None (+2 / 0 / 0)', sourceType: 'product', sourceLabel: 'Product default (no verified official rule)', cohort: 'Simulation', confidence: 'product_default', verifiedAt: null, subjectToChange: true, isCurrent: true },
    { key: 'formative_assessments', value: 'Unresolved — do not claim', sourceType: 'none', sourceLabel: 'Awaiting verified source', cohort: '—', confidence: 'unverified', verifiedAt: null, subjectToChange: true, isCurrent: true },
  ],
  blueprint: {
    weekly: { mcqs: 15, mcqMarks: 2, subjective: 1, subjectiveMarks: 10, max: 40, negativeMarking: false },
    monthly: { durationMinutes: 180, passages: 5, mcqsPerPassage: 5, mcqMarks: 2, partB: 3, partC: 2, subjectiveMarks: 10, max: 100, pause: false, negativeMarking: false, allCompulsory: true },
  },
  ai: { provider: 'Not configured (Stage 2)', model: 'Configured server-side', promptVersion: '—', maxAnswerChars: 3000, note: 'Answer and token caps are an open decision (PRD §26).' },
});
