'use strict';

document.addEventListener('DOMContentLoaded', function () {
  // ── Whole sprint card is clickable; the inner link stays the real, focusable target ──
  document.querySelectorAll('.sprint-card[data-href]').forEach(function (card) {
    card.addEventListener('click', function (e) {
      if (e.target.closest('a, button')) return;
      window.location.href = card.getAttribute('data-href');
    });
  });

  // ── Trial banner: escalate styling when 3 days or fewer remain ──
  var banner = document.querySelector('.trial-banner');
  if (banner && parseInt(banner.getAttribute('data-days') || '0', 10) <= 3) banner.classList.add('expiring');

  // ── Notification badge count (capped display) ──
  var badge = document.querySelector('.notification-badge');
  if (badge) {
    var count = parseInt(badge.getAttribute('data-count') || '0', 10);
    if (count > 0) badge.textContent = count > 99 ? '99+' : String(count);
    else badge.style.display = 'none';
  }

  // ── Notifications page: mark all as read (client-side preview only) ──
  var markAll = document.getElementById('markAllRead');
  if (markAll) {
    markAll.addEventListener('click', function () {
      document.querySelectorAll('.notification-item.unread').forEach(function (n) {
        n.classList.remove('unread');
        var b = n.querySelector('.unread-badge');
        if (b) b.remove();
      });
      var navBadge = document.querySelector('.notification-badge');
      if (navBadge) navBadge.style.display = 'none';
      window.showToast('Preview only. Read state is saved in Stage 2.', 'info');
    });
  }
});
