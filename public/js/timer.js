'use strict';

/**
 * timer.js — exam timer rendered from the server-recorded expiry time.
 *
 * The authoritative timer is server-controlled (PRD §5.2, MONTH-04): the server
 * stores the expiry, the client only renders it, and the server auto-submits at expiry.
 * There is deliberately no pause() — the PRD forbids pausing.
 *
 * The server remains authoritative; this timer only updates the display and notifies the
 * assessment player to request automatic submission at the displayed deadline.
 */
(function () {
  // Initializes a countdown from the attempt's server-provided expiry timestamp.
  function ExamTimer(el, onExpiry) {
    this.el = el;
    this.onExpiry = onExpiry;
    this.announce = document.getElementById('timerAnnounce');
    this.announced = {};

    this.endTime = Number(el.getAttribute('data-expires-at'));
    var serverNow = Number(el.getAttribute('data-server-now'));
    this.clockOffset = Number.isFinite(serverNow) ? serverNow - Date.now() : 0;
    this.intervalId = null;
    this.expired = false;
  }

  // Starts the one-second countdown refresh.
  ExamTimer.prototype.start = function () {
    var self = this;
    this.tick();
    this.intervalId = setInterval(function () { self.tick(); }, 1000);
  };

  // Updates the countdown display and signals expiry once the deadline is reached.
  ExamTimer.prototype.tick = function () {
    var remaining = Math.max(0, Math.floor((this.endTime - (Date.now() + this.clockOffset)) / 1000));
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

  // Announces timer messages for assistive technology.
  ExamTimer.prototype.say = function (msg) { if (this.announce) this.announce.textContent = msg; };

  // Formats a remaining number of seconds as HH:MM:SS.
  ExamTimer.prototype.format = function (total) {
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return pad(h) + ':' + pad(m) + ':' + pad(s);
  };

  // Stops the timer's repeating update.
  ExamTimer.prototype.stop = function () { if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; } };

  // Initializes the visible timer from server-provided attempt metadata.
  document.addEventListener('DOMContentLoaded', function () {
    var el = document.getElementById('timerDisplay');
    if (!el) return;
    if (!Number.isFinite(Number(el.getAttribute('data-expires-at')))) {
      el.textContent = '--:--:--';
      console.error('The exam timer is missing its server-provided expiry time.');
      return;
    }
    var timer = new ExamTimer(el, function () { document.dispatchEvent(new CustomEvent('exam:expired')); });
    timer.start();
    window.examTimer = timer;
  });
})();
