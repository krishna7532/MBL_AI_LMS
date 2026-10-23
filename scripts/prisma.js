'use strict';

require('dotenv').config();

const path = require('path');
const { spawnSync } = require('child_process');
const ensureDatabaseUrl = require('../config/databaseUrl');

if (!ensureDatabaseUrl()) {
  console.error('Configure DATABASE_URL or all legacy DB_* PostgreSQL settings.');
  process.exit(1);
}

const prismaCli = path.join(
  path.dirname(require.resolve('prisma/package.json')),
  'build',
  'index.js'
);
const result = spawnSync(process.execPath, [prismaCli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  console.error('Could not start Prisma CLI:', result.error.message);
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
