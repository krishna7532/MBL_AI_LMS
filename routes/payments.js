'use strict';

const router = require('express').Router();
const controller = require('../controllers/paymentController');
const requireLearner = require('../middleware/routeAccess').requireLearner;
const requireSameOrigin = require('../middleware/requireSameOrigin');

// Requires a current learner account for all payment operations.
router.use(requireLearner);

// Lists available subscription plans
router.get('/plans', controller.listPlans);
// Creates a Razorpay payment order for a selected plan
router.post('/orders', requireSameOrigin, controller.createOrder);
// Verifies client checkout signature
router.post('/verify', requireSameOrigin, controller.verifyCheckout);
// Reconciles an authorized payment after a missed checkout/webhook confirmation
router.post('/reconcile', requireSameOrigin, controller.reconcilePayment);
// Returns payment history for the logged-in learner
router.get('/history', controller.paymentHistory);
// Returns current subscription status
router.get('/subscription', controller.currentSubscription);

module.exports = router;
