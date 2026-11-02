'use strict';

document.addEventListener('DOMContentLoaded', function () {
  var statusMessage = document.querySelector('[data-payment-status]');
  var buttons = document.querySelectorAll('[data-payment-plan]');

  function createFriendlyError(message) {
    var error = new Error(message);
    error.safeMessage = true;
    return error;
  }

  // Displays payment progress or error feedback to the learner.
  function showMessage(message, isError) {
    if (!statusMessage) return;
    statusMessage.hidden = false;
    statusMessage.classList.toggle('text-danger', Boolean(isError));
    statusMessage.textContent = message;
  }

  // Sends a same-origin JSON request and converts API failures into errors.
  async function requestJson(url, options) {
    var response;
    try {
      response = await fetch(url, Object.assign({
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }
      }, options || {}));
    } catch (error) {
      throw createFriendlyError('Unable to connect right now. Check your connection and try again.');
    }
    var result;
    try {
      result = await response.json();
    } catch (error) {
      result = {};
    }
    if (!response.ok || !result.success) {
      throw createFriendlyError(result.message || 'The payment request could not be completed.');
    }
    return result;
  }

  function friendlyErrorMessage(error, fallback) {
    return error && error.safeMessage === true &&
      typeof error.message === 'string'
      ? error.message
      : fallback;
  }

  // Recovers prior payments whose checkout callback was verified but webhook was missed.
  async function reconcilePreviousPayments() {
    try {
      var history = await requestJson('/api/payments/history', { method: 'GET' });
      var pendingPayments = history.payments.filter(function (payment) {
        return payment.state === 'authorized' &&
          payment.razorpay_order_id &&
          payment.razorpay_payment_id;
      });

      for (var index = 0; index < pendingPayments.length; index += 1) {
        var result = await requestJson('/api/payments/reconcile', {
          method: 'POST',
          body: JSON.stringify({ orderId: pendingPayments[index].razorpay_order_id })
        });
        if (result.activated) {
          window.location.reload();
          return;
        }
        if (result.captured) {
          showMessage(result.message, true);
          return;
        }
        if (!result.verified) {
          showMessage(result.message, true);
          return;
        }
      }
    } catch (error) {
      showMessage(
        friendlyErrorMessage(error, 'Could not refresh a previous payment status. Please try again shortly.'),
        true
      );
    }
  }

  // Polls payment history until capture is confirmed or reported as failed.
  async function waitForWebhook(orderId, callbackVerified) {
    for (var attempt = 0; attempt < 20; attempt += 1) {
      var result = await requestJson('/api/payments/history', { method: 'GET' });
      var payment = result.payments.find(function (item) {
        return item.razorpay_order_id === orderId;
      });

      if (payment && payment.state === 'captured') {
        var subscriptionResult = await requestJson('/api/payments/subscription', { method: 'GET' });
        if (subscriptionResult.subscription) {
          window.location.reload();
          return;
        }
        showMessage(
          'Payment was captured, but access was not activated. Please contact support before trying again.',
          true
        );
        return;
      }
      if (payment && payment.state === 'failed') {
        showMessage('Razorpay reported that the payment failed. You can try again.', true);
        return;
      }
      await new Promise(function (resolve) { window.setTimeout(resolve, 1500); });
    }

    showMessage(
      callbackVerified
        ? 'Payment signature was verified, but capture is not confirmed yet. Refresh this page shortly.'
        : 'Payment could not be confirmed yet. If your account was charged, wait for the webhook confirmation before retrying.',
      !callbackVerified
    );
  }

  // Runs the checkout and server verification flow for the selected plan.
  buttons.forEach(function (button) {
    button.addEventListener('click', async function () {
      var card = button.closest('.plan-card');
      var acknowledgement = card && card.querySelector('[data-refund-ack]');
      if (!acknowledgement || !acknowledgement.checked) {
        showMessage('Please acknowledge the refund policy before continuing.', true);
        if (acknowledgement) acknowledgement.focus();
        return;
      }
      if (typeof window.Razorpay !== 'function') {
        showMessage('Razorpay Checkout could not be loaded. Please try again later.', true);
        return;
      }

      button.disabled = true;
      showMessage('Preparing secure checkout…', false);
      try {
        if (!window.crypto || typeof window.crypto.randomUUID !== 'function') {
          throw new Error('Secure checkout is unavailable in this browser. Update your browser and try again.');
        }
        var result = await requestJson('/api/payments/orders', {
          method: 'POST',
          body: JSON.stringify({
            planCode: button.getAttribute('data-payment-plan'),
            refundAcknowledged: acknowledgement.checked,
            idempotencyKey: window.crypto.randomUUID()
          })
        });
        var order = result.order;
        var paymentSubmitted = false;
        var checkout = new window.Razorpay({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          name: 'MBL AI LMS',
          description: order.planName,
          order_id: order.orderId,
          handler: async function (checkoutResult) {
            paymentSubmitted = true;
            try {
              var verification = await requestJson('/api/payments/verify', {
                method: 'POST',
                body: JSON.stringify(checkoutResult)
              });
              if (verification.captured && !verification.activated) {
                showMessage(verification.message, true);
                return;
              }
              showMessage('Payment signature verified. Waiting for Razorpay payment confirmation…', false);
              await waitForWebhook(order.orderId, true);
            } catch (error) {
              showMessage(
                'The checkout callback could not be verified immediately. Checking for Razorpay server confirmation…',
                false
              );
              try {
                await waitForWebhook(order.orderId, false);
              } catch (webhookError) {
                showMessage(
                  friendlyErrorMessage(error, friendlyErrorMessage(
                    webhookError,
                    'The payment status could not be confirmed yet.'
                  )),
                  true
                );
              }
            } finally {
              button.disabled = false;
            }
          },
          modal: {
            ondismiss: function () {
              button.disabled = false;
              if (!paymentSubmitted) {
                showMessage('Checkout was closed. No access was activated.', false);
              }
            }
          },
          theme: { color: '#1e3a8a' }
        });

        checkout.on('payment.failed', function (event) {
          showMessage('The payment could not be completed. Please try again or choose another payment method.', true);
          button.disabled = false;
        });
        checkout.open();
      } catch (error) {
        showMessage(friendlyErrorMessage(
          error,
          'We could not start checkout. Please try again later.'
        ), true);
        button.disabled = false;
      }
    });
  });

  if (buttons.length) {
    reconcilePreviousPayments();
  }
});
