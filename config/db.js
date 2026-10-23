'use strict';

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const ensureDatabaseUrl = require('./databaseUrl');

if (!ensureDatabaseUrl()) {
  throw new Error('Configure DATABASE_URL or all legacy DB_* PostgreSQL settings.');
}

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
