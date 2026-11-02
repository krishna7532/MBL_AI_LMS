'use strict';

const path = require('node:path');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3001,
  isProduction: process.env.NODE_ENV === 'production',
};
