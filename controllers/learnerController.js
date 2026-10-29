'use strict';

/**
 * STAGE 1: every handler reads from services/mockService.js. There is no entitlement
 * check, attempt persistence, scoring or evaluation here — those are Stage 2.0
 */
const mock = require('../services/mockService');

const dash = ['dashboard'];
const assess = ['assessment'];

exports.dashboard = async (req, res, next) => {
  try {
    const data = await mock.getDashboard();
    return res.render('learner/dashboard', {
      title: 'Dashboard',
      pageStyles: dash,
      pageScripts: ['dashboard'],
      data,
      sprintHref: mock.sprintHref,
    });
  } catch (error) {
    return next(error);
  }
};

exports.courses = async (req, res, next) => {
  try {
    const courses = await mock.getCourses(req.user && req.user.id);
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

exports.courseDetail = async (req, res, next) => {
  try {
    const course = await mock.getCourse(
      req.params.id.toUpperCase(),
      req.user && req.user.id
    );
    if (!course) return next();
    return res.render('learner/course-detail', {
      title: course.name,
      pageStyles: dash,
      pageScripts: ['dashboard'],
      course,
    });
  } catch (error) {
    return next(error);
  }
};

exports.weeklyIndex = async (req, res, next) => {
  try {
    const weeks = await mock.getWeeklyOverview();
    return res.render('learner/weekly-index', {
      title: 'Weekly revision sprints',
      pageStyles: dash,
      pageScripts: ['dashboard'],
      weeks,
      sprintHref: mock.sprintHref,
    });
  } catch (error) {
    return next(error);
  }
};

exports.weeklySprint = async (req, res, next) => {
  try {
    const page = await mock.getSprint(req.params.sprintId);
    if (!page) return next();
    return res.render('learner/weekly-sprint', {
      title: `${page.sprint.courseName} — Week ${page.sprint.weekNumber}`,
      pageStyles: assess,
      pageScripts: ['assessment'],
      page,
    });
  } catch (error) {
    return next(error);
  }
};

exports.monthlyIndex = async (req, res, next) => {
  try {
    const sims = await mock.getMonthlyAssessments(req.user && req.user.id);
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

exports.monthlyInstructions = async (req, res, next) => {
  try {
    const [sim, patternRule] = await Promise.all([
      mock.getMonthlyAssessmentSummary(req.params.simId),
      mock.getExamPatternRule('monthly_exam_instructions'),
    ]);
    if (!sim) return next();
    return res.render('learner/monthly-instructions', {
      title: `${sim.courseName} — Monthly simulation`,
      pageStyles: assess,
      pageScripts: ['assessment'],
      sim,
      patternRule,
      hasPlayer: false,
    });
  } catch (error) {
    return next(error);
  }
};

exports.monthlyAttempt = (req, res, next) => {
  const sim = mock.getSimulationPlayer(req.params.simId);
  if (!sim) return next();
  // `?demoMinutes=` lets a reviewer see the expiry behaviour without waiting three hours. Stage 1 only.
  const demo = parseInt(req.query.demoMinutes, 10);
  const durationMinutes = demo >= 1 && demo <= 180 ? demo : sim.durationMinutes;
  res.render('learner/monthly-attempt', {
    title: `${sim.courseName} — Simulation`,
    layout: 'focus',
    pageStyles: assess,
    pageScripts: ['timer', 'assessment'],
    sim,
    durationMinutes,
  });
};

exports.results = (req, res) => {
  res.render('learner/results', { title: 'Results', pageStyles: assess.concat(dash), results: mock.getResults() });
};

exports.resultDetail = (req, res, next) => {
  const result = mock.getResult(req.params.id);
  if (!result) return next();
  res.render('learner/result-detail', { title: 'Result', pageStyles: assess, result });
};

exports.leaderboard = (req, res) => {
  res.render('learner/leaderboard', {
    title: 'Leaderboard',
    pageStyles: dash.concat(['assessment']),
    pageScripts: ['leaderboard'],
    lb: mock.getLeaderboard(req.query),
  });
};

exports.profile = (req, res) => {
  res.render('learner/profile', { title: 'Account', pageStyles: dash, plans: mock.getPlans() });
};

exports.notifications = (req, res) => {
  res.render('learner/notifications', { title: 'Notifications', pageStyles: dash, pageScripts: ['dashboard'], notifications: mock.getNotifications() });
};
