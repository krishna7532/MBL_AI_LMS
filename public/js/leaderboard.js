'use strict';

document.addEventListener('DOMContentLoaded', function () {
  // ── Weekly / Cumulative tabs (server also sets the initial tab from ?tab=) ──
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.leaderboard-tab'));
  var panels = document.querySelectorAll('.leaderboard-panel');

  function activate(tab, focus) {
    var target = tab.getAttribute('data-target');
    tabs.forEach(function (t) {
      var on = t === tab;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach(function (p) { p.classList.toggle('active', p.id === target); });
    if (focus) tab.focus();
    try {
      var url = new URL(window.location.href);
      url.searchParams.set('tab', target === 'panel-cumulative' ? 'cumulative' : 'weekly');
      history.replaceState(null, '', url);
    } catch (e) { /* ignore */ }
  }

  tabs.forEach(function (tab, i) {
    tab.tabIndex = tab.classList.contains('active') ? 0 : -1;
    tab.addEventListener('click', function () { activate(tab, false); });
    tab.addEventListener('keydown', function (e) {
      var next = null;
      if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
      if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
      if (next) { e.preventDefault(); activate(next, true); }
    });
  });

  // ── Filters submit as a normal GET so ranks are recomputed on the server ──
  // (Ties share a rank, so client-side row hiding would show wrong ranks.)
  document.querySelectorAll('form[data-autosubmit]').forEach(function (form) {
    var scope = form.querySelector('#scope');
    var course = form.querySelector('#courseFilter');
    form.addEventListener('change', function () {
      if (scope && course) course.disabled = scope.value === 'all';
      form.submit();
    });
  });

  // ── Current-user highlight (server sets the class too; this covers the alias attr) ──
  var alias = document.body.getAttribute('data-user-alias');
  document.querySelectorAll('.leaderboard-table tbody tr').forEach(function (row) {
    var cell = row.querySelector('.alias-cell');
    if (alias && cell && cell.textContent.trim() === alias && !row.classList.contains('lb-you-divider')) row.classList.add('leaderboard-current-user');
  });

  // ── Medals for the top three (visual only; the rank number stays in the text) ──
  var medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
  document.querySelectorAll('.leaderboard-table tbody .rank-cell').forEach(function (cell) {
    var rank = parseInt(cell.textContent.trim(), 10);
    if (medals[rank]) {
      var span = document.createElement('span');
      span.setAttribute('aria-hidden', 'true');
      span.textContent = medals[rank] + ' ';
      cell.insertBefore(span, cell.firstChild);
    }
  });
});
