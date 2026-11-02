'use strict';
require('dotenv').config();

const crypto = require('node:crypto');
const Razorpay = require('razorpay');
const prisma = require('../config/db');
const planCatalog = require('./planCatalog');

const PLAN_CODES = new Set(['annual', 'completion']);

// Creates a payment error with the intended HTTP response status.
function serviceError(status, message, code) {
  const error = new Error(message);
  error.status = status;
  error.publicMessage = status >= 500
    ? 'Payments are temporarily unavailable. Please try again later.'
    : message;
  if (code) error.code = code;
  return error;
}

// Checks that an environment configuration credential is non-empty and not a placeholder
function isConfigured(value) {
  return typeof value === 'string' &&
    value.trim().length > 0 &&
    !/^your_.*$/i.test(value.trim());
}

// Compares a provider signature with an HMAC using constant-time equality.
function signatureMatches(secret, message, signature) {
  if (!secret || typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }
  const expected = crypto.createHmac('sha256', secret).update(message).digest();
  let actual;
  try {
    actual = Buffer.from(signature, 'hex');
  } catch {
    return false;
  }
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

// Converts a positive plan price in rupees into integer paise.
function toPaise(amount) {
  const paise = Math.round(Number(amount) * 100);
  if (!Number.isSafeInteger(paise) || paise <= 0) {
    throw serviceError(400, 'The selected plan has an invalid price.');
  }
  return paise;
}

// Adds whole UTC calendar years to a subscription start date.
function addYears(date, years) {
  const endDate = new Date(date);
  endDate.setUTCFullYear(endDate.getUTCFullYear() + years);
  return endDate;
}

// Adds calendar months without allowing the day to roll into the following month.
function addMonths(date, months) {
  const endDate = new Date(date);
  const targetMonth = endDate.getUTCMonth() + months;
  const target = new Date(Date.UTC(
    endDate.getUTCFullYear(),
    targetMonth,
    1,
    endDate.getUTCHours(),
    endDate.getUTCMinutes(),
    endDate.getUTCSeconds(),
    endDate.getUTCMilliseconds()
  ));
  const lastDay = new Date(Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth() + 1,
    0
  )).getUTCDate();
  target.setUTCDate(Math.min(endDate.getUTCDate(), lastDay));
  return target;
}

function daysRemaining(endDate, currentTime) {
  return Math.max(0, Math.ceil((endDate.getTime() - currentTime.getTime()) / 86400000));
}

// Validates length and allowed characters for client idempotency keys
function validIdempotencyKey(value) {
  return typeof value === 'string' &&
    value.length >= 16 &&
    value.length <= 128 &&
    /^[a-zA-Z0-9._:-]+$/.test(value);
}

// Builds payment operations with injectable database, provider, secrets, and clock.
function createPaymentService({
  database = prisma,
  gatewayFactory = () => new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  }),
  keyId = process.env.RAZORPAY_KEY_ID,
  keySecret = process.env.RAZORPAY_KEY_SECRET,
  webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET,
  now = () => new Date(),
  logger = console,
} = {}) {
  // Creates the configured Razorpay client or reports missing credentials.
  function getGateway() {
    const activeKeyId = keyId || process.env.RAZORPAY_KEY_ID;
    const activeKeySecret = keySecret || process.env.RAZORPAY_KEY_SECRET;
    if (!isConfigured(activeKeyId) || !isConfigured(activeKeySecret)) {
      throw serviceError(
        503,
        'Razorpay is not configured. Set real RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET values in the project-root .env file, then restart the server.'
      );
    }
    return gatewayFactory();
  }

  // Lists active purchasable plans with display details.
  async function getActivePlans() {
    const plans = await database.plans.findMany({
      where: { code: { in: [...PLAN_CODES] }, active: true, currency: 'INR' },
      orderBy: { price: 'asc' },
      select: {
        id: true,
        code: true,
        price: true,
        currency: true,
        duration_years: true,
        duration_months: true,
      },
    });

    return plans.map((plan) => {
      const details = planCatalog[plan.code];
      return {
        id: plan.id,
        code: plan.code,
        name: details ? details.name : plan.code,
        price: Number(plan.price),
        currency: plan.currency.trim(),
        duration: plan.duration_years
          ? `${plan.duration_years} year${plan.duration_years === 1 ? '' : 's'}`
          : `${plan.duration_months} months`,
        durationYears: plan.duration_years,
        description: details ? details.description : '',
        features: details ? details.features : [],
      };
    });
  }

  // Validates a plan and creates both a provider order and pending payment record.
  async function createOrder(userId, planCode, refundAcknowledged, requestKey) {
    if (!userId) throw serviceError(401, 'Sign in before purchasing a plan.');
    if (typeof planCode !== 'string' || !PLAN_CODES.has(planCode)) {
      throw serviceError(400, 'Choose a valid payment plan.');
    }
    if (refundAcknowledged !== true) {
      throw serviceError(400, 'Acknowledge the refund policy before continuing.');
    }
    if (!validIdempotencyKey(requestKey)) {
      throw serviceError(400, 'The payment request key is missing or invalid. Refresh the page and try again.');
    }

    const plan = await database.plans.findFirst({
      where: { code: planCode, active: true, currency: 'INR' },
      select: {
        id: true,
        code: true,
        price: true,
        currency: true,
        duration_years: true,
        duration_months: true,
      },
    });
    if (!plan) throw serviceError(404, 'The selected plan is unavailable.');

    const existingPayment = await database.payments.findUnique({
      where: { idempotency_key: requestKey },
      select: {
        user_id: true,
        plan_id: true,
        state: true,
        razorpay_order_id: true,
      },
    });
    if (existingPayment) {
      if (existingPayment.user_id !== userId || existingPayment.plan_id !== plan.id) {
        throw serviceError(409, 'This payment request key has already been used.');
      }
      if (
        !['created', 'authorized'].includes(existingPayment.state) ||
        !existingPayment.razorpay_order_id
      ) {
        throw serviceError(409, 'This payment request has already been completed or failed. Start a new checkout.');
      }
      return formatOrder(existingPayment.razorpay_order_id, toPaise(plan.price), plan);
    }

    const amount = toPaise(plan.price);
    const gateway = getGateway();
    let order;
    try {
      order = await gateway.orders.create({
        amount,
        currency: 'INR',
        receipt: crypto.randomUUID(),
        notes: { user_id: userId, plan_id: plan.id },
      });
    } catch (error) {
      const statusCode = Number(error.statusCode || error.status || error.response?.status) || null;
      const providerCode = typeof error.error?.code === 'string'
        ? error.error.code.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60)
        : null;
      logger.error('Razorpay order creation failed', { statusCode, providerCode });
      if (statusCode === 401) {
        throw serviceError(
          503,
          'Razorpay rejected the server credentials. Confirm the Test Mode key ID and secret are a matching pair, then restart the server.',
          'RAZORPAY_AUTH_FAILED'
        );
      }
      throw serviceError(
        502,
        'Razorpay could not create the payment order. Check the Test Mode credentials and try again.',
        'RAZORPAY_ORDER_FAILED'
      );
    }

    try {
      await database.payments.create({
        data: {
          user_id: userId,
          plan_id: plan.id,
          razorpay_order_id: order.id,
          amount: plan.price,
          currency: 'INR',
          state: 'created',
          idempotency_key: requestKey,
          refund_acknowledged_at: now(),
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        const duplicate = await database.payments.findUnique({
          where: { idempotency_key: requestKey },
          select: {
            user_id: true,
            plan_id: true,
            state: true,
            razorpay_order_id: true,
          },
        });
        if (
          duplicate &&
          duplicate.user_id === userId &&
          duplicate.plan_id === plan.id &&
          ['created', 'authorized'].includes(duplicate.state) &&
          duplicate.razorpay_order_id
        ) {
          return formatOrder(duplicate.razorpay_order_id, amount, plan);
        }
      }
      throw error;
    }

    return formatOrder(order.id, amount, plan);
  }

  // Formats the order payload returned to the client browser for Checkout
  function formatOrder(orderId, amount, plan) {
    const details = planCatalog[plan.code];
    return {
      orderId,
      amount,
      currency: 'INR',
      keyId,
      planName: details ? details.name : plan.code,
    };
  }

  // Grants access only after a payment is confirmed as captured by Razorpay.
  async function activateCapturedPayment(transaction, payment, entity, { rawEvent, checkoutSignature } = {}) {
    await transaction.$queryRaw`SELECT id FROM payments WHERE id = ${payment.id}::uuid FOR UPDATE`;
    const storedPayment = await transaction.payments.findUnique({
      where: { id: payment.id },
      select: {
        id: true,
        user_id: true,
        plan_id: true,
        state: true,
        amount: true,
        currency: true,
        razorpay_order_id: true,
        razorpay_payment_id: true,
        paid_at: true,
      },
    });
    if (!storedPayment) {
      return { received: true, processed: true, activated: false };
    }

    if (
      entity.status !== 'captured' ||
      (storedPayment.razorpay_payment_id && entity.id !== storedPayment.razorpay_payment_id) ||
      entity.order_id !== storedPayment.razorpay_order_id ||
      entity.currency !== storedPayment.currency ||
      storedPayment.currency !== 'INR' ||
      Number(entity.amount) !== toPaise(storedPayment.amount)
    ) {
      throw serviceError(400, 'Captured payment does not match the stored order.');
    }

    const changed = await transaction.payments.updateMany({
      where: {
        id: storedPayment.id,
        state: { in: ['created', 'authorized', 'failed'] },
      },
      data: {
        state: 'captured',
        razorpay_payment_id: entity.id,
        ...(checkoutSignature ? { razorpay_signature: checkoutSignature } : {}),
        ...(rawEvent ? { raw_webhook_event: rawEvent } : {}),
        paid_at: now(),
        updated_at: now(),
      },
    });
    if (!changed.count && storedPayment.state !== 'captured') {
      return { received: true, processed: true, activated: false };
    }
    if (!changed.count && storedPayment.state === 'captured' && !storedPayment.razorpay_payment_id) {
      await transaction.payments.updateMany({
        where: { id: storedPayment.id, state: 'captured', razorpay_payment_id: null },
        data: {
          razorpay_payment_id: entity.id,
          ...(checkoutSignature ? { razorpay_signature: checkoutSignature } : {}),
          ...(rawEvent ? { raw_webhook_event: rawEvent } : {}),
          updated_at: now(),
        },
      });
    }

    const currentTime = now();
    const linkedSubscription = await transaction.subscriptions.findFirst({
      where: { payment_id: storedPayment.id },
      select: { user_id: true, starts_at: true, ends_at: true, status: true },
    });
    if (linkedSubscription) {
      const active = linkedSubscription.user_id === storedPayment.user_id &&
        linkedSubscription.status === 'active' &&
        linkedSubscription.starts_at <= currentTime &&
        linkedSubscription.ends_at > currentTime;
      if (active) {
        await transaction.users.update({
          where: { id: storedPayment.user_id },
          data: {
            role: 'paid_learner',
            account_state: 'paid_active',
            updated_at: currentTime,
          },
        });
      }
      return {
        received: true,
        processed: true,
        duplicate: true,
        activated: active,
        ...(active ? { endsAt: linkedSubscription.ends_at } : {}),
      };
    }

    const plan = storedPayment.plan_id
      ? await transaction.plans.findUnique({
        where: { id: storedPayment.plan_id },
        select: { id: true, duration_years: true, duration_months: true },
      })
      : null;
    const user = await transaction.users.findUnique({
      where: { id: storedPayment.user_id },
      select: { id: true, role: true, account_state: true, deleted_at: true },
    });
    if (!plan || !user || user.deleted_at ||
        !['approved_trial_learner', 'paid_learner', 'expired_learner'].includes(user.role) ||
        ['suspended', 'rejected', 'deleted'].includes(user.account_state)) {
      return { received: true, processed: true, activated: false };
    }
    if (!(
      (Number.isInteger(plan.duration_years) && plan.duration_years > 0) ||
      (Number.isInteger(plan.duration_months) && plan.duration_months > 0)
    )) {
      throw serviceError(500, 'The purchased plan has no valid subscription duration.');
    }

    const existingSubscription = await transaction.subscriptions.findFirst({
      where: {
        user_id: user.id,
        status: 'active',
        starts_at: { lte: currentTime },
        ends_at: { gt: currentTime },
      },
      orderBy: { ends_at: 'desc' },
      select: { ends_at: true },
    });
    const startsAt = existingSubscription && existingSubscription.ends_at > currentTime
      ? existingSubscription.ends_at
      : currentTime;
    const endsAt = plan.duration_years
      ? addYears(startsAt, plan.duration_years)
      : addMonths(startsAt, plan.duration_months);

    await transaction.subscriptions.create({
      data: {
        user_id: user.id,
        plan_id: plan.id,
        payment_id: storedPayment.id,
        starts_at: startsAt,
        ends_at: endsAt,
        status: 'active',
      },
    });

    await transaction.users.update({
      where: { id: user.id },
      data: {
        role: 'paid_learner',
        account_state: 'paid_active',
        updated_at: currentTime,
      },
    });

    return { received: true, processed: true, activated: true, endsAt };
  }

  // Verifies the checkout response and independently checks the provider's capture state.
  async function verifyCheckout(userId, details) {
    const orderId = details && details.razorpay_order_id;
    const paymentId = details && details.razorpay_payment_id;
    const signature = details && details.razorpay_signature;
    if (!userId) throw serviceError(401, 'Sign in before verifying a payment.');
    if (![orderId, paymentId, signature].every((value) => typeof value === 'string' && value)) {
      throw serviceError(400, 'Razorpay payment details are incomplete.');
    }
    const activeKeySecret = keySecret || process.env.RAZORPAY_KEY_SECRET;
    if (!isConfigured(activeKeySecret)) {
      throw serviceError(
        503,
        'Razorpay is not configured. Set a real RAZORPAY_KEY_SECRET value in the project-root .env file, then restart the server.'
      );
    }
    if (!signatureMatches(activeKeySecret, `${orderId}|${paymentId}`, signature)) {
      throw serviceError(400, 'Razorpay payment signature is invalid.');
    }

    const payment = await database.payments.findFirst({
      where: { user_id: userId, razorpay_order_id: orderId },
      select: {
        id: true,
        user_id: true,
        plan_id: true,
        state: true,
        amount: true,
        razorpay_order_id: true,
        razorpay_payment_id: true,
      },
    });
    if (!payment) throw serviceError(404, 'Payment order was not found for this account.');

    await database.payments.updateMany({
      where: {
        id: payment.id,
        state: { in: ['created', 'authorized', 'failed'] },
      },
      data: {
        state: 'authorized',
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
        updated_at: now(),
      },
    });

    let providerPayment;
    try {
      const gateway = getGateway();
      providerPayment = await gateway.payments.fetch(paymentId);
    } catch (error) {
      const statusCode = Number(error.statusCode || error.status || error.response?.status) || null;
      const providerCode = typeof error.error?.code === 'string'
        ? error.error.code.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60)
        : null;
      logger.error('Razorpay payment status lookup failed', { statusCode, providerCode });
      return {
        verified: true,
        activated: false,
        captured: payment.state === 'captured',
        message: payment.state === 'captured'
          ? 'Payment is captured, but access could not be reconciled yet. Please try again shortly.'
          : 'Payment signature verified. Access is awaiting Razorpay capture confirmation.',
      };
    }

    if (providerPayment.status !== 'captured') {
      return {
        verified: true,
        activated: false,
        captured: payment.state === 'captured',
        message: payment.state === 'captured'
          ? 'Razorpay could not reconfirm this captured payment. Please contact support.'
          : 'Payment signature verified. Access activates after Razorpay confirms capture.',
      };
    }
    if (providerPayment.id !== paymentId) {
      throw serviceError(400, 'Razorpay returned a different payment than the checkout response.');
    }

    const activation = await database.$transaction((transaction) =>
      activateCapturedPayment(transaction, payment, providerPayment, { checkoutSignature: signature })
    );
    return {
      verified: true,
      activated: activation.activated,
      captured: true,
      ...(activation.duplicate ? { duplicate: true } : {}),
      message: activation.activated
        ? 'Payment was confirmed and access is active.'
        : 'Payment is captured, but access could not be activated. Please contact support.',
    };
  }

  // Rechecks an already-authorized payment so successful checkouts can recover from a missed webhook.
  async function reconcilePayment(userId, orderId) {
    if (!userId) throw serviceError(401, 'Sign in before checking a payment.');
    if (typeof orderId !== 'string' || !orderId) {
      throw serviceError(400, 'A payment order ID is required.');
    }

    const payment = await database.payments.findFirst({
      where: { user_id: userId, razorpay_order_id: orderId },
      select: {
        id: true,
        user_id: true,
        plan_id: true,
        state: true,
        amount: true,
        razorpay_order_id: true,
        razorpay_payment_id: true,
      },
    });
    if (!payment) throw serviceError(404, 'Payment order was not found for this account.');

    if (!['authorized', 'captured'].includes(payment.state) || !payment.razorpay_payment_id) {
      return {
        verified: false,
        activated: false,
        captured: payment.state === 'captured',
        message: 'This payment is not ready to be checked yet.',
      };
    }

    let providerPayment;
    try {
      const gateway = getGateway();
      providerPayment = await gateway.payments.fetch(payment.razorpay_payment_id);
    } catch (error) {
      const statusCode = Number(error.statusCode || error.status || error.response?.status) || null;
      const providerCode = typeof error.error?.code === 'string'
        ? error.error.code.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60)
        : null;
      logger.error('Razorpay payment reconciliation failed', { statusCode, providerCode });
      return {
        verified: false,
        activated: false,
        captured: payment.state === 'captured',
        message: 'Could not confirm payment status with Razorpay. Please try again shortly.',
      };
    }

    if (providerPayment.status !== 'captured') {
      return {
        verified: true,
        activated: false,
        captured: payment.state === 'captured',
        message: payment.state === 'captured'
          ? 'Razorpay could not reconfirm this captured payment. Please contact support.'
          : 'Razorpay has not confirmed capture yet.',
      };
    }
    if (providerPayment.id !== payment.razorpay_payment_id) {
      throw serviceError(400, 'Razorpay returned a different payment than the stored order.');
    }

    const activation = await database.$transaction((transaction) =>
      activateCapturedPayment(transaction, payment, providerPayment)
    );
    return {
      verified: true,
      activated: activation.activated,
      captured: true,
      message: activation.activated
        ? 'Payment was confirmed and access is active.'
        : 'Payment is captured, but access could not be activated. Please contact support.',
    };
  }

  // Validates and processes provider webhooks, activating captured subscriptions.
  async function processWebhook(rawBody, signature, eventId) {
    if (!isConfigured(webhookSecret)) {
      throw serviceError(
        503,
        'Razorpay webhook is not configured. Set a real RAZORPAY_WEBHOOK_SECRET value in the project-root .env file, then restart the server.'
      );
    }
    if (!Buffer.isBuffer(rawBody)) throw serviceError(400, 'Razorpay webhook body must be raw JSON bytes.');
    if (!signatureMatches(webhookSecret, rawBody, signature)) {
      throw serviceError(400, 'Razorpay webhook signature is invalid.');
    }
    if (typeof eventId !== 'string' || !eventId || eventId.length > 255) {
      throw serviceError(400, 'Razorpay webhook event ID is missing or invalid.');
    }

    let event;
    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw serviceError(400, 'Razorpay webhook JSON is invalid.');
    }
    if (!event || typeof event.event !== 'string' || event.event.length > 100) {
      throw serviceError(400, 'Razorpay webhook event is invalid.');
    }

    const entity = event.payload && event.payload.payment && event.payload.payment.entity;
    const orderId = entity && entity.order_id;
    const payment = orderId
      ? await database.payments.findUnique({ where: { razorpay_order_id: orderId } })
      : null;

    try {
      return await database.$transaction(async (transaction) => {
        await transaction.payment_webhook_events.create({
          data: {
            event_id: eventId,
            event_type: event.event,
            payment_id: payment ? payment.id : null,
            payload: event,
          },
        });

        if (!payment || !entity) return { received: true, processed: false };

        if (event.event === 'payment.failed') {
          await transaction.payments.updateMany({
            where: {
              id: payment.id,
              state: { in: ['created', 'authorized'] },
            },
            data: {
              state: 'failed',
              razorpay_payment_id: entity.id,
              raw_webhook_event: event,
              updated_at: now(),
            },
          });
          return { received: true, processed: true, activated: false };
        }

        if (event.event !== 'payment.captured') {
          return { received: true, processed: false };
        }
        return activateCapturedPayment(transaction, payment, entity, { rawEvent: event });
      });
    } catch (error) {
      if (error.code === 'P2002') {
        const existingEvent = await database.payment_webhook_events.findUnique({
          where: { event_id: eventId },
          select: { id: true },
        });
        if (existingEvent) {
          return { received: true, processed: true, duplicate: true, activated: false };
        }
      }
      throw error;
    }
  }

  // Lists payment records belonging to the signed-in user.
  async function getPaymentHistory(userId) {
    return database.payments.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        amount: true,
        currency: true,
        state: true,
        razorpay_order_id: true,
        razorpay_payment_id: true,
        created_at: true,
        paid_at: true,
        plans: { select: { code: true } },
      },
    });
  }

  // Returns the user's active subscription, if one is currently valid.
  async function getCurrentSubscription(userId) {
    const currentTime = now();
    return database.subscriptions.findFirst({
      where: {
        user_id: userId,
        status: 'active',
        starts_at: { lte: currentTime },
        ends_at: { gt: currentTime },
      },
      orderBy: { ends_at: 'desc' },
      select: {
        id: true,
        status: true,
        starts_at: true,
        ends_at: true,
        plans: { select: { code: true } },
      },
    });
  }

  // Resolves the learner's current access source, preferring a valid paid subscription.
  async function getAccessInformation(userId) {
    const currentTime = now();
    const user = await database.users.findUnique({
      where: { id: userId },
      select: { account_state: true },
    });
    if (!user) throw serviceError(404, 'The account could not be found.');

    const activeSubscription = await database.subscriptions.findFirst({
      where: {
        user_id: userId,
        status: 'active',
        starts_at: { lte: currentTime },
        ends_at: { gt: currentTime },
      },
      orderBy: { ends_at: 'desc' },
      select: {
        status: true,
        starts_at: true,
        ends_at: true,
        plans: { select: { code: true } },
      },
    });
    if (activeSubscription) {
      const planCode = activeSubscription.plans.code;
      return {
        accountStatus: 'paid_active',
        accessType: 'paid',
        planName: planCatalog[planCode]?.name || planCode,
        subscriptionStatus: 'active',
        subscriptionStartedAt: activeSubscription.starts_at,
        subscriptionExpiresAt: activeSubscription.ends_at,
        daysRemaining: daysRemaining(activeSubscription.ends_at, currentTime),
        trial: null,
      };
    }

    const previousSubscription = await database.subscriptions.findFirst({
      where: {
        user_id: userId,
        OR: [
          { status: 'expired' },
          { status: 'active', ends_at: { lte: currentTime } },
        ],
      },
      orderBy: [{ starts_at: 'desc' }, { created_at: 'desc' }],
      select: {
        status: true,
        starts_at: true,
        ends_at: true,
        plans: { select: { code: true } },
      },
    });
    if (previousSubscription &&
        (previousSubscription.status === 'expired' || previousSubscription.ends_at <= currentTime)) {
      const planCode = previousSubscription.plans.code;
      return {
        accountStatus: 'paid_expired',
        accessType: 'expired',
        planName: null,
        previousPlanName: planCatalog[planCode]?.name || planCode,
        subscriptionStatus: 'expired',
        subscriptionStartedAt: previousSubscription.starts_at,
        subscriptionExpiresAt: previousSubscription.ends_at,
        daysRemaining: 0,
        trial: null,
      };
    }

    const activeTrial = await database.trials.findFirst({
      where: {
        user_id: userId,
        state: 'active',
        starts_at: { lte: currentTime },
        ends_at: { gt: currentTime },
      },
      orderBy: { starts_at: 'desc' },
      select: { starts_at: true, ends_at: true },
    });
    if (activeTrial) {
      return {
        accountStatus: 'trial_active',
        accessType: 'trial',
        planName: null,
        subscriptionStatus: null,
        subscriptionStartedAt: null,
        subscriptionExpiresAt: null,
        daysRemaining: daysRemaining(activeTrial.ends_at, currentTime),
        trial: {
          startedAt: activeTrial.starts_at,
          expiresAt: activeTrial.ends_at,
          daysRemaining: daysRemaining(activeTrial.ends_at, currentTime),
        },
      };
    }

    const previousTrial = await database.trials.findFirst({
      where: {
        user_id: userId,
        OR: [
          { state: 'expired' },
          { state: 'active', ends_at: { lte: currentTime } },
        ],
      },
      orderBy: [{ ends_at: 'desc' }, { created_at: 'desc' }],
      select: { starts_at: true, ends_at: true },
    });
    if (previousTrial && previousTrial.ends_at <= currentTime) {
      return {
        accountStatus: 'trial_expired',
        accessType: 'expired',
        planName: null,
        previousPlanName: null,
        subscriptionStatus: null,
        subscriptionStartedAt: null,
        subscriptionExpiresAt: null,
        daysRemaining: 0,
        trial: {
          startedAt: previousTrial.starts_at,
          expiresAt: previousTrial.ends_at,
          daysRemaining: 0,
        },
      };
    }

    return {
      accountStatus: user.account_state,
      accessType: user.account_state === 'pending_approval' ? 'pending' : 'none',
      planName: null,
      subscriptionStatus: null,
      subscriptionStartedAt: null,
      subscriptionExpiresAt: null,
      daysRemaining: 0,
      trial: null,
    };
  }

  return {
    getActivePlans,
    createOrder,
    verifyCheckout,
    reconcilePayment,
    processWebhook,
    getPaymentHistory,
    getCurrentSubscription,
    getAccessInformation,
  };
}

module.exports = {
  createPaymentService,
  service: createPaymentService(),
  signatureMatches,
  addYears,
};
