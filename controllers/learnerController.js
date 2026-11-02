'use strict';

/**
 * Learner page handlers coordinate database-backed exam attempts and existing LMS pages.
 */
const dataService = require('../services/lmsDataService');
const exams = require('../services/examService');
const payments = require('../services/paymentService').service;

const dash = ['dashboard'];
const assess = ['assessment'];

// Renders the dashboard with the learner's subscription and recent results.
exports.dashboard = async (req, res, next) => {
  try {
    const data = await dataService.getDashboard(req.user.id);
    const [subscription, recentResults] = await Promise.all([
      payments.getCurrentSubscription(req.user.id),
      exams.listResults(req.user.id, 3),
    ]);
    data.recentResults = recentResults;
    return res.render('learner/dashboard', {
      title: 'Dashboard',
      pageStyles: dash,
      pageScripts: ['dashboard'],
      data,
      subscription,
      sprintHref: dataService.sprintHref,
    });
  } catch (error) {
    return next(error);
  }
};

// Displays courses and the learner's weekly sprint progress.
exports.courses = async (req, res, next) => {
  try {
    const courses = await dataService.getCourses(req.user && req.user.id);
    return res.render('learner/courses', {
      title: 'Courses',
      pageStyles: dash,
      pageScripts: ['dashboard'],
      courses,
    });
  } catch (error) {
    return next(error);
  }
};

// Loads and renders one course's details.
exports.courseDetail = async (req, res, next) => {
  try {
    const course = await dataService.getCourse(
      req.params.id.toUpperCase(),
      req.user && req.user.id
    );
    if (!course) return next();
    return res.render('learner/course-detail', {
      title: course.name,
      bodyClass: 'course-detail-page',
      pageStyles: dash,
      pageScripts: ['dashboard'],
      course,
    });
  } catch (error) {
    return next(error);
  }
};

// Shows published weekly releases and their sprint links.
exports.weeklyIndex = async (req, res, next) => {
  try {
    const weeks = await dataService.getWeeklyOverview();
    return res.render('learner/weekly-index', {
      title: 'Weekly revision sprints',
      pageStyles: dash,
      pageScripts: ['dashboard'],
      weeks,
      sprintHref: dataService.sprintHref,
    });
  } catch (error) {
    return next(error);
  }
};

// Resumes or creates the learner's attempt before rendering a weekly sprint.
exports.weeklySprint = async (req, res, next) => {
  try {
    const page = await dataService.getSprint(req.params.sprintId);
    if (!page) return next();
    if (!page.hasContent || !page.sprint.id) return next();
    page.attempt = await exams.ensureAttempt(req.user.id, page.sprint.id, 'weekly', {
      newAttempt: req.query.retake === '1',
    });
    if (page.attempt.state !== 'in_progress') {
      return res.redirect(page.attempt.resultUrl);
    }
    return res.render('learner/weekly-sprint', {
      title: `${page.sprint.courseName} — Week ${page.sprint.weekNumber}`,
      pageStyles: assess,
      pageScripts: ['timer', 'assessment'],
      page,
    });
  } catch (error) {
    return next(error);
  }
};

// Groups published monthly assessments by release month.
exports.monthlyIndex = async (req, res, next) => {
  try {
    const sims = await dataService.getMonthlyAssessments(req.user && req.user.id);
    const monthsByNumber = new Map();
    for (const sim of sims) {
      const monthKey = sim.month === null || sim.month === undefined
        ? 'unassigned'
        : String(sim.month);
      if (!monthsByNumber.has(monthKey)) {
        monthsByNumber.set(monthKey, { number: sim.month, assessments: [] });
      }
      monthsByNumber.get(monthKey).assessments.push(sim);
    }
    const months = [...monthsByNumber.values()].sort((a, b) => {
      if (a.number === null || a.number === undefined) return 1;
      if (b.number === null || b.number === undefined) return -1;
      return b.number - a.number;
    });

    return res.render('learner/monthly', {
      title: 'Monthly Revision',
      pageStyles: dash,
      months,
    });
  } catch (error) {
    return next(error);
  }
};

// Renders monthly exam instructions with the configured pattern rule.
exports.monthlyInstructions = async (req, res, next) => {
  try {
    const [sim, patternRule] = await Promise.all([
      dataService.getMonthlyAssessmentSummary(req.params.simId),
      dataService.getExamPatternRule('monthly_exam_instructions'),
    ]);
    if (!sim) return next();
    return res.render('learner/monthly-instructions', {
      title: `${sim.courseName} — Monthly simulation`,
      pageStyles: assess,
      pageScripts: ['assessment'],
      sim,
      patternRule,
      hasPlayer: true,
    });
  } catch (error) {
    return next(error);
  }
};

// Resumes or creates a monthly attempt and restores its saved answers.
exports.monthlyAttempt = async (req, res, next) => {
  try {
    const sim = await dataService.getSimulationPlayer(req.params.simId);
    if (!sim) return next();
    sim.attempt = await exams.ensureAttempt(req.user.id, sim.id, 'monthly', {
      newAttempt: req.query.retake === '1',
    });
    if (sim.attempt.state !== 'in_progress') {
      return res.redirect(sim.attempt.resultUrl);
    }
    sim.savedResponses = sim.attempt.savedResponses;
    return res.render('learner/monthly-attempt', {
      title: `${sim.courseName} — Simulation`,
      layout: 'focus',
      pageStyles: assess,
      pageScripts: ['timer', 'assessment'],
      sim,
      durationMinutes: sim.durationMinutes,
    });
  } catch (error) {
    return next(error);
  }
};

// Lists the learner's persisted exam results.
exports.results = async (req, res, next) => {
  try {
    const results = await exams.listResults(req.user.id);
    return res.render('learner/results', {
      title: 'Results',
      pageStyles: assess.concat(dash),
      results,
    });
  } catch (error) {
    return next(error);
  }
};

// Renders a learner-owned database result or a legacy mock result.
exports.resultDetail = async (req, res, next) => {
  try {
    let result;
    try {
      result = await exams.getAttemptResult(req.user.id, req.params.id);
    } catch (error) {
      if (error.code === 'RESULT_NOT_FOUND' || error.code === 'INVALID_ID') return next();
      throw error;
    }
    if (!result) return next();
    return res.render('learner/result-detail', {
      title: 'Result',
      pageStyles: assess,
      result,
    });
  } catch (error) {
    return next(error);
  }
};

// Displays the leaderboard using the requested filters.
exports.leaderboard = async (req, res, next) => {
  try {
    const lb = await dataService.getLeaderboard(req.query, req.user.id);
    return res.render('learner/leaderboard', {
      title: 'Leaderboard',
      pageStyles: dash.concat(['assessment']),
      pageScripts: ['leaderboard'],
      lb,
    });
  } catch (error) {
    return next(error);
  }
};

// Shows available plans, payment history, and the current subscription.
exports.profile = async (req, res, next) => {
  try {
    const [plans, paymentHistory, subscription] = await Promise.all([
      payments.getActivePlans(),
      payments.getPaymentHistory(req.user.id),
      payments.getCurrentSubscription(req.user.id),
    ]);
    return res.render('learner/profile', {
      title: 'Account',
      pageStyles: dash,
      pageScripts: ['dashboard', 'payments'],
      plans,
      paymentHistory,
      subscription,
    });
  } catch (error) {
    return next(error);
  }
};

// Renders the learner's notifications.
exports.notifications = async (req, res, next) => {
  try {
    const notifications = await dataService.getNotifications(req.user.id);
    return res.render('learner/notifications', {
      title: 'Notifications',
      pageStyles: dash,
      pageScripts: ['dashboard'],
      notifications,
    });
  } catch (error) {
    return next(error);
  }
};
