'use strict';

const payments = require('../services/paymentService').service;

// Wraps payment handlers so rejected requests reach Express error handling.
function handle(operation) {
  return async (req, res, next) => {
    try {
      return await operation(req, res);
    } catch (error) {
      return next(error);
    }
  };
}

// Returns the active purchase plans to the learner.
exports.listPlans = handle(async (req, res) => {
  const plans = await payments.getActivePlans();
  return res.json({ success: true, plans });
});

// Creates a payment-provider order for a learner's selected plan.
exports.createOrder = handle(async (req, res) => {
  const order = await payments.createOrder(
    req.user.id,
    req.body && req.body.planCode,
    req.body && req.body.refundAcknowledged,
    req.body && req.body.idempotencyKey
  );
  return res.status(201).json({ success: true, order });
});

// Verifies the checkout signature returned by the browser.
exports.verifyCheckout = handle(async (req, res) => {
  const result = await payments.verifyCheckout(req.user.id, req.body);
  return res.json({ success: true, ...result });
});

// Rechecks a previously authorized payment with Razorpay.
exports.reconcilePayment = handle(async (req, res) => {
  const result = await payments.reconcilePayment(
    req.user.id,
    req.body && req.body.orderId
  );
  return res.json({ success: true, ...result });
});

// Returns the signed-in learner's payment records.
exports.paymentHistory = handle(async (req, res) => {
  const history = await payments.getPaymentHistory(req.user.id);
  return res.json({ success: true, payments: history });
});

// Returns the signed-in learner's current subscription.
exports.currentSubscription = handle(async (req, res) => {
  const subscription = await payments.getCurrentSubscription(req.user.id);
  return res.json({ success: true, subscription });
});

// Processes a signed payment-provider webhook event.
exports.webhook = async (req, res, next) => {
  try {
    const result = await payments.processWebhook(
      req.body,
      req.get('x-razorpay-signature'),
      req.get('x-razorpay-event-id')
    );
    return res.json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
};
