'use strict';
require('dotenv').config();

const app = require('./app');
const config = require('./config');
const prisma = require('./config/db');
const exams = require('./services/examService');
const trials = require('./services/trialExpiryService');
const evaluation=require('./services/evaluationWorker');

// Starts the application workers and HTTP server, then handles clean shutdown.
async function start() {
  try {
    await prisma.$connect();
    const stopExpiryWorker = exams.startExpiryWorker({
      onError: (message, error) => {
        console.error(message, error);
      },
    });
    const stopTrialExpiryWorker = trials.startExpiryWorker({
      onError: (message, error) => {
        console.error(message, error);
      },
    });

    const stopEvalutionWorker=evaluation.startEvaluationWorker({
      onError: (message, error) => {
    console.error(message, error);
  },
    });

    const server = app.listen(config.port, () => {
      console.log(`MBL-AI LMS listening on http://localhost:${config.port}`);
    });

    for (const signal of ['SIGINT', 'SIGTERM']) {
      process.once(signal, () => {
        server.close(async (error) => {
          stopExpiryWorker();
          stopTrialExpiryWorker();
          stopEvalutionWorker();
          if (error) {
            console.error('HTTP server shutdown failed:', error.code || error.name);
            process.exitCode = 1;
          }

          try {
            await prisma.$disconnect();
          } catch (disconnectError) {
            console.error('Database shutdown failed:', disconnectError.code || disconnectError.name);
            process.exitCode = 1;
          }
        });
      });
    }
  } catch (error) {
    console.error('Application startup failed:', error.code || error.name);
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error('Database shutdown failed:', disconnectError.code || disconnectError.name);
    }
    process.exitCode = 1;
  }
}

start();
