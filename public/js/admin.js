'use strict';

/**
 * admin.js — admin screen interactions.
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
        var userId = btn.getAttribute('data-user-id');
        modal.querySelectorAll('[data-modal-user]').forEach(function (el) { el.textContent = name; });
        modal.setAttribute('data-user-id', userId || '');
        if (modalId === 'rejectModal') {
          var reasonInput = modal.querySelector('#rejectReason');
          if (reasonInput) reasonInput.value = '';
        }
        window.openModal(modalId);
      });
    });
  }
  bindDecision('.btn-approve', 'approveModal');
  bindDecision('.btn-reject', 'rejectModal');

//Admin when click accept/reject post request send
  document.querySelectorAll('[data-decision-confirm]').forEach(function (button) {
    button.addEventListener('click', async function () {
      var modal = button.closest('.modal');
      var userId = modal && modal.getAttribute('data-user-id');
      var decision = button.getAttribute('data-decision-confirm');

      if (!userId || (decision !== 'approved' && decision !== 'rejected')) {
        window.showToast('Unable to identify the applicant or decision.', 'danger');
        return;
      }

      var requestBody = { decision: decision };
      if (decision === 'rejected') {
        var reasonInput = modal.querySelector('#rejectReason');
        requestBody.reason = reasonInput ? reasonInput.value.trim() : '';
      }

      button.disabled = true;
      try {
        var response = await fetch('/admin/users/' + encodeURIComponent(userId) + '/decision', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        var result;
        try {
          result = await response.json();
        } catch (parseError) {
          throw new Error('The server returned an unreadable response.');
        }
        if (!response.ok) {
          throw new Error(result && result.message ? result.message : 'The decision could not be saved.');
        }

        window.closeModal(modal.id);
        window.showToast(
          result && result.message ? result.message : 'Decision saved.',
          'success'
        );
        window.setTimeout(function () { window.location.reload(); }, 1000);
      } catch (error) {
        window.showToast(error.message || 'The decision request failed. Please try again.', 'danger');
        button.disabled = false;
      }
    });
  });

  // ── Release actions ──
  // ── Settings form ──
  var settingsForm = document.getElementById('adminSettingsForm');
  if (settingsForm) {
    settingsForm.addEventListener('submit', function (e) {
      e.preventDefault();
      window.showToast('Preview only. Saving creates a new version in Stage 2. Nothing was saved.', 'info');
    });
  }
});
