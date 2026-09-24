'use strict';

/**
 * STAGE 1: every handler reads from services/mockService.js. There is no entitlement
 * check, attempt persistence, scoring or evaluation here — those are Stage 2.
 */
const mock = require('../services/mockService');

const dash = ['dashboard'];
const assess = ['assessment'];

exports.dashboard = (req, res) => {
  res.render('learner/dashboard', {
    title: 'Dashboard',
    pageStyles: dash,
    pageScripts: ['dashboard'],
    data: mock.getDashboard(),
    sprintHref: mock.sprintHref,
  });
};

exports.courses = (req, res) => {
  res.render('learner/courses', { title: 'Courses', pageStyles: dash, pageScripts: ['dashboard'], courses: mock.getCourses() });
};

exports.courseDetail = (req, res, next) => {
  const course = mock.getCourse(req.params.id.toUpperCase());
  if (!course) return next();
  res.render('learner/course-detail', { title: course.name, pageStyles: dash, pageScripts: ['dashboard'], course, sprintHref: mock.sprintHref });
};

exports.weeklyIndex = (req, res) => {
  res.render('learner/weekly-index', {
    title: 'Weekly revision sprints',
    pageStyles: dash,
    pageScripts: ['dashboard'],
    weeks: mock.getWeeklyOverview(),
    sprintHref: mock.sprintHref,
  });
};

exports.weeklySprint = (req, res, next) => {
  const page = mock.getSprint(req.params.sprintId);
  if (!page) return next();
  res.render('learner/weekly-sprint', {
    title: `${page.sprint.courseName} — Week ${page.sprint.weekNumber}`,
    pageStyles: assess,
    pageScripts: ['assessment'],
    page,
  });
};

exports.monthlyIndex = (req, res) => {
  res.render('learner/monthly', { title: 'Monthly Revision', pageStyles: dash, sims: mock.getMonthly() });
};

exports.monthlyInstructions = (req, res, next) => {
  const sim = mock.getSimulationSummary(req.params.simId);
  if (!sim) return next();
  res.render('learner/monthly-instructions', {
    title: `${sim.courseName} — Monthly simulation`,
    pageStyles: assess,
    pageScripts: ['assessment'],
    sim,
    hasPlayer: sim._id === 'sim_m02_C01',
  });
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
