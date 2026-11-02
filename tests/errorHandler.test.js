'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const errorHandler = require('../middleware/errorHandler');

function invokeHandler(error, { path = '/api/example', accepts = 'json' } = {}) {
  const result = {};
  const req = {
    method: 'POST',
    path,
    user: null,
    accepts: () => accepts,
  };
  const res = {
    headersSent: false,
    status(status) {
      result.status = status;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    },
    render(view, locals) {
      result.view = view;
      result.locals = locals;
      return this;
    },
  };
  const originalError = console.error;
  console.error = () => {};
  try {
    errorHandler(error, req, res, (nextError) => {
      result.nextError = nextError;
    });
  } finally {
    console.error = originalError;
  }
  return result;
}

test('hides unexpected error details and Prisma codes from API responses', () => {
  const error = new Error('column users.password_hash does not exist at C:\\app\\db.js:42');
  error.code = 'P2022';
  error.stack = 'sensitive stack trace';

  const result = invokeHandler(error);

  assert.equal(result.status, 500);
  assert.deepEqual(result.body, {
    success: false,
    message: 'Something went wrong. Please try again later.',
  });
  assert.equal(JSON.stringify(result.body).includes('P2022'), false);
  assert.equal(JSON.stringify(result.body).includes('db.js'), false);
  assert.equal(JSON.stringify(result.body).includes('stack trace'), false);
});

test('maps duplicate Prisma records to a safe conflict response', () => {
  const error = new Error('Unique constraint failed on the users.email column');
  error.code = 'P2002';

  const result = invokeHandler(error);

  assert.equal(result.status, 409);
  assert.deepEqual(result.body, {
    success: false,
    message: 'That information is already in use. Please check and try again.',
  });
});

test('maps malformed request bodies to a safe validation response', () => {
  const error = new SyntaxError('Unexpected token in JSON at C:\\app\\routes.js');
  error.status = 400;
  error.type = 'entity.parse.failed';

  const result = invokeHandler(error);

  assert.equal(result.status, 400);
  assert.deepEqual(result.body, {
    success: false,
    message: 'The submitted information could not be read. Please check it and try again.',
  });
});

test('uses friendly messages in HTML without rendering technical details', () => {
  const error = new Error('Internal database query and stack details');
  error.status = 500;

  const result = invokeHandler(error, { path: '/dashboard', accepts: 'html' });

  assert.equal(result.status, 500);
  assert.equal(result.view, 'errors/500');
  assert.equal(result.locals.detail, 'Something went wrong. Please try again later.');
  assert.equal(result.locals.status, 500);
});

test('allows explicitly marked application messages while hiding raw messages by default', () => {
  const error = new Error('Internal reason');
  error.status = 409;
  error.publicMessage = 'This attempt is already closed.';

  const result = invokeHandler(error);

  assert.equal(result.body.message, 'This attempt is already closed.');
});
