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
const learnerQueries=require('../query/learnerQuerry');
const questionQueries = require('../query/quesion');
const questionQuerry=require('../query/quesion');

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

exports.getCourses = async (userId) => {
  const [year1Courses, year2Courses, sprintProgress] = await Promise.all([
    learnerQueries.getFirstYearCourses(),
    learnerQueries.getSecondYearCourses(),
    learnerQueries.getWeeklySprintProgress(userId),
  ]);
  const progressByCourseId = new Map(
    sprintProgress.map((progress) => [progress.courseId, progress])
  );
  const mapCourse = (course) => ({
    id: course.id,
    _id: course.code,
    code: course.code,
    name: course.display_name || '',
    programYear: course.program_year || '',
    description: '',
    modules: [],
    totalModules: progressByCourseId.get(course.id)?.totalSprints || 0,
    completedModules: progressByCourseId.get(course.id)?.completedSprints || 0,
    progress: progressByCourseId.get(course.id)?.totalSprints
      ? Math.round(
        (progressByCourseId.get(course.id).completedSprints /
          progressByCourseId.get(course.id).totalSprints) * 100
      )
      : 0,
    weekday: '',
    active: course.active,
  });

  return {
    year1: year1Courses.map(mapCourse),
    year2: year2Courses.map(mapCourse),
  };
};

exports.getCourse = (code, userId) => learnerQueries.getCourseByCode(code, userId);

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

//get all weekly in a content release
 async function allWeeks() {
  const allWeekly = await learnerQueries.getAllWeekly();

  return Promise.all(
    allWeekly.map(async (weekly) => ({
      number: weekly.week_number,
      state: weekly.status === 'published' ? 'published' : 'upcoming',
      publishedAt: weekly.publish_at,
      sprints: await learnerQueries.getWeeklySprint(weekly.id),
    }))
  );
}

exports.getDashboard = async () => {
  const weeks = await allWeeks();
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
  if (sprint.id) return `/weekly/${encodeURIComponent(sprint.id)}`;
  if (sprint.status === 'completed' && sprint._id === 'sprint_w07_C02') return '/results/attempt_001';
  return `/weekly/${sprint._id}`;
};

exports.getWeeklyOverview = async () => (await allWeeks()).filter((w) => w.sprints.length);

function publicMcq(q) {
  return {
    id: q.id,
    number: q.question_number,
    prompt: q.prompt_markdown,
    options: Array.isArray(q.options) ? q.options.map((o) => ({ id: o.id, text: o.text })) : [],
    badge: q.learner_badge,
    stemForm: q.stem_form,
  };
}

function publicSubjective(q) {
  const subParts = [...q.prompt_markdown.matchAll(/\(([a-z])\)/gi)].map((match) => match[1].toLowerCase());
  return {
    id: q.id,
    prompt: q.prompt_markdown,
    marks: Number(q.marks),
    subParts,
    badge: q.learner_badge,
  };
}


//weekly sprint
exports.getSprint = async (sprintId) => {
  const weeks = await allWeeks();
  const sprint = weeks
    .flatMap((week) => week.sprints)
    .find((item) => item.id === sprintId || item._id === sprintId);
  if (sprint) {
    const note = sprint.releaseId && sprint.courseId
      ? await learnerQueries.getNoteByReleaseAndCourseId(sprint.releaseId, sprint.courseId)
      : null;
    const headings = note?.markdown.match(/^#{1,6}\s+.+$/gm) || [];
    const hasContent = Boolean(sprint.id);
    const base = {
      sprint,
      hasContent,
      resultHref: sprint.status === 'completed' && sprintId === 'sprint_w07_C02'
        ? '/results/attempt_001'
        : null,
    };
    if (!hasContent) return base;

    const [mcqAssessment, subjectiveAssessment] = await Promise.all([
      questionQueries.getMcqQuestionBySprintId(sprint.id),
      questionQueries.getSubQuestionBySprintId(sprint.id),
    ]);
    const mcqs = (mcqAssessment?.assessment_items || []).map((item) => publicMcq(item.questions));
    const subjectiveQuestion = subjectiveAssessment?.assessment_items[0]?.questions;

    return {
      ...base,
      notes: {
        title: headings[0] ? headings[0].replace(/^#{1,6}\s+/, '') : '',
        readTime: note?.readTime || '',
        html: renderMarkdown(note?.markdown || ''),
      },
      mcqs,
      subjective: subjectiveQuestion ? publicSubjective(subjectiveQuestion) : {
        id: '',
        prompt: '',
        marks: 0,
        subParts: [],
        badge: '',
      },
      limits: { subjectiveMaxChars: 3000, subjectiveWarnChars: 2500, assumptionsMaxChars: 500 },
    };
  }

  const databaseSprint = await learnerQueries.getWeeklySprintByAssessmentId(sprintId);
  if (!databaseSprint) return null;
  return { sprint: databaseSprint, hasContent: false, resultHref: null };
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
      id: `sim_m02_${cid}`,
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

exports.getMonthlyAssessments = (userId) => learnerQueries.getMonthlyAssessments(userId);

exports.getMonthlyAssessmentSummary = async (id) => {
  const assessments = await learnerQueries.getMonthlyAssessments();
  return assessments.find((assessment) => assessment.id === id) || null;
};

exports.getExamPatternRule = (ruleKey) => learnerQueries.getExamPatternRule(ruleKey);

exports.getSimulationSummary = (id) => exports.getMonthly().find((s) => s.id === id) || null;

/** Learner-safe simulation payload. No answers, explanations or rubrics. */
exports.getSimulationPlayer = (assessmentId) =>
  learnerQueries.getMonthlySimulationByAssessmentId(assessmentId);

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
  const [users, releases, auditLogs] = await Promise.all([
    adminQueries.getPendingApprovals(),
    exports.getReleases(),
    exports.getAuditLogs(),
  ]);
  return {
    stats: d.adminStats,
    pending: users.map((user) => ({
      _id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || '—',
      createdAt: user.created_at,
    })),
    recentAudit: auditLogs.slice(0, 5),
    releases: releases
      .filter((r) => r.status !== 'published')
      .concat(
        releases
          .filter((r) => r.status === 'published')
          .slice(0, 1)
      ),
  };
};

exports.getAdminUsers = async() => {
  const [pendingUsers, allUsers] = await Promise.all([
    adminQueries.getPendingApprovals(),
    adminQueries.getAllUser(),
  ]);

  return {
    pending: pendingUsers.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || '—',
      createdAt: user.created_at,
    })),
    users: allUsers.map((user) => {
      const trial = user.trials[0];
      const subscription = user.subscriptions[0];

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || '—',
        role: user.role,
        accountState: user.account_state,
        leaderboardAlias: user.leaderboard_profiles?.handle || null,
        leaderboardOptIn: user.leaderboard_profiles?.status === 'opted_in',
        trial: trial
          ? { startDate: trial.starts_at, endDate: trial.ends_at }
          : null,
        subscription: subscription
          ? { plan: subscription.plans.code, endDate: subscription.ends_at }
          : null,
        createdAt: user.created_at,
      };
    }),
  };
};

exports.getContentItems = async () => {
  const notes = await adminQueries.getAllRevisionNotes();

  return notes.map((note) => {
    const headings = note.markdown.match(/^#{1,6}\s+.+$/gm) || [];
    const headingText = (heading) => heading.replace(/^#{1,6}\s+/, '').trim();

    return {
      id: note.id,
      courseId: note.courses.code,
      courseName: note.courses.display_name,
      type: 'revision_notes',
      title: headings[0] ? headingText(headings[0]) : note.stable_id,
      topic: headings[1] ? headingText(headings[1]) : null,
      weekNumber: note.content_releases.week_number,
      version: note.version,
      source: null,
      approvalStatus:note.approval_status,
      lastUpdated: note.created_at,
    };
  });
};
exports.getAssessmentItems = async () => {
  const assessmentItems = await adminQueries.getAllAssessment();

  return assessmentItems.map(({ section, questions }) => ({
    id: questions.id,
    _id: questions.question_id,
    courseId: questions.courses.code,
    courseName: questions.courses.display_name,
    questionType: questions.question_type,
    responseFormat: questions.response_format,
    topic: Array.isArray(questions.concept_ids) && questions.concept_ids.length
      ? questions.concept_ids.join(', ')
      : '—',
    difficulty: '—',
    origin: questions.origin,
    originBadge: questions.learner_badge || questions.origin,
    approvalStatus: questions.approval_status,
    marks: questions.marks,
    version: questions.version,
    prompt: questions.prompt_markdown,
    section,
  }));

};

exports.getAssessmentPreview = async (id) => {
  const question = await adminQueries.getAssessmentQuestionById(id);
  if (!question) return null;

  return {
    id: question.id,
    questionId: question.question_id,
    version: question.version,
    questionNumber: question.question_number,
    courseName: question.courses.display_name,
    courseCode: question.courses.code,
    examRole: question.exam_role,
    section: [...new Set(question.assessment_items.map((item) => item.section))].join(', ') || '—',
    questionType: question.question_type,
    responseFormat: question.response_format,
    stemForm: question.stem_form,
    concepts: Array.isArray(question.concept_ids) ? question.concept_ids : [],
    promptHtml: renderMarkdown(question.prompt_markdown),
    options: Array.isArray(question.options) ? question.options : [],
    correctOptionIds: Array.isArray(question.correct_option_ids) ? question.correct_option_ids : [],
    explanationHtml: question.explanation_markdown
      ? renderMarkdown(question.explanation_markdown)
      : null,
    directiveVerbs: Array.isArray(question.directive_verbs) ? question.directive_verbs : [],
    marks: question.marks,
    subIssues: Array.isArray(question.sub_issues) ? question.sub_issues : [],
    requiredAuthority: Array.isArray(question.required_authority) ? question.required_authority : [],
    requiredOutput: Array.isArray(question.required_output) ? question.required_output : [],
    assumptionsPolicy: question.assumptions_policy,
    rubric: question.rubric,
    expectedAnswerPoints: question.expected_answer_points,
    origin: question.origin,
    sourceRefs: question.source_refs,
    patternConfidence: question.pattern_confidence,
    learnerBadge: question.learner_badge,
    approvalStatus: question.approval_status,
    passage: question.passages
      ? {
        stableId: question.passages.stable_id,
        version: question.passages.version,
        html: renderMarkdown(question.passages.passage_text),
      }
      : null,
  };
};

exports.getAuditLogs = async () => {
  const auditEvents = await adminQueries.getAllAuditEvent();
  const targetUserIds = [...new Set(
    auditEvents
      .filter((event) => event.target_type === 'user' && event.target_id)
      .map((event) => event.target_id)
  )];
  const targetUsers = targetUserIds.length
    ? await adminQueries.getUsersByIds(targetUserIds)
    : [];
  const targetNameById = new Map(targetUsers.map((user) => [user.id, user.name]));

  return auditEvents.map((event) => {
    const before = event.before_data || {};
    const after = event.after_data || {};
    const changes = [];

    if (before.account_state || after.account_state) {
      changes.push(`Account state: ${before.account_state || '—'} → ${after.account_state || '—'}`);
    }
    if (before.role || after.role) {
      changes.push(`Role: ${before.role || '—'} → ${after.role || '—'}`);
    }
    if (event.reason) changes.push(`Reason: ${event.reason}`);

    return {
      _id: event.id,
      timestamp: event.created_at,
      actor: event.users?.name || 'System',
      actorRole: event.users?.role || 'system',
      action: event.action,
      entity: event.target_type || 'Unknown',
      entityId: event.target_id || '—',
      entityName:
        (event.target_type === 'user' && event.target_id && targetNameById.get(event.target_id)) ||
        event.target_type ||
        'Unknown target',
      details: changes.join('; ') || 'No additional details recorded.',
      result: 'success',
    };
  });
};

const RELEASE_STEPS = ['draft', 'validating', 'needs_review', 'approved', 'scheduled', 'published'];
exports.getReleases = async () => {
  const releases = await adminQueries.getAllReleases();

  return releases.map((release) => {
    const questions = release.assessments.flatMap((assessment) =>
      assessment.assessment_items.map((item) => item.questions)
    );
    const notesCount = release.revision_notes.length;
    const mcqCount = questions.filter((question) => question.response_format !== 'subjective').length;
    const subjectiveCount = questions.length - mcqCount;
    const idx = RELEASE_STEPS.indexOf(release.status);

    return {
      id: release.id,
      releaseId: release.release_id,
      releaseType: release.release_type,
      weekNumber: release.week_number,
      month: release.month_number,
      version: release.version,
      status: release.status,
      publishedAt: release.publish_at,
      notesCount,
      mcqCount,
      subjectiveCount,
      approval: {
        notes: release.notes_approval_status || (notesCount ? 'draft' : 'n/a'),
        assessment: release.assessment_approval_status || 'draft',
      },
      checksum: release.content_checksum,
      steps: RELEASE_STEPS.map((step, i) => ({
        key: step,
        state: i < idx ? 'completed' : i === idx ? 'active' : '',
      })),
    };
  });
};

exports.getReleasePreview = async (id) => {
  const release = await adminQueries.getReleaseById(id);
  if (!release) return null;

  return {
    id: release.id,
    releaseId: release.release_id,
    releaseType: release.release_type,
    programYear: release.program_year,
    academicYear: release.academic_years.label,
    weekNumber: release.week_number,
    month: release.month_number,
    version: release.version,
    status: release.status,
    publishedAt: release.publish_at,
    checksum: release.content_checksum,
    notesApproval: release.notes_approval_status || (release.revision_notes.length ? 'draft' : 'n/a'),
    assessmentApproval: release.assessment_approval_status || 'draft',
    notes: release.revision_notes.map((note) => ({
      id: note.id,
      stableId: note.stable_id,
      version: note.version,
      courseName: note.courses.display_name,
      courseCode: note.courses.code,
      html: renderMarkdown(note.markdown),
    })),
    assessments: release.assessments.map((assessment) => ({
      id: assessment.assessment_id,
      title: assessment.title,
      type: assessment.type,
      status: assessment.status,
      courseName: assessment.courses.display_name,
      courseCode: assessment.courses.code,
      items: assessment.assessment_items.map((item) => ({
        section: item.section,
        order: item.item_order,
        compulsory: item.compulsory,
        passage: item.passages
          ? {
            stableId: item.passages.stable_id,
            version: item.passages.version,
            html: renderMarkdown(item.passages.passage_text),
          }
          : null,
        questionId: item.questions.question_id,
        version: item.questions.version,
        questionNumber: item.questions.question_number,
        questionType: item.questions.question_type,
        responseFormat: item.questions.response_format,
        promptHtml: renderMarkdown(item.questions.prompt_markdown),
        options: Array.isArray(item.questions.options) ? item.questions.options : [],
        correctOptionIds: Array.isArray(item.questions.correct_option_ids)
          ? item.questions.correct_option_ids
          : [],
        explanationHtml: item.questions.explanation_markdown
          ? renderMarkdown(item.questions.explanation_markdown)
          : null,
        marks: item.questions.marks,
        rubric: Array.isArray(item.questions.rubric) ? item.questions.rubric : [],
        expectedAnswerPoints: Array.isArray(item.questions.expected_answer_points)
          ? item.questions.expected_answer_points
          : [],
      })),
    })),
  };
};

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

//For preview action
exports.getRevisionNotePreview = async (id) => {
  const note = await adminQueries.getRevisionNoteById(id);
  if (!note) return null;

  return {
    id: note.id,
    stableId: note.stable_id,
    version: note.version,
    courseName: note.courses.display_name,
    courseCode: note.courses.code,
    releaseType: note.content_releases.release_type,
    weekNumber: note.content_releases.week_number,
    monthNumber: note.content_releases.month_number,
    status: note.content_releases.status,
    updatedAt: note.created_at,
    html: renderMarkdown(note.markdown),
  };
};
