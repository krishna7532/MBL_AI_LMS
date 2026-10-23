'use strict';

const app = require('./app');
const config = require('./config');
const prisma = require('./config/db');

async function start() {
  try {
    await prisma.$connect();
    const server = app.listen(config.port, () => {
      console.log(`MBL-AI LMS listening on http://localhost:${config.port}`);
    });

    for (const signal of ['SIGINT', 'SIGTERM']) {
      process.once(signal, () => {
        server.close(async (error) => {
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
