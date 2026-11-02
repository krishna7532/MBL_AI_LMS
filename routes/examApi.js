'use strict';

const router = require('express').Router();
const { createExamHandlers } = require('../controllers/examApiController');
const requireLearner = require('../middleware/requireLearner');
const requireSameOrigin = require('../middleware/requireSameOrigin');

// Enforce learner entitlement on all exam API endpoints
router.use(requireLearner);

// Mounts the common attempt endpoints for weekly or monthly assessments.
function mountExamRoutes(path, type) {
  const handlers = createExamHandlers(type);
  router.post(`${path}/:assessmentId/attempts`, requireSameOrigin, handlers.start);
  router.get(`${path}/:assessmentId/attempts/:attemptId`, handlers.read);
  router.post(`${path}/:assessmentId/attempts/:attemptId/autosave`, requireSameOrigin, handlers.autosave);
  router.post(`${path}/:assessmentId/attempts/:attemptId/submit`, requireSameOrigin, handlers.submit);
}

mountExamRoutes('/weekly-sprints', 'weekly');
mountExamRoutes('/monthly-simulations', 'monthly');

module.exports = router;
