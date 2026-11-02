'use strict';

const prisma = require('../config/db');

const BATCH_SIZE = 500;

// Marks due trial records expired and updates users without another active trial.
async function expireDueTrials(now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const dueTrials = await tx.trials.findMany({
      where: {
        state: 'active',
        ends_at: { lte: now },
      },
      orderBy: { ends_at: 'asc' },
      take: BATCH_SIZE,
      select: { id: true, user_id: true },
    });

    if (dueTrials.length === 0) {
      return { trialsExpired: 0, usersExpired: 0 };
    }

    const trialIds = dueTrials.map((trial) => trial.id);
    const userIds = [...new Set(dueTrials.map((trial) => trial.user_id))];
    const expiredTrials = await tx.trials.updateMany({
      where: {
        id: { in: trialIds },
        state: 'active',
        ends_at: { lte: now },
      },
      data: { state: 'expired' },
    });

    const expiredUsers = await tx.users.updateMany({
      where: {
        id: { in: userIds },
        role: 'approved_trial_learner',
        account_state: 'trial_active',
        trials: {
          none: {
            state: 'active',
            ends_at: { gt: now },
          },
        },
      },
      data: {
        role: 'expired_learner',
        account_state: 'trial_expired',
        updated_at: now,
      },
    });

    return {
      trialsExpired: expiredTrials.count,
      usersExpired: expiredUsers.count,
    };
  });
}

// Runs trial expiry immediately at startup and periodically afterwards.
function startExpiryWorker({ intervalMs = 60000, onError = console.error } = {}) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await expireDueTrials();
    } catch (error) {
      onError('Expired trial processing failed:', error);
    } finally {
      running = false;
    }
  };

  const interval = setInterval(tick, intervalMs);
  interval.unref();
  tick();
  return () => clearInterval(interval);
}

module.exports = {
  expireDueTrials,
  startExpiryWorker,
};
