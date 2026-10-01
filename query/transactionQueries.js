'use strict';

exports.begin = async (client) => client.query('BEGIN');
exports.commit = async (client) => client.query('COMMIT');
exports.rollback = async (client) => client.query('ROLLBACK');
