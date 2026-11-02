'use strict';

/**
 * Presentation helpers exposed to every EJS template as `fmt`.
 * All dates are stored/passed as ISO strings and rendered in IST (PRD §13.2).
 */
const TZ = 'Asia/Kolkata';

const dateFmt = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-IN', {
  timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
});
const rupeeFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

function toDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

exports.date = (value) => {
  const d = value && toDate(value);
  return d ? dateFmt.format(d) : '—';
};

exports.dateTime = (value) => {
  const d = value && toDate(value);
  return d ? `${dateTimeFmt.format(d).replace(/\s?(am|pm)/i, (m) => ' ' + m.trim().toUpperCase())} IST` : '—';
};

exports.rupees = (n) => `₹${rupeeFmt.format(n)}`;

exports.initials = (name) =>
  String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

// ── Sprint / attempt state (PRD §8.2) ─────────────────────────────────────────
const SPRINT_STATES = {
  not_started:        { label: 'Not started',        css: '',            action: 'Start' },
  notes_completed:    { label: 'Notes completed',    css: 'in-progress', action: 'Continue' },
  test_in_progress:   { label: 'Test in progress',   css: 'in-progress', action: 'Continue' },
  evaluation_pending: { label: 'Evaluation pending', css: 'evaluation',  action: 'Review' },
  completed:          { label: 'Completed',          css: 'completed',   action: 'Review' },
};
exports.sprintState = (s) => SPRINT_STATES[s] || SPRINT_STATES.not_started;

// ── Account state badges ─────────────────────────────────────────────────────
const ACCOUNT_STATES = {
  pending_approval: { label: 'Pending approval', css: 'badge-warning' },
  trial_active:     { label: 'Trial active',     css: 'badge-info' },
  trial_expired:    { label: 'Trial expired',    css: 'badge-muted' },
  paid_active:      { label: 'Paid',             css: 'badge-success' },
  paid_expired:     { label: 'Paid expired',     css: 'badge-muted' },
  active:           { label: 'Active',           css: 'badge-success' },
  rejected:         { label: 'Rejected',         css: 'badge-danger' },
  suspended:        { label: 'Suspended',        css: 'badge-danger' },
};
exports.accountState = (s) => ACCOUNT_STATES[s] || { label: s, css: 'badge-muted' };

// ── Approval / release badges ────────────────────────────────────────────────
const APPROVAL = {
  approved: 'badge-success', published: 'badge-success', needs_review: 'badge-warning',
  draft: 'badge-muted', rejected: 'badge-danger', retired: 'badge-danger', 'n/a': 'badge-muted',
};
exports.approvalClass = (s) => APPROVAL[s] || 'badge-muted';
exports.label = (s) => String(s || '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

// ── Pattern-rule confidence (PRD §6.3) ───────────────────────────────────────
const CONFIDENCE = {
  confirmed: 'badge-success', corroborated: 'badge-info', unverified: 'badge-warning', product_default: 'badge-muted',
};
exports.confidenceClass = (s) => CONFIDENCE[s] || 'badge-muted';

exports.auditClass = (action) => {
  if (/approved|published|created/.test(action)) return 'create';
  if (/rejected|retired|deleted|suspended|expired/.test(action)) return 'delete';
  return 'update';
};

/** Serialise data for an inline <script type="application/json"> block without allowing script breakout. */
exports.json = (value) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
