'use strict';

// Re-exports the shared learner authorization middleware for exam routes.
module.exports = require('./routeAccess').requireLearner;
