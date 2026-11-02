'use strict';

const prisma = require('../config/db');

// Runs a raw SQL query to get the current database timestamp for health checks
exports.getDatabaseTime = async () => prisma.$queryRaw`SELECT NOW() AS now`;
