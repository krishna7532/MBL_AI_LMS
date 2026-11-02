'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createPaymentService } = require('../services/paymentService');

const KEY_SECRET = 'test-key-secret';
const WEBHOOK_SECRET = 'test-webhook-secret';
const FIXED_NOW = new Date('2026-10-30T00:00:00.000Z');

function createFakeDatabase(planCode = 'annual', activeSubscription = null) {
  const plan = {
    id: `plan-${planCode}`,
    code: planCode,
    price: planCode === 'annual' ? '20000' : '35000',
    currency: 'INR',
    duration_years: planCode === 'annual' ? 1 : 5,
    duration_months: null,
  };
  const payment = {
    id: 'payment-1',
    user_id: 'user-1',
    plan_id: plan.id,
    razorpay_order_id: 'order-1',
    razorpay_payment_id: null,
    amount: plan.price,
    currency: 'INR',
    state: 'created',
    idempotency_key: 'idempotency-1',
  };
  const events = new Map();
  const subscriptions = [];
  const user = {
    id: 'user-1',
    role: 'approved_trial_learner',
    account_state: 'trial_active',
    deleted_at: null,
  };
  const queries = {};
  const database = {
    plans: {
      findMany: async () => [plan],
      findFirst: async (args) => args.where.code === plan.code ? plan : null,
      findUnique: async (args) => args.where.id === plan.id ? plan : null,
    },
    payments: {
      create: async ({ data }) => Object.assign(payment, data),
      findUnique: async ({ where }) => where.idempotency_key === payment.idempotency_key ||
        where.razorpay_order_id === payment.razorpay_order_id
        ? payment
        : null,
      findFirst: async (args) =>
        args.where.user_id === payment.user_id &&
        args.where.razorpay_order_id === payment.razorpay_order_id
          ? payment
          : null,
      updateMany: async ({ where, data }) => {
        if (where.id !== payment.id || !where.state.in.includes(payment.state)) {
          return { count: 0 };
        }
        Object.assign(payment, data);
        return { count: 1 };
      },
      findMany: async (args) => {
        queries.historyWhere = args.where;
        return [payment];
      },
    },
    subscriptions: {
      findFirst: async ({ where }) => where.payment_id
        ? subscriptions.find((subscription) =>
          subscription.payment_id === where.payment_id && subscription.status === 'active'
        ) || null
        : activeSubscription,
      create: async ({ data }) => {
        subscriptions.push(data);
        return data;
      },
    },
    users: {
      findUnique: async () => user,
      update: async ({ data }) => Object.assign(user, data),
    },
    payment_webhook_events: {
      create: async ({ data }) => {
        if (events.has(data.event_id)) {
          const error = new Error('Duplicate webhook event');
          error.code = 'P2002';
          throw error;
        }
        events.set(data.event_id, data);
        return data;
      },
      findUnique: async ({ where }) => events.has(where.event_id)
        ? { id: where.event_id }
        : null,
    },
    $transaction: async (callback) => callback(database),
  };

  return { database, payment, plan, subscriptions, user, queries, events };
}

function sign(secret, value) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

function createCapturedEvent({ orderId = 'order-1', amount = 2000000 } = {}) {
  return Buffer.from(JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'pay-1',
          order_id: orderId,
          amount,
          currency: 'INR',
          status: 'captured',
        },
      },
    },
  }));
}

function serviceFor(fake, overrides = {}) {
  return createPaymentService({
    database: fake.database,
    gatewayFactory: () => ({
      orders: { create: async (options) => {
        fake.queries.orderOptions = options;
        return { id: 'new-order' };
      } },
      payments: {
        fetch: async (paymentId) => ({
          id: paymentId,
          order_id: 'order-1',
          amount: 2000000,
          currency: 'INR',
          status: 'authorized',
        }),
      },
    }),
    keyId: 'rzp_test_public',
    keySecret: KEY_SECRET,
    webhookSecret: WEBHOOK_SECRET,
    now: () => new Date(FIXED_NOW),
    ...overrides,
  });
}

test('creates a Razorpay order using the database plan price in paise', async () => {
  const fake = createFakeDatabase();
  const service = serviceFor(fake);
  const order = await service.createOrder('user-1', 'annual', true, 'request-key-00000001');

  assert.equal(order.amount, 2000000);
  assert.equal(order.keyId, 'rzp_test_public');
  assert.equal(fake.queries.orderOptions.amount, 2000000);
  assert.equal(fake.queries.orderOptions.currency, 'INR');
  assert.equal(fake.queries.orderOptions.notes.user_id, 'user-1');
  assert.equal(fake.payment.plan_id, 'plan-annual');
  assert.equal(fake.payment.amount, '20000');
  assert.equal(fake.payment.state, 'created');
  assert.equal(fake.payment.refund_acknowledged_at.toISOString(), FIXED_NOW.toISOString());
});

test('rejects unauthenticated, invalid-plan, and unacknowledged payment orders', async () => {
  const service = serviceFor(createFakeDatabase());
  await assert.rejects(service.createOrder(null, 'annual', true, 'request-key-00000001'), { status: 401 });
  await assert.rejects(service.createOrder('user-1', 'made-up', true, 'request-key-00000001'), { status: 400 });
  await assert.rejects(service.createOrder('user-1', 'annual', false, 'request-key-00000001'), { status: 400 });
});

test('reports the exact missing Razorpay server configuration', async () => {
  const fake = createFakeDatabase();
  const service = createPaymentService({
    database: fake.database,
    keyId: 'your_test_key_id',
    keySecret: '',
    gatewayFactory: () => {
      throw new Error('Gateway must not be constructed without credentials.');
    },
  });

  await assert.rejects(
    service.createOrder('user-1', 'annual', true, 'request-key-00000001'),
    {
      status: 503,
      message: /RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.*project-root \.env.*restart the server/,
    }
  );
});

test('reuses an existing Razorpay order for a duplicate idempotency key', async () => {
  const fake = createFakeDatabase();
  let gatewayCalls = 0;
  const service = serviceFor(fake, {
    gatewayFactory: () => ({
      orders: { create: async () => {
        gatewayCalls += 1;
        return { id: 'new-order' };
      } },
    }),
  });
  const requestKey = 'request-key-00000002';

  const first = await service.createOrder('user-1', 'annual', true, requestKey);
  const second = await service.createOrder('user-1', 'annual', true, requestKey);

  assert.equal(first.orderId, 'new-order');
  assert.equal(second.orderId, first.orderId);
  assert.equal(gatewayCalls, 1);
});

test('maps Razorpay credential rejection to a safe actionable error', async () => {
  const fake = createFakeDatabase();
  const logged = [];
  const service = serviceFor(fake, {
    logger: { error: (...args) => logged.push(args) },
    gatewayFactory: () => ({
      orders: { create: async () => {
        const error = new Error('Do not expose provider request details.');
        error.statusCode = 401;
        error.error = { code: 'BAD_REQUEST_ERROR' };
        throw error;
      } },
    }),
  });

  await assert.rejects(
    service.createOrder('user-1', 'annual', true, 'request-key-00000003'),
    {
      status: 503,
      code: 'RAZORPAY_AUTH_FAILED',
      message: /matching pair/,
    }
  );
  assert.deepEqual(logged, [[
    'Razorpay order creation failed',
    { statusCode: 401, providerCode: 'BAD_REQUEST_ERROR' },
  ]]);
});

test('reports non-auth Razorpay API failures without exposing provider details', async () => {
  const fake = createFakeDatabase();
  const logged = [];
  const service = serviceFor(fake, {
    logger: { error: (...args) => logged.push(args) },
    gatewayFactory: () => ({
      orders: { create: async () => {
        const error = new Error('Sensitive provider response must not be returned.');
        error.statusCode = 400;
        error.error = { code: 'BAD_REQUEST_ERROR' };
        throw error;
      } },
    }),
  });

  await assert.rejects(
    service.createOrder('user-1', 'annual', true, 'request-key-00000004'),
    {
      status: 502,
      code: 'RAZORPAY_ORDER_FAILED',
      message: /could not create the payment order/,
    }
  );
  assert.equal(logged[0][1].statusCode, 400);
});

test('validates Checkout signature and immediately grants access and creates subscription', async () => {
  const fake = createFakeDatabase();
  const service = serviceFor(fake);
  const details = {
    razorpay_order_id: 'order-1',
    razorpay_payment_id: 'pay-1',
    razorpay_signature: sign(KEY_SECRET, 'order-1|pay-1'),
  };

  await assert.rejects(
    service.verifyCheckout('user-1', { ...details, razorpay_signature: 'invalid' }),
    { status: 400 }
  );
  const result = await service.verifyCheckout('user-1', details);
  assert.equal(result.verified, true);
  assert.equal(result.activated, true);
  assert.equal(fake.payment.state, 'captured');
  assert.equal(fake.subscriptions.length, 1);
  assert.equal(fake.user.role, 'paid_learner');
  assert.equal(fake.user.account_state, 'paid_active');
});

test('checkout verification activates a captured payment confirmed by Razorpay', async () => {
  const fake = createFakeDatabase();
  const service = serviceFor(fake, {
    gatewayFactory: () => ({
      payments: {
        fetch: async (paymentId) => ({
          id: paymentId,
          order_id: 'order-1',
          amount: 2000000,
          currency: 'INR',
          status: 'captured',
        }),
      },
    }),
  });
  const details = {
    razorpay_order_id: 'order-1',
    razorpay_payment_id: 'pay-1',
    razorpay_signature: sign(KEY_SECRET, 'order-1|pay-1'),
  };

  const result = await service.verifyCheckout('user-1', details);

  assert.equal(result.verified, true);
  assert.equal(result.activated, true);
  assert.equal(fake.payment.state, 'captured');
  assert.equal(fake.payment.razorpay_payment_id, 'pay-1');
  assert.equal(fake.subscriptions.length, 1);
  assert.equal(fake.subscriptions[0].ends_at.toISOString(), '2027-10-30T00:00:00.000Z');
  assert.equal(fake.user.role, 'paid_learner');
  assert.equal(fake.user.account_state, 'paid_active');
});

test('checkout verification recognizes a subscription created by a concurrent webhook', async () => {
  const fake = createFakeDatabase();
  fake.payment.state = 'captured';
  fake.subscriptions.push({
    payment_id: fake.payment.id,
    status: 'active',
  });
  const service = serviceFor(fake);
  const details = {
    razorpay_order_id: 'order-1',
    razorpay_payment_id: 'pay-1',
    razorpay_signature: sign(KEY_SECRET, 'order-1|pay-1'),
  };

  const result = await service.verifyCheckout('user-1', details);

  assert.equal(result.activated, true);
  assert.equal(result.captured, true);
});

test('reconciliation activates a captured payment from a previous checkout', async () => {
  const fake = createFakeDatabase();
  fake.payment.state = 'authorized';
  fake.payment.razorpay_payment_id = 'pay-1';
  const service = serviceFor(fake, {
    gatewayFactory: () => ({
      payments: {
        fetch: async (paymentId) => ({
          id: paymentId,
          order_id: 'order-1',
          amount: 2000000,
          currency: 'INR',
          status: 'captured',
        }),
      },
    }),
  });

  const result = await service.reconcilePayment('user-1', 'order-1');

  assert.equal(result.activated, true);
  assert.equal(result.captured, true);
  assert.equal(fake.payment.state, 'captured');
  assert.equal(fake.subscriptions.length, 1);
  assert.equal(fake.user.account_state, 'paid_active');
});

test('checkout verification refuses to activate mismatched provider payment details', async () => {
  const fake = createFakeDatabase();
  const service = serviceFor(fake, {
    gatewayFactory: () => ({
      payments: {
        fetch: async (paymentId) => ({
          id: paymentId,
          order_id: 'order-1',
          amount: 1,
          currency: 'INR',
          status: 'captured',
        }),
      },
    }),
  });
  const details = {
    razorpay_order_id: 'order-1',
    razorpay_payment_id: 'pay-1',
    razorpay_signature: sign(KEY_SECRET, 'order-1|pay-1'),
  };

  await assert.rejects(service.verifyCheckout('user-1', details), {
    status: 400,
    message: 'Captured payment does not match the stored order.',
  });
  assert.equal(fake.payment.state, 'authorized');
  assert.equal(fake.subscriptions.length, 0);
  assert.equal(fake.user.account_state, 'trial_active');
});

test('valid captured webhook activates the correct plan and sets one-year expiry', async () => {
  const fake = createFakeDatabase('annual');
  const service = serviceFor(fake);
  const rawBody = createCapturedEvent();
  const result = await service.processWebhook(
    rawBody,
    sign(WEBHOOK_SECRET, rawBody),
    'event-1'
  );

  assert.equal(result.activated, true);
  assert.equal(fake.payment.state, 'captured');
  assert.equal(fake.payment.razorpay_payment_id, 'pay-1');
  assert.equal(fake.payment.paid_at.toISOString(), FIXED_NOW.toISOString());
  assert.equal(fake.payment.raw_webhook_event.event, 'payment.captured');
  assert.equal(fake.subscriptions.length, 1);
  assert.equal(fake.subscriptions[0].plan_id, 'plan-annual');
  assert.equal(fake.subscriptions[0].starts_at.toISOString(), FIXED_NOW.toISOString());
  assert.equal(fake.subscriptions[0].ends_at.toISOString(), '2027-10-30T00:00:00.000Z');
  assert.equal(fake.subscriptions[0].status, 'active');
  assert.equal(fake.user.role, 'paid_learner');
  assert.equal(fake.user.account_state, 'paid_active');
});

test('a new purchase extends an existing active subscription', async () => {
  const currentEnd = new Date('2027-10-30T00:00:00.000Z');
  const fake = createFakeDatabase('annual', { ends_at: currentEnd });
  const service = serviceFor(fake);
  const rawBody = createCapturedEvent();

  const result = await service.processWebhook(
    rawBody,
    sign(WEBHOOK_SECRET, rawBody),
    'event-extension'
  );

  assert.equal(result.activated, true);
  assert.equal(fake.subscriptions[0].starts_at.toISOString(), currentEnd.toISOString());
  assert.equal(fake.subscriptions[0].ends_at.toISOString(), '2028-10-30T00:00:00.000Z');
});

test('database failure during capture leaves learner access unchanged', async () => {
  const fake = createFakeDatabase();
  fake.database.$transaction = async () => {
    throw new Error('Database transaction failed.');
  };
  const service = serviceFor(fake);
  const rawBody = createCapturedEvent();

  await assert.rejects(
    service.processWebhook(rawBody, sign(WEBHOOK_SECRET, rawBody), 'event-db-failure'),
    /Database transaction failed/
  );
  assert.equal(fake.payment.state, 'created');
  assert.equal(fake.subscriptions.length, 0);
  assert.equal(fake.user.account_state, 'trial_active');
});

test('completion plan activates for five years and duplicate webhook delivery is idempotent', async () => {
  const fake = createFakeDatabase('completion');
  const service = serviceFor(fake);
  const rawBody = createCapturedEvent({ amount: 3500000 });
  const signature = sign(WEBHOOK_SECRET, rawBody);

  const first = await service.processWebhook(rawBody, signature, 'event-completion');
  const duplicate = await service.processWebhook(rawBody, signature, 'event-completion');
  assert.equal(first.activated, true);
  assert.equal(duplicate.duplicate, true);
  assert.equal(fake.subscriptions.length, 1);
  assert.equal(fake.subscriptions[0].ends_at.toISOString(), '2031-10-30T00:00:00.000Z');
});

test('rejects invalid webhook signatures and mismatched captured amounts', async () => {
  const fake = createFakeDatabase();
  const service = serviceFor(fake);
  const body = createCapturedEvent();

  await assert.rejects(
    service.processWebhook(body, 'bad-signature', 'bad-signature-event'),
    { status: 400 }
  );
  await assert.rejects(
    service.processWebhook(
      createCapturedEvent({ amount: 1 }),
      sign(WEBHOOK_SECRET, createCapturedEvent({ amount: 1 })),
      'wrong-amount-event'
    ),
    { status: 400 }
  );
  assert.equal(fake.subscriptions.length, 0);
  assert.equal(fake.user.account_state, 'trial_active');
});

test('failed webhook records failure without activating a subscription', async () => {
  const fake = createFakeDatabase();
  const service = serviceFor(fake);
  const rawBody = Buffer.from(JSON.stringify({
    event: 'payment.failed',
    payload: {
      payment: {
        entity: { id: 'pay-failed', order_id: 'order-1', status: 'failed' },
      },
    },
  }));

  const result = await service.processWebhook(
    rawBody,
    sign(WEBHOOK_SECRET, rawBody),
    'failed-event'
  );
  assert.equal(result.activated, false);
  assert.equal(fake.payment.state, 'failed');
  assert.equal(fake.subscriptions.length, 0);
  assert.equal(fake.user.account_state, 'trial_active');
});

test('payment history is scoped to the requesting user', async () => {
  const fake = createFakeDatabase();
  const history = await serviceFor(fake).getPaymentHistory('user-1');
  assert.equal(history.length, 1);
  assert.deepEqual(fake.queries.historyWhere, { user_id: 'user-1' });
});


test('duplicate payment verification request is idempotent and returns existing subscription', async () => {
  const fake = createFakeDatabase();
  const service = serviceFor(fake);
  const details = {
    razorpay_order_id: 'order-1',
    razorpay_payment_id: 'pay-1',
    razorpay_signature: sign(KEY_SECRET, 'order-1|pay-1'),
  };

  const first = await service.verifyCheckout('user-1', details);
  assert.equal(first.activated, true);
  assert.equal(fake.subscriptions.length, 1);

  const second = await service.verifyCheckout('user-1', details);
  assert.equal(second.activated, true);
  assert.equal(second.duplicate, true);
  assert.equal(fake.subscriptions.length, 1);
});

test('checkout verification rejects payment belonging to another user order', async () => {
  const fake = createFakeDatabase();
  const service = serviceFor(fake);
  const details = {
    razorpay_order_id: 'order-1',
    razorpay_payment_id: 'pay-1',
    razorpay_signature: sign(KEY_SECRET, 'order-1|pay-1'),
  };

  await assert.rejects(
    service.verifyCheckout('different-user', details),
    { status: 404, message: 'Payment order was not found for this account.' }
  );
  assert.equal(fake.subscriptions.length, 0);
});

test('successful renewal payment extends existing active subscription', async () => {
  const existingEnd = new Date('2028-06-01T00:00:00.000Z');
  const fake = createFakeDatabase('annual', {
    ends_at: existingEnd,
    status: 'active',
  });
  const service = serviceFor(fake);
  const details = {
    razorpay_order_id: 'order-1',
    razorpay_payment_id: 'pay-1',
    razorpay_signature: sign(KEY_SECRET, 'order-1|pay-1'),
  };

  const result = await service.verifyCheckout('user-1', details);
  assert.equal(result.activated, true);
  assert.equal(fake.subscriptions.length, 1);
  assert.equal(fake.subscriptions[0].starts_at.toISOString(), existingEnd.toISOString());
  assert.equal(fake.subscriptions[0].ends_at.toISOString(), '2029-06-01T00:00:00.000Z');
});
