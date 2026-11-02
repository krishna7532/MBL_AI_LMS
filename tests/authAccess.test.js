'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const userQueries = require('../query/userQueries');
const authPolicy = require('../services/authPolicy');
const { resolveGoogleAccount } = require('../services/googleAuthService');
const { createRouteAccess } = require('../middleware/routeAccess');

const googleProfile = {
  id: 'google-subject-1',
  displayName: 'Test User',
  emails: [{ value: 'test@example.invalid' }],
};

function createResponse() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    redirect(path) {
      this.redirectTo = path;
      return this;
    },
    render(view, locals) {
      this.view = view;
      this.locals = locals;
      return this;
    },
  };
}

function invoke(middleware, req) {
  const res = createResponse();
  return new Promise((resolve) => {
    middleware(req, res, (error) => resolve({ next: true, error, req, res }));
    setImmediate(() => {
      if (res.redirectTo || res.body || res.view) resolve({ req, res });
    });
  });
}

function request({ user, originalUrl = '/dashboard' } = {}) {
  return { user, originalUrl };
}

function databaseUser(overrides = {}) {
  return {
    id: 'user-id',
    role: 'approved_trial_learner',
    account_state: 'active',
    deleted_at: null,
    trials: [],
    subscriptions: [],
    ...overrides,
  };
}

test('Google profile resolves an existing database identity without changing its role', async () => {
  const calls = [];
  const databaseUserRow = {
    id: 'user-id',
    google_subject: googleProfile.id,
    role: 'admin_publisher',
    account_state: 'active',
  };
  const queries = {
    getUserByGoogleSubject: async (_prisma, subject) => {
      calls.push(['find', subject]);
      return { id: databaseUserRow.id };
    },
    upsertGoogleUser: async (_prisma, subject, name, email) => {
      calls.push(['upsert', subject, name, email]);
      return { id: databaseUserRow.id };
    },
    getUserById: async (_prisma, id) => {
      calls.push(['profile', id]);
      return databaseUserRow;
    },
  };

  const result = await resolveGoogleAccount(googleProfile, {}, queries);
  assert.equal(result.isNewUser, false);
  assert.equal(result.user.role, 'admin_publisher');
  assert.deepEqual(calls, [
    ['find', googleProfile.id],
    ['upsert', googleProfile.id, 'Test User', 'test@example.invalid'],
    ['profile', 'user-id'],
  ]);
});

test('Google profile creates a new database identity and marks it for application', async () => {
  const queries = {
    getUserByGoogleSubject: async () => null,
    upsertGoogleUser: async () => ({ id: 'new-user-id' }),
    getUserById: async () => ({
      id: 'new-user-id',
      role: 'applicant',
      account_state: 'pending_approval',
    }),
  };

  const result = await resolveGoogleAccount(googleProfile, {}, queries);
  assert.equal(result.isNewUser, true);
  assert.equal(authPolicy.getPostLoginPath({ ...result.user, isNewUser: result.isNewUser }), '/apply');
});

test('a later Google login reuses the same user and honors its updated database role', async () => {
  let savedUser = null;
  let createCount = 0;
  const queries = {
    getUserByGoogleSubject: async () => savedUser && { id: savedUser.id },
    upsertGoogleUser: async () => {
      if (!savedUser) {
        createCount += 1;
        savedUser = {
          id: 'existing-id',
          role: 'applicant',
          account_state: 'pending_approval',
        };
      }
      return { id: savedUser.id };
    },
    getUserById: async () => savedUser,
  };

  const firstLogin = await resolveGoogleAccount(googleProfile, {}, queries);
  assert.equal(firstLogin.isNewUser, true);
  savedUser = { ...savedUser, role: 'admin_publisher', account_state: 'active' };
  const laterLogin = await resolveGoogleAccount(googleProfile, {}, queries);

  assert.equal(createCount, 1);
  assert.equal(laterLogin.isNewUser, false);
  assert.equal(authPolicy.getPostLoginPath({
    role: laterLogin.user.role,
    accountState: laterLogin.user.account_state,
  }), '/admin');
});

test('Google identity lookup uses google_subject and upsert does not assign a role', async () => {
  let lookupArgs;
  let upsertArgs;
  await userQueries.getUserByGoogleSubject({
    users: { findUnique: async (args) => { lookupArgs = args; return null; } },
  }, 'google-subject');
  await userQueries.upsertGoogleUser({
    users: { upsert: async (args) => { upsertArgs = args; return { id: 'user-id' }; } },
  }, 'google-subject', 'User', 'user@example.invalid');

  assert.deepEqual(lookupArgs.where, { google_subject: 'google-subject' });
  assert.equal(Object.hasOwn(upsertArgs.create, 'role'), false);
  assert.equal(Object.hasOwn(upsertArgs.update, 'role'), false);
});

test('Passport serializes the user id and reloads the database user on each request', async () => {
  const originalGetUserById = userQueries.getUserById;
  const restoredUser = {
    id: 'user-id',
    role: 'admin_publisher',
    account_state: 'active',
    trials: [],
    subscriptions: [],
    consents: [],
  };
  userQueries.getUserById = async (_prisma, id) => id === restoredUser.id ? restoredUser : null;

  try {
    const passport = require('../config/passport');
    const serializer = passport._serializers[0];
    const deserializer = passport._deserializers[0];
    const sessionId = await new Promise((resolve, reject) => {
      serializer({ id: restoredUser.id }, (error, id) => error ? reject(error) : resolve(id));
    });
    const reloaded = await new Promise((resolve, reject) => {
      deserializer(sessionId, (error, user) => error ? reject(error) : resolve(user));
    });

    assert.equal(sessionId, restoredUser.id);
    assert.equal(reloaded.id, restoredUser.id);
    assert.equal(reloaded.role, 'admin_publisher');
  } finally {
    userQueries.getUserById = originalGetUserById;
  }
});

test('logout clears the Passport session and redirects to sign-in', async () => {
  const authRouter = require('../routes/auth');
  const logoutLayer = authRouter.stack.find(
    (layer) => layer.route && layer.route.path === '/logout'
  );
  assert.ok(logoutLayer);

  let loggedOut = false;
  const res = createResponse();
  await new Promise((resolve, reject) => {
    logoutLayer.route.stack[0].handle(
      {
        logout(callback) {
          loggedOut = true;
          callback(null);
        },
      },
      res,
      reject
    );
    setImmediate(resolve);
  });

  assert.equal(loggedOut, true);
  assert.equal(res.redirectTo, '/login');
});

test('login destination follows database roles and account states', () => {
  assert.equal(authPolicy.getPostLoginPath({
    role: 'admin_publisher',
    accountState: 'active',
  }), '/admin');
  assert.equal(authPolicy.getPostLoginPath({
    role: 'approved_trial_learner',
    accountState: 'active',
  }), '/dashboard');
  assert.equal(authPolicy.getPostLoginPath({
    role: 'paid_learner',
    accountState: 'paid_active',
    subscriptionActive: true,
  }), '/dashboard');
  assert.equal(authPolicy.getPostLoginPath({
    role: 'approved_trial_learner',
    accountState: 'trial_active',
    trial: { isActive: true },
  }), '/dashboard');
  assert.equal(authPolicy.getPostLoginPath({
    role: 'approved_trial_learner',
    accountState: 'pending_approval',
  }), '/pending');
  assert.equal(authPolicy.getPostLoginPath({
    role: 'applicant',
    accountState: 'rejected',
  }), '/rejected');
  assert.equal(authPolicy.getPostLoginPath({
    role: 'paid_learner',
    accountState: 'suspended',
  }), '/rejected');
  assert.equal(authPolicy.getPostLoginPath({
    role: 'paid_learner',
    accountState: 'paid_expired',
  }), '/login?access=restricted');
  assert.equal(authPolicy.getPostLoginPath({
    role: 'applicant',
    accountState: 'pending_approval',
    isNewUser: true,
  }), '/apply');
});

test('unauthenticated dashboard requests redirect to login and API requests receive 401', async () => {
  const access = createRouteAccess({ users: { findUnique: async () => null } });
  const page = await invoke(access.requireLearner, request());
  assert.equal(page.res.redirectTo, '/login');

  const api = await invoke(access.requireAdmin, request({ originalUrl: '/api/admin' }));
  assert.equal(api.res.statusCode, 401);
  assert.equal(api.res.body.success, false);
});

test('admin guard trusts the database role and excludes learners', async () => {
  const access = createRouteAccess({
    users: { findUnique: async () => databaseUser({ role: 'admin_publisher' }) },
  });
  const allowed = await invoke(access.requireAdmin, request({ user: { id: 'user-id', role: 'approved_trial_learner' } }));
  assert.equal(allowed.next, true);
  assert.equal(allowed.req.authorizationUser.role, 'admin_publisher');

  const learnerAccess = createRouteAccess({
    users: { findUnique: async () => databaseUser() },
  });
  const denied = await invoke(
    learnerAccess.requireAdmin,
    request({ user: { id: 'user-id' }, originalUrl: '/api/admin/users' })
  );
  assert.equal(denied.res.statusCode, 403);

  const editorAccess = createRouteAccess({
    users: { findUnique: async () => databaseUser({ role: 'content_editor' }) },
  });
  const editorDenied = await invoke(
    editorAccess.requireAdmin,
    request({ user: { id: 'user-id' }, originalUrl: '/api/admin/users' })
  );
  assert.equal(editorDenied.res.statusCode, 403);
});

test('learner guard excludes admins and restricted or expired accounts', async () => {
  const adminAccess = createRouteAccess({
    users: { findUnique: async () => databaseUser({ role: 'admin_publisher' }) },
  });
  const adminDenied = await invoke(
    adminAccess.requireLearner,
    request({ user: { id: 'user-id' }, originalUrl: '/api/weekly' })
  );
  assert.equal(adminDenied.res.statusCode, 403);

  for (const user of [
    databaseUser({ account_state: 'pending_approval' }),
    databaseUser({ account_state: 'rejected' }),
    databaseUser({ account_state: 'suspended' }),
    databaseUser({ account_state: 'trial_expired' }),
    databaseUser({ account_state: 'trial_active', trials: [] }),
    databaseUser({ role: 'expired_learner', account_state: 'active' }),
  ]) {
    const access = createRouteAccess({ users: { findUnique: async () => user } });
    const denied = await invoke(access.requireLearner, request({ user: { id: 'user-id' } }));
    assert.equal(denied.res.statusCode, 403);
  }
});

test('learner guard permits only an active entitlement and missing database users are rejected', async () => {
  const trialAccess = createRouteAccess({
    users: {
      findUnique: async () => databaseUser({
        account_state: 'trial_active',
        trials: [{ id: 'trial-id' }],
      }),
    },
  });
  const allowed = await invoke(trialAccess.requireLearner, request({ user: { id: 'user-id' } }));
  assert.equal(allowed.next, true);

  const subscriptionAccess = createRouteAccess({
    users: {
      findUnique: async () => databaseUser({
        role: 'paid_learner',
        account_state: 'paid_active',
        subscriptions: [{ id: 'subscription-id' }],
      }),
    },
  });
  const paidAllowed = await invoke(
    subscriptionAccess.requireLearner,
    request({ user: { id: 'user-id' } })
  );
  assert.equal(paidAllowed.next, true);

  const missingUserAccess = createRouteAccess({
    users: { findUnique: async () => null },
  });
  const missingUser = await invoke(
    missingUserAccess.requireLearner,
    request({ user: { id: 'deleted-user-id' } })
  );
  assert.equal(missingUser.res.redirectTo, '/login');
});
