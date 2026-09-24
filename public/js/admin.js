'use strict';

/**
 * admin.js — Stage 1 display-only admin interactions.
 * The original file reported "success" after confirm(); that was misleading, since nothing is persisted.
 * Every action now says it is a preview. Real actions (with audit entries) arrive in Stage 2.
 */
document.addEventListener('DOMContentLoaded', function () {
  // ── Live table search ──
  document.querySelectorAll('.table-search').forEach(function (input) {
    var table = document.querySelector(input.getAttribute('data-table'));
    if (!table) return;
    input.addEventListener('input', function () {
      var term = input.value.trim().toLowerCase();
      table.querySelectorAll('tbody tr').forEach(function (row) {
        row.style.display = row.textContent.toLowerCase().indexOf(term) === -1 ? 'none' : '';
      });
    });
  });

  // ── Approve / reject: open the confirmation modal for the chosen applicant ──
  function bindDecision(selector, modalId) {
    document.querySelectorAll(selector).forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var modal = document.getElementById(modalId);
        if (!modal) return;
        var name = btn.getAttribute('data-user-name') || 'this applicant';
        modal.querySelectorAll('[data-modal-user]').forEach(function (el) { el.textContent = name; });
        window.openModal(modalId);
      });
    });
  }
  bindDecision('.btn-approve', 'approveModal');
  bindDecision('.btn-reject', 'rejectModal');

  // ── Release actions ──
  document.querySelectorAll('.btn-publish').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      window.showToast('Preview only. Publishing is recorded in Stage 2. Nothing was published.', 'info');
    });
  });
  document.querySelectorAll('.btn-retire').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      window.showToast('Preview only. Retiring a release is recorded in Stage 2. Nothing was changed.', 'info');
    });
  });

  // ── Settings form ──
  var settingsForm = document.getElementById('adminSettingsForm');
  if (settingsForm) {
    settingsForm.addEventListener('submit', function (e) {
      e.preventDefault();
      window.showToast('Preview only. Saving creates a new version in Stage 2. Nothing was saved.', 'info');
    });
  }
});
