'use strict';

// Catalog of subscription plan marketing details, descriptions, and feature lists
const plans = {
  annual: {
    name: 'Annual Plan',
    description: 'Full access to Year 1 courses, weekly sprints, and monthly simulations for one year.',
    features: [
      'All Year 1 courses',
      'Weekly revision sprints',
      'Monthly exam simulations',
      'AI-assisted evaluation',
      'Leaderboard participation',
      'Full result history',
    ],
  },
  completion: {
    name: 'Completion Plan',
    description: 'Full access for the MBL program duration, including Year 2 when available.',
    features: [
      'Everything in Annual Plan',
      'Year 2 courses when available',
      'Five-year continuous access',
      'Priority support',
      'Best value for the full program',
    ],
  },
};

module.exports = plans;
