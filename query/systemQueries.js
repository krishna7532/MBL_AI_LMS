'use strict';

const pool = require('../config/db');

exports.getDatabaseTime = async () => pool.query('SELECT NOW()');
