'use strict';

/** Database-backed learner and admin view models. */
const prisma = require('../config/db');
const renderMarkdown = require('./markdown');
const adminQueries = require('../query/adminQueries');
const learnerQueries=require('../query/learnerQuerry');
const questionQueries = require('../query/quesion');
const leaderboardCalculations = require('./leaderboardCalculations');
const geminiPrompt = require('./geminiPrompt');

// ── Helpers ──────────────────────────────────────────────────────────────────

// ── Courses ──────────────────────────────────────────────────────────────────

// Loads year-group courses and maps weekly completion progress for the dashboard.
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

// Loads one course by code with this learner's sprint completion state.
exports.getCourse = (code, userId) => learnerQueries.getCourseByCode(code, userId);

// ── Weekly sprints & dashboard ───────────────────────────────────────────────

// Loads weekly releases and their published assessment summaries.
async function allWeeks(userId) {
  const allWeekly = await learnerQueries.getAllWeekly();

  return Promise.all(
    allWeekly.map(async (weekly) => ({
      number: weekly.week_number,
      state: weekly.status === 'published' ? 'published' : 'upcoming',
      publishedAt: weekly.publish_at,
      sprints: await learnerQueries.getWeeklySprint(weekly.id, userId),
    }))
  );
}

// Combines weekly progress, monthly availability, and leaderboard data for dashboard.
exports.getDashboard = async (userId) => {
  const weeks = await allWeeks(userId);
  const current = weeks[0] || { number: null, sprints: [] };
  const completed = current.sprints.filter((s) => s.status === 'completed').length;
  const [monthly, leaderboard] = await Promise.all([
    learnerQueries.getMonthlyAssessments(),
    exports.getLeaderboard({}, userId),
  ]);
  const availableMonthly = monthly.filter((m) => m.status === 'available');

  return {
    weeks,
    week: {
      number: current.number,
      completed,
      goal: 4,
      total: current.sprints.length,
      bestTotal: current.sprints.reduce((sum, s) => sum + (s.bestScore || 0), 0),
      maxTotal: current.sprints.reduce((sum, sprint) => sum + sprint.maxScore, 0),
    },
    monthlyFeatured: availableMonthly[0] || monthly[0] || null,
    monthlyOpen: availableMonthly.length,
    leaderboardTop: leaderboard.weekly.top,
  };
};

/** Where the primary action on a sprint card should point. */
exports.sprintHref = (sprint) => {
  if (sprint.id) return `/weekly/${encodeURIComponent(sprint.id)}`;
  return `/weekly/${sprint._id}`;
};

// Returns only weekly releases that contain sprint assessments.
exports.getWeeklyOverview = async () => (await allWeeks()).filter((w) => w.sprints.length);

// Removes answer keys and private fields from an MCQ before rendering for learners.
function publicMcq(q, assessmentItemId) {
  return {
    id: q.id,
    assessmentItemId,
    number: q.question_number,
    prompt: q.prompt_markdown,
    options: Array.isArray(q.options) ? q.options.map((o) => ({ id: o.id, text: o.text })) : [],
    badge: q.learner_badge,
    stemForm: q.stem_form,
    responseFormat: q.response_format,
  };
}

// Removes evaluator-only fields from a subjective question before learner display.
function publicSubjective(q, assessmentItemId) {
  const subParts = [...q.prompt_markdown.matchAll(/\(([a-z])\)/gi)].map((match) => match[1].toLowerCase());
  return {
    id: q.id,
    assessmentItemId,
    prompt: q.prompt_markdown,
    marks: Number(q.marks),
    subParts,
    badge: q.learner_badge,
  };
}


//weekly sprint
// Loads a weekly sprint's notes and learner-safe questions.
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
    const base = { sprint, hasContent };
    if (!hasContent) return base;

    const [mcqAssessment, subjectiveAssessment] = await Promise.all([
      questionQueries.getMcqQuestionBySprintId(sprint.id),
      questionQueries.getSubQuestionBySprintId(sprint.id),
    ]);
    const mcqs = (mcqAssessment?.assessment_items || []).map((item) =>
      publicMcq(item.questions, item.id)
    );
    const subjectiveItem = subjectiveAssessment?.assessment_items[0];
    const subjectiveQuestion = subjectiveItem?.questions;

    return {
      ...base,
      notes: {
        title: headings[0] ? headings[0].replace(/^#{1,6}\s+/, '') : '',
        readTime: note?.readTime || '',
        html: renderMarkdown(note?.markdown || ''),
      },
      mcqs,
      subjective: subjectiveQuestion ? publicSubjective(subjectiveQuestion, subjectiveItem.id) : {
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
  return { sprint: databaseSprint, hasContent: false };
};

// ── Monthly simulation ───────────────────────────────────────────────────────

// Loads monthly assessment summaries from the database.
exports.getMonthlyAssessments = (userId) => learnerQueries.getMonthlyAssessments(userId);

// Finds one monthly assessment summary by its assessment ID.
exports.getMonthlyAssessmentSummary = async (id) => {
  const assessments = await learnerQueries.getMonthlyAssessments();
  return assessments.find((assessment) => assessment.id === id) || null;
};

// Loads an exam-pattern instruction rule from the database.
exports.getExamPatternRule = (ruleKey) => learnerQueries.getExamPatternRule(ruleKey);

/** Learner-safe simulation payload. No answers, explanations or rubrics. */
exports.getSimulationPlayer = (assessmentId) =>
  learnerQueries.getMonthlySimulationByAssessmentId(assessmentId);

// ── Leaderboards ─────────────────────────────────────────────────────────────

// Builds weekly and monthly rankings from opt-in learners' evaluated attempts.
exports.getLeaderboard = async (query = {}, userId) => {
  const [year, profiles, ownProfile] = await Promise.all([
    prisma.academic_years.findFirst({
      where: { active: true },
      select: { id: true, label: true },
    }),
    prisma.leaderboard_profiles.findMany({
      where: { status: 'opted_in' },
      select: { user_id: true, handle: true },
    }),
    userId ? prisma.leaderboard_profiles.findUnique({
      where: { user_id: userId },
      select: { handle: true, status: true },
    }) : null,
  ]);
  const attempt = query.attempt === 'first' ? 'first' : 'best';
  const tab = query.tab === 'cumulative' ? 'cumulative' : 'weekly';
  const optIn = ownProfile?.status === 'opted_in';
  const ownHandle = optIn ? ownProfile.handle : null;
  const optedInIds = profiles.map((profile) => profile.user_id);
  const now = new Date();
  const attempts = year && optedInIds.length
    ? await prisma.attempts.findMany({
      where: {
        user_id: { in: optedInIds },
        state: 'evaluated',
        submitted_at: { not: null },
        submitted_via: 'manual',
        assessments: {
          is: {
            academic_year_id: year.id,
            status: 'approved',
            OR: [
              {
                type: 'weekly',
                content_releases: {
                  is: {
                    release_type: 'weekly',
                    status: 'published',
                    publish_at: { lte: now },
                  },
                },
              },
              {
                type: 'monthly',
                content_releases: {
                  is: {
                    release_type: 'monthly',
                    status: 'published',
                    publish_at: { lte: now },
                  },
                },
              },
            ],
          },
        },
      },
      orderBy: [
        { user_id: 'asc' },
        { assessment_id: 'asc' },
        { attempt_number: 'asc' },
      ],
      select: {
        user_id: true,
        assessment_id: true,
        attempt_number: true,
        state: true,
        submitted_at: true,
        submitted_via: true,
        objective_score: true,
        objective_max_score: true,
        assessments: {
          select: {
            type: true,
            assessment_items: {
              select: {
                id: true,
                questions: {
                  select: { response_format: true, marks: true },
                },
              },
            },
          },
        },
        responses: {
          where: { submitted_at: { not: null } },
          select: {
            assessment_item_id: true,
            subjective_answer: true,
            assessment_items: {
              select: {
                questions: { select: { response_format: true } },
              },
            },
            evaluations: {
              select: { state: true, score: true },
            },
          },
        },
      },
    })
    : [];
  const weeklyRanked = leaderboardCalculations.buildRows(
    attempts, profiles, 'weekly', attempt, userId
  );
  const monthlyRanked = leaderboardCalculations.buildRows(
    attempts, profiles, 'monthly', attempt, userId
  );
  const weeklyMe = weeklyRanked.find((row) => row.isMe) || null;

  return {
    tab,
    participation: { optIn, alias: ownHandle },
    weekly: {
      top: weeklyRanked.slice(0, 3),
      me: weeklyMe,
      meOutsideTop: !!weeklyMe && weeklyMe.rank > 3,
    },
    cumulative: {
      attempt,
      rows: monthlyRanked,
      me: monthlyRanked.find((row) => row.isMe) || null,
    },
    academicYear: year?.label || 'current academic year',
  };
};

// ── Notifications ────────────────────────────────────────────────────────────

// Lists notifications persisted for the requested learner.
exports.getNotifications = async (userId) => {
  const rows = await prisma.notifications.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
    take: 100,
    select: { id: true, template: true, event: true, delivery_state: true, created_at: true },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.template,
    message: row.event,
    type: row.template,
    createdAt: row.created_at,
  }));
};

// ── Admin ────────────────────────────────────────────────────────────────────

// Combines pending approvals, persisted counts, audit activity, and releases.
exports.getAdminOverview = async () => {
  const [users, releases, auditLogs, stats] = await Promise.all([
    adminQueries.getPendingApprovals(),
    exports.getReleases(),
    exports.getAuditLogs(),
    adminQueries.getDashboardStats(),
  ]);
  return {
    stats,
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

// Maps pending and existing database users for the admin user list.
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

// Maps database revision notes into the admin content list.
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
// Maps database questions into the admin assessment list.
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

// Loads a question with its answer key and evaluator details for admin preview.
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

// Maps audit events and related user names into display-ready log entries.
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
// Maps database releases into a display model with progress and approval counts.
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

// Loads a release and maps its notes and question content for admin preview.
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

// Loads persisted exam rules and approved assessment blueprints for admin display.
exports.getAdminSettings = async () => {
  const [rules, blueprints] = await Promise.all([
    prisma.exam_pattern_rules.findMany({
      orderBy: [{ rule_key: 'asc' }, { version: 'desc' }],
      select: {
        rule_key: true,
        rule_value: true,
        source: true,
        confidence: true,
        effective_cohort: true,
        version: true,
      },
    }),
    prisma.assessment_blueprints.findMany({
      where: { status: 'approved' },
      orderBy: [{ type: 'asc' }, { version: 'desc' }],
      select: {
        type: true,
        duration_minutes: true,
        scoring_policy: true,
        section_configuration: true,
      },
    }),
  ]);
  const latestRules = new Map();
  for (const rule of rules) {
    if (!latestRules.has(rule.rule_key)) latestRules.set(rule.rule_key, rule);
  }
  const latestBlueprints = new Map();
  for (const blueprint of blueprints) {
    if (!latestBlueprints.has(blueprint.type)) latestBlueprints.set(blueprint.type, blueprint);
  }
  const mapBlueprint = (blueprint) => {
    const config = blueprint?.section_configuration || {};
    const scoring = blueprint?.scoring_policy || {};
    return {
      mcqs: Number(config.mcq_count || 0),
      mcqMarks: Number(scoring.mcq_correct || 0),
      subjective: Number(config.subjective_count || 0),
      subjectiveMarks: Number(config.subjective_marks || 0),
      max: Number(config.max_score || 0),
      durationMinutes: blueprint?.duration_minutes || 0,
      passages: Number(config.passage_count || config.passages || 0),
      mcqsPerPassage: Number(config.mcqs_per_passage || 0),
      partB: Number(config.part_b_count || 0),
      partC: Number(config.part_c_count || 0),
      negativeMarking: Number(scoring.mcq_incorrect || 0) < 0,
      pause: Boolean(scoring.pause_allowed),
      allCompulsory: config.all_compulsory === undefined
        ? null
        : config.all_compulsory !== false,
    };
  };
  return {
    patternRules: [...latestRules.values()].map((rule) => ({
      key: rule.rule_key,
      value: typeof rule.rule_value === 'string' ? rule.rule_value : JSON.stringify(rule.rule_value),
      sourceLabel: rule.source || 'Not specified',
      cohort: rule.effective_cohort || 'Not specified',
      confidence: rule.confidence || 'unverified',
      verifiedAt: null,
      isCurrent: true,
    })),
    blueprint: {
      weekly: mapBlueprint(latestBlueprints.get('weekly')),
      monthly: mapBlueprint(latestBlueprints.get('monthly')),
    },
    ai: {
      provider: 'Gemini',
      configured: Boolean(process.env.GEMINI_API_KEY),
      model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
      promptVersion: geminiPrompt.PROMPT_VERSION,
      prompt: geminiPrompt.getPromptTemplate(),
      maxAnswerChars: 4000,
      note: 'Maximum answer length: 4,000 characters.',
    },
  };
};

//For preview action
// Loads one revision note and maps its content for admin preview.
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
