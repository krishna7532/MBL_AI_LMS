'use strict';

/**
 * timer.js — Stage 1 DISPLAY-ONLY exam timer.
 *
 * The authoritative timer is server-controlled in Stage 2 (PRD §5.2, MONTH-04): the server
 * stores the expiry, the client only renders it, and the server auto-submits at expiry.
 * There is deliberately no pause() — the PRD forbids pausing.
 *
 * In Stage 1 the expiry is remembered in localStorage so a refresh doesn't restart the clock,
 * which imitates "reopen and see remaining server time". Use "Reset preview attempt" to clear it.
 */
(function () {
  function ExamTimer(el, onExpiry) {
    this.el = el;
    this.onExpiry = onExpiry;
    this.announce = document.getElementById('timerAnnounce');
    this.announced = {};

    var minutes = parseInt(el.getAttribute('data-duration') || '180', 10);
    var explicit = parseInt(el.getAttribute('data-expires-at') || '', 10); // Stage 2: server-provided epoch ms
    var key = el.getAttribute('data-storage-key');
    var end = null;

    if (explicit) {
      end = explicit;
    } else {
      try { var saved = key && parseInt(localStorage.getItem(key), 10); if (saved) end = saved; } catch (e) { /* ignore */ }
      if (!end) {
        end = Date.now() + minutes * 60 * 1000;
        try { if (key) localStorage.setItem(key, String(end)); } catch (e) { /* ignore */ }
      }
    }
    this.endTime = end;
    this.intervalId = null;
    this.expired = false;
  }

  ExamTimer.prototype.start = function () {
    var self = this;
    this.tick();
    this.intervalId = setInterval(function () { self.tick(); }, 1000);
  };

  ExamTimer.prototype.tick = function () {
    var remaining = Math.max(0, Math.floor((this.endTime - Date.now()) / 1000));
    this.el.textContent = this.format(remaining);
    this.el.classList.remove('timer-warning', 'timer-danger');
    var box = this.el.closest('.timer-display');
    if (box) { box.classList.remove('timer-warning', 'timer-danger'); }
    var level = remaining <= 300 ? 'timer-danger' : remaining <= 600 ? 'timer-warning' : null;
    if (level && box) box.classList.add(level);

    if (remaining <= 600 && remaining > 0 && !this.announced[10]) { this.announced[10] = true; this.say('10 minutes remaining.'); }
    if (remaining <= 300 && remaining > 0 && !this.announced[5]) { this.announced[5] = true; this.say('5 minutes remaining.'); }

    if (remaining <= 0 && !this.expired) {
      this.expired = true;
      this.stop();
      this.say('Time is up.');
      if (typeof this.onExpiry === 'function') this.onExpiry();
    }
  };

  ExamTimer.prototype.say = function (msg) { if (this.announce) this.announce.textContent = msg; };

  ExamTimer.prototype.format = function (total) {
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return h > 0 ? h + ':' + pad(m) + ':' + pad(s) : pad(m) + ':' + pad(s);
  };

  ExamTimer.prototype.stop = function () { if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; } };

  document.addEventListener('DOMContentLoaded', function () {
    var el = document.getElementById('timerDisplay');
    if (!el) return;
    var timer = new ExamTimer(el, function () { document.dispatchEvent(new CustomEvent('exam:expired')); });
    timer.start();
    window.examTimer = timer; // handy for debugging in Stage 1
  });
})();
