'use strict';

const router = require('express').Router();
const c = require('../controllers/learnerController');

router.get('/dashboard', c.dashboard);

router.get('/courses', c.courses);
router.get('/courses/:id', c.courseDetail);

router.get('/weekly', c.weeklyIndex);
router.get('/weekly/:sprintId', c.weeklySprint);

router.get('/monthly', c.monthlyIndex);
router.get('/monthly/:simId', c.monthlyInstructions);
router.get('/monthly/:simId/attempt', c.monthlyAttempt);

router.get('/results', c.results);
router.get('/results/:id', c.resultDetail);

router.get('/leaderboard', c.leaderboard);
router.get('/profile', c.profile);
router.get('/notifications', c.notifications);

module.exports = router;
