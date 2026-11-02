'use strict';

const router = require('express').Router();
const c = require('../controllers/learnerController');
const requireLearner = require('../middleware/routeAccess').requireLearner;

// Restricts learner pages to authenticated users with current access.
router.use(
  ['/dashboard', '/courses', '/weekly', '/monthly', '/results', '/leaderboard', '/profile', '/notifications'],
  requireLearner
);

// Learner dashboard
router.get('/dashboard', c.dashboard);

// Course overview and single course detail
router.get('/courses', c.courses);
router.get('/courses/:id', c.courseDetail);

// Weekly revision sprints
router.get('/weekly', c.weeklyIndex);
router.get('/weekly/:sprintId', c.weeklySprint);

// Monthly exam simulations and attempt interface
router.get('/monthly', c.monthlyIndex);
router.get('/monthly/:simId', c.monthlyInstructions);
router.get('/monthly/:simId/attempt', c.monthlyAttempt);

// Exam results and evaluation feedback details
router.get('/results', c.results);
router.get('/results/:id', c.resultDetail);

// Leaderboard, profile settings, and notifications
router.get('/leaderboard', c.leaderboard);
router.get('/profile', c.profile);
router.get('/notifications', c.notifications);

module.exports = router;
