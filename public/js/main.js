'use strict';

/**
 * main.js — shared behaviour: navigation, dropdown, modals, and toasts.
 * Adapted from the original main.js. Changes: aria state on toggles, focus-managed modals,
 * alerts no longer auto-dismiss unless opted in, unused/conflicting handlers removed.
 */
(function () {
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Toasts ────────────────────────────────────────────────────────────────
  window.showToast = function (message, type) {
    var container = document.getElementById('toastContainer');
    if (!container) return;
    var toast = document.createElement('div');
    toast.className = 'alert alert-' + (type || 'info') + ' toast';
    var text = document.createElement('span');
    text.textContent = message; // textContent: never inject HTML
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'btn btn-ghost btn-sm toast-dismiss';
    close.setAttribute('aria-label', 'Dismiss message');
    close.textContent = '×';
    close.addEventListener('click', function () { toast.remove(); });
    toast.appendChild(text);
    toast.appendChild(close);
    container.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 5000);
  };

  // ── Sidebar (mobile) ──────────────────────────────────────────────────────
  var layout = document.getElementById('appLayout');
  var toggle = document.getElementById('sidebarToggle');
  var overlay = document.getElementById('sidebarOverlay');

  function setSidebar(open) {
    if (!layout || !toggle) return;
    layout.classList.toggle('sidebar-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  }
  if (layout && toggle) {
    toggle.addEventListener('click', function () { setSidebar(!layout.classList.contains('sidebar-open')); });
    if (overlay) overlay.addEventListener('click', function () { setSidebar(false); });
    window.addEventListener('resize', function () { if (window.innerWidth > 768) setSidebar(false); });
  }

  // ── User dropdown ─────────────────────────────────────────────────────────
  var ddToggle = document.querySelector('.user-dropdown-toggle');
  var ddMenu = document.querySelector('.user-dropdown-menu');
  function setDropdown(open) {
    if (!ddToggle || !ddMenu) return;
    ddMenu.classList.toggle('active', open);
    ddToggle.setAttribute('aria-expanded', String(open));
  }
  if (ddToggle && ddMenu) {
    ddToggle.addEventListener('click', function (e) { e.stopPropagation(); setDropdown(!ddMenu.classList.contains('active')); });
    document.addEventListener('click', function (e) { if (!ddMenu.contains(e.target)) setDropdown(false); });
  }

  // ── Modals (focus-managed) ────────────────────────────────────────────────
  var lastFocus = null;

  function focusable(modal) {
    return modal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
  }

  window.openModal = function (id) {
    var modal = document.getElementById(id);
    if (!modal) return;
    lastFocus = document.activeElement;
    modal.classList.add('active');
    var content = modal.querySelector('.modal-content');
    if (content) { content.setAttribute('tabindex', '-1'); content.focus(); }
  };

  window.closeModal = function (id) {
    var modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('active');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  };

  function closeAllModals() {
    document.querySelectorAll('.modal.active').forEach(function (m) { window.closeModal(m.id); });
  }

  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-modal-open]');
    if (opener) { e.preventDefault(); window.openModal(opener.getAttribute('data-modal-open')); return; }
    if (e.target.closest('[data-modal-close]')) { e.preventDefault(); closeAllModals(); return; }
    if (e.target.classList && e.target.classList.contains('modal-overlay')) closeAllModals();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeAllModals();
      setDropdown(false);
      setSidebar(false);
      return;
    }
    if (e.key === 'Tab') {
      var modal = document.querySelector('.modal.active');
      if (!modal) return;
      var items = focusable(modal);
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === modal.querySelector('.modal-content'))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // ── Opt-in alert auto-dismiss (persistent notices stay visible) ───────────
  document.querySelectorAll('.alert[data-autodismiss]').forEach(function (a) {
    setTimeout(function () { a.remove(); }, 5000);
  });

  // ── Smooth in-page anchors ────────────────────────────────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var href = a.getAttribute('href');
      if (!href || href === '#' || href === '#main') return;
      var target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
      history.replaceState(null, '', href);
    });
  });
})();
