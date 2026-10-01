'use strict';

const pool = require('../config/db');

exports.upsertGoogleUser = async (googleSubject, name, email) =>
  pool.query(
    `INSERT INTO users (google_subject, name, email)
     VALUES ($1, $2, $3)
     ON CONFLICT (google_subject)
     DO UPDATE SET
       name = EXCLUDED.name,
       email = EXCLUDED.email,
       updated_at = NOW()
     RETURNING id, google_subject, name, email, phone, role, account_state, created_at`,
    [googleSubject, name, email]
  );

exports.getUserById = async (userId) =>
  pool.query(
    `SELECT id, google_subject, name, email, phone, role, account_state, created_at
     FROM users
     WHERE id = $1`,
    [userId]
  );

exports.getUserForApplication = async (client, userId) =>
  client.query(
    `SELECT id, account_state
     FROM users
     WHERE id = $1
     FOR UPDATE`,
    [userId]
  );

exports.updateUserApplication = async (client, phone, userId) =>
  client.query(
    `UPDATE users
     SET phone = $1,
         account_state = 'pending_approval',
         updated_at = NOW()
     WHERE id = $2`,
    [phone, userId]
  );
