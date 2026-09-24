'use strict';

require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  isProduction: process.env.NODE_ENV === 'production',
  // STAGE 2: sessionSecret, database URL, Google OAuth and Razorpay keys are read here.
};
