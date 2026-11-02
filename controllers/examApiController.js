'use strict';

const exams = require('../services/examService');

// Forwards asynchronous API handler errors to Express error middleware.
function handle(operation) {
  return async (req, res, next) => {
    try {
      return await operation(req, res);
    } catch (error) {
      return next(error);
    }
  };
}

// Creates start, read, autosave, and submit handlers for one exam type.
function createExamHandlers(type) {
  return {
    // Starts or resumes an attempt for the requested assessment.
    start: handle(async (req, res) => {
      const attempt = await exams.ensureAttempt(
        req.user.id,
        req.params.assessmentId,
        type,
        { newAttempt: req.body && req.body.retake === true }
      );
      return res.status(200).json({ success: true, attempt });
    }),

    // Returns a learner-owned attempt and its saved answers.
    read: handle(async (req, res) => {
      const attempt = await exams.getAttempt(
        req.user.id,
        req.params.attemptId,
        req.params.assessmentId
      );
      return res.json({ success: true, attempt });
    }),

    // Persists the submitted answer draft for an open attempt.
    autosave: handle(async (req, res) => {
      const saved = await exams.saveResponses(
        req.user.id,
        req.params.attemptId,
        req.params.assessmentId,
        req.body && req.body.responses
      );
      return res.json({ success: true, ...saved });
    }),

    // Finalizes the attempt and returns its persisted result.
    submit: handle(async (req, res) => {
      const result = await exams.submitAttempt(
        req.user.id,
        req.params.attemptId,
        req.params.assessmentId,
        req.body && req.body.responses
      );
      return res.json({ success: true, result });
    }),
  };
}

module.exports = { createExamHandlers };
