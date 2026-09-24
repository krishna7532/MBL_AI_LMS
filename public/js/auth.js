'use strict';

/**
 * auth.js — Stage 1 only. No authentication happens here.
 * Google OAuth and application submission are wired up in Stage 2 (PRD §7.1, §19.1).
 */
document.addEventListener('DOMContentLoaded', function () {
  // ── Google button: explains that OAuth is not connected yet ─────────────
  var googleBtn = document.getElementById('googleSignIn');
  var status = document.getElementById('oauthStatus');
  if (googleBtn && status) {
    googleBtn.addEventListener('click', function (e) {
      e.preventDefault();
      status.hidden = false;
      status.setAttribute('tabindex', '-1');
      status.focus();
    });
  }

  // ── Application form validation ─────────────────────────────────────────
  var form = document.getElementById('applicationForm');
  if (!form) return;

  var phoneRe = /^\+?[\d\s-]{10,15}$/;

  function errorFor(input) {
    var group = input.closest('.form-group');
    var el = group && group.querySelector('.error-message');
    if (!el && group) {
      el = document.createElement('div');
      el.className = 'error-message text-danger';
      el.id = input.id + 'Error';
      el.setAttribute('role', 'alert');
      group.appendChild(el);
    }
    return el;
  }

  function showError(input, message) {
    input.classList.add('error');
    input.setAttribute('aria-invalid', 'true');
    var el = errorFor(input);
    if (!el) return;
    el.textContent = message;
    var ids = (input.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
    if (ids.indexOf(el.id) === -1) ids.push(el.id);
    input.setAttribute('aria-describedby', ids.join(' '));
  }

  function clearError(input) {
    input.classList.remove('error');
    input.removeAttribute('aria-invalid');
    var group = input.closest('.form-group');
    var el = group && group.querySelector('.error-message');
    if (el) {
      var ids = (input.getAttribute('aria-describedby') || '').split(' ').filter(function (i) { return i && i !== el.id; });
      if (ids.length) input.setAttribute('aria-describedby', ids.join(' ')); else input.removeAttribute('aria-describedby');
      el.remove();
    }
  }

  function validate(input) {
    if (input.disabled) return true; // Google-supplied fields are placeholders in Stage 1
    clearError(input);
    if (input.type === 'checkbox') {
      if (input.required && !input.checked) { showError(input, input.id === 'consent1' ? 'You need to accept the Terms of Use to apply.' : 'You need to accept the Privacy Policy to apply.'); return false; }
      return true;
    }
    if (input.required && !input.value.trim()) { showError(input, 'Enter your phone number.'); return false; }
    if (input.type === 'tel' && input.value && !phoneRe.test(input.value.trim())) { showError(input, 'Enter a valid phone number, 10 to 15 digits. A + prefix is fine.'); return false; }
    return true;
  }

  form.querySelectorAll('input').forEach(function (input) {
    input.addEventListener(input.type === 'checkbox' ? 'change' : 'blur', function () { validate(input); });
    input.addEventListener('input', function () { if (input.classList.contains('error')) validate(input); });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault(); // Stage 1: never submit anywhere
    var firstInvalid = null;
    form.querySelectorAll('input').forEach(function (input) {
      if (!validate(input) && !firstInvalid) firstInvalid = input;
    });
    if (firstInvalid) { firstInvalid.focus(); return; }

    var result = document.getElementById('applyResult');
    form.hidden = true;
    if (result) {
      result.hidden = false;
      result.textContent = 'Your entries look valid. This is a Stage 1 preview, so nothing was submitted or saved. Applications open when Google sign-in is connected in Stage 2.';
      result.setAttribute('tabindex', '-1');
      result.focus();
    }
  });
});
