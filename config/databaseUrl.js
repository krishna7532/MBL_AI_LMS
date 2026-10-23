'use strict';

module.exports = function ensureDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const { DB_USER, DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT } = process.env;
  if (!DB_USER || !DB_HOST || !DB_NAME || DB_PASSWORD === undefined || !DB_PORT) return null;

  process.env.DATABASE_URL =
    `postgresql://${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASSWORD)}` +
    `@${DB_HOST}:${DB_PORT}/${encodeURIComponent(DB_NAME)}?schema=public`;

  return process.env.DATABASE_URL;
};
