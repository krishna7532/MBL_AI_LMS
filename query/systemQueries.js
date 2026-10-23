'use strict';

const prisma = require('../config/db');

exports.getDatabaseTime = async () => prisma.$queryRaw`SELECT NOW() AS now`;
