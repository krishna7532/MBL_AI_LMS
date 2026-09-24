'use strict';

/**
 * assessment.js — weekly sprint player and monthly simulation player (Stage 1, mock).
 *
 * SECURITY NOTE: the original version scored MCQs in the browser using an `isCorrect` flag,
 * which would ship answer keys to the client (PRD §15.1 / SEC-01). This version receives
 * prompts and options ONLY and never scores. Scoring is server-side in Stage 2.
 *
 * All learner-visible text is inserted with textContent (never innerHTML).
 * Drafts are kept in localStorage under the "mbl_stage1_" prefix — a Stage 1 stand-in for
 * server autosave. "Reset preview attempt" clears them.
 */
(function () {
  var PREFIX = 'mbl_stage1_';

  // ── helpers ──────────────────────────────────────────────────────────────
  function load(key, fallback) {
    try { var raw = localStorage.getItem(PREFIX + key); return raw === null ? fallback : JSON.parse(raw); }
    catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }
  function clearWith(fragment) {
    try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf(PREFIX) === 0 && k.indexOf(fragment) !== -1) localStorage.removeItem(k); }); }
    catch (e) { /* ignore */ }
  }
  function el(tag, props, kids) {
    var node = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (v === false || v === null || v === undefined) return;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return node;
  }
  function parseJson(id) {
    var node = document.getElementById(id);
    if (!node) return null;
    try { return JSON.parse(node.textContent); } catch (e) { console.error('Could not parse #' + id, e); return null; }
  }
  function clock() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }

  /** Accessible radio group. Selecting an option calls onPick(optionId). */
  function radioGroup(qid, options, current, labelledBy, onPick) {
    var group = el('div', { class: 'options-list', role: 'radiogroup', 'aria-labelledby': labelledBy });
    options.forEach(function (opt) {
      var id = qid + '_' + opt.id;
      var input = el('input', { type: 'radio', class: 'option-input', name: qid, value: opt.id, id: id, checked: current === opt.id });
      var label = el('label', { class: 'option-item' + (current === opt.id ? ' selected' : ''), for: id }, [
        input,
        el('span', { class: 'option-letter', 'aria-hidden': 'true', text: opt.id }),
        el('span', { class: 'option-text', text: opt.text }),
      ]);
      input.addEventListener('change', function () {
        group.querySelectorAll('.option-item').forEach(function (l) { l.classList.remove('selected'); });
        label.classList.add('selected');
        onPick(opt.id);
      });
      group.appendChild(label);
    });
    return group;
  }

  /** Character counter with warning / limit states. */
  function bindCounter(textarea, counter, max, warn) {
    function update() {
      var n = textarea.value.length;
      counter.textContent = n + ' / ' + max;
      counter.classList.toggle('warning', warn ? n >= warn && n < max : n >= max * 0.85 && n < max);
      counter.classList.toggle('danger', n >= max);
    }
    textarea.setAttribute('maxlength', String(max));
    textarea.addEventListener('input', update);
    update();
    return update;
  }

  /** Sub-part labels like (a), (b) found at the start of a prompt line. */
  function subParts(prompt) {
    var found = [], re = /^\s*\(([a-z])\)/gim, m;
    while ((m = re.exec(prompt))) found.push(m[1].toLowerCase());
    return found;
  }
  function labelled(answer, part) {
    return new RegExp('(^|[\\s(])' + part + '[).]', 'i').test(answer);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Monthly simulation instructions
  // ═══════════════════════════════════════════════════════════════════════════
  function initInstructions() {
    var box = document.getElementById('confirmTimer');
    var btn = document.getElementById('startSimBtn');
    if (!box || !btn) return;
    box.addEventListener('change', function () { btn.disabled = !box.checked; });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Weekly sprint
  // ═══════════════════════════════════════════════════════════════════════════
  function initSprint() {
    var data = parseJson('mcqData');
    var player = document.querySelector('.mcq-player');
    if (!data || !player) return;

    var mcqs = data.mcqs;
    var base = 'sprint_' + data.sprintId + '_';
    var answers = load(base + 'mcq', {});
    var index = 0;

    // ── tabs ──
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.sprint-tab-link'));
    var panes = Array.prototype.slice.call(document.querySelectorAll('.sprint-tab-pane'));
    function switchTo(name, focus) {
      tabs.forEach(function (t) {
        var on = t.getAttribute('data-tab') === name;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        if (on && focus) t.focus();
      });
      panes.forEach(function (p) {
        var on = p.getAttribute('data-tab') === name;
        p.classList.toggle('active', on);
        p.hidden = !on;
      });
      var step = document.querySelector('.step-' + name);
      document.querySelectorAll('.sprint-steps .step').forEach(function (s) { s.classList.remove('current'); });
      if (step) step.classList.add('current');
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { switchTo(tab.getAttribute('data-tab'), false); });
      tab.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
        if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
        if (next) { e.preventDefault(); switchTo(next.getAttribute('data-tab'), true); }
      });
    });

    // ── notes ──
    var notesBtn = document.getElementById('completeNotesBtn');
    function markNotes(done) {
      var step = document.querySelector('.step-notes');
      if (step) step.classList.toggle('completed', done);
      if (notesBtn && done) { notesBtn.textContent = 'Notes completed. Go to MCQs'; }
    }
    if (load(base + 'notes', false)) markNotes(true);
    if (notesBtn) notesBtn.addEventListener('click', function () { save(base + 'notes', true); markNotes(true); switchTo('mcq', true); });

    // ── MCQ player ──
    var container = document.querySelector('.question-container');
    var dots = document.querySelector('.question-dots');
    var prev = document.getElementById('prevQuestionBtn');
    var next = document.getElementById('nextQuestionBtn');
    var bar = player.querySelector('.progress-fill');
    var barWrap = player.querySelector('.progress-bar');

    function answeredCount() { return mcqs.filter(function (q) { return answers[q.id]; }).length; }

    function updateSummary() {
      var n = answeredCount();
      var total = mcqs.length;
      if (bar) bar.style.width = (n / total * 100) + '%';
      if (barWrap) barWrap.setAttribute('aria-valuenow', String(n));
      var t = document.getElementById('mcqProgressText'); if (t) t.textContent = n + ' of ' + total + ' answered';
      var tc = document.getElementById('mcqTabCount'); if (tc) tc.textContent = n + '/' + total;
      var subj = document.getElementById('subjectiveAnswer');
      var chars = subj ? subj.value.trim().length : 0;
      var s = document.getElementById('submitStatus');
      if (s) s.textContent = 'MCQs answered: ' + n + ' of ' + total + '. Subjective: ' + (chars ? 'started, ' + chars + ' characters' : 'not started') + '.';
      var step = document.querySelector('.step-mcq'); if (step) step.classList.toggle('completed', n === total);
    }

    function renderDots() {
      dots.textContent = '';
      mcqs.forEach(function (q, i) {
        var done = !!answers[q.id];
        dots.appendChild(el('button', {
          type: 'button',
          class: 'q-dot' + (done ? ' answered' : '') + (i === index ? ' active' : ''),
          'aria-label': 'Question ' + q.number + (done ? ', answered' : ', not answered'),
          'aria-current': i === index ? 'true' : false,
          text: String(q.number),
          onclick: function () { show(i, true); },
        }));
      });
    }

    function show(i, focusHeading) {
      index = Math.max(0, Math.min(mcqs.length - 1, i));
      var q = mcqs[index];
      var headId = 'q_prompt_' + q.id;
      var clear = el('button', {
        type: 'button', class: 'btn btn-ghost btn-sm', text: 'Clear answer',
        onclick: function () { delete answers[q.id]; save(base + 'mcq', answers); show(index, false); updateSummary(); },
      });
      clear.hidden = !answers[q.id];

      var prompt = el('p', { class: 'question-prompt', id: headId, tabindex: '-1' }, [
        el('span', { class: 'visually-hidden', text: 'Question ' + q.number + ' of ' + mcqs.length + '. ' }),
        q.prompt,
      ]);
      var card = el('div', { class: 'question-card' }, [
        el('div', { class: 'question-header' }, [
          el('span', { class: 'question-number', 'aria-hidden': 'true', text: String(q.number) }),
          el('div', {}, [prompt, el('span', { class: 'question-origin-badge', text: q.badge })]),
        ]),
        radioGroup(q.id, q.options, answers[q.id], headId, function (optId) {
          answers[q.id] = optId; save(base + 'mcq', answers);
          clear.hidden = false; renderDots(); updateSummary();
        }),
        el('div', { class: 'question-clear' }, [clear]),
      ]);
      container.textContent = '';
      container.appendChild(card);

      prev.disabled = index === 0;
      var last = index === mcqs.length - 1;
      next.textContent = last ? 'Continue to subjective' : 'Next';
      renderDots();
      if (focusHeading) prompt.focus();
    }

    prev.addEventListener('click', function () { show(index - 1, true); });
    next.addEventListener('click', function () {
      if (index === mcqs.length - 1) switchTo('subjective', true); else show(index + 1, true);
    });

    // ── subjective ──
    var editor = document.querySelector('.subjective-editor');
    var textarea = document.getElementById('subjectiveAnswer');
    var assume = document.getElementById('assumptions');
    var indicator = document.getElementById('saveIndicator');
    if (editor && textarea) {
      var max = parseInt(editor.getAttribute('data-max'), 10) || 3000;
      var warn = parseInt(editor.getAttribute('data-warn'), 10) || 0;
      textarea.value = load(base + 'subj', '');
      if (assume) assume.value = load(base + 'assume', '');
      var refresh = bindCounter(textarea, document.getElementById('answerCounter'), max, warn);
      var persist = debounce(function () {
        var ok = save(base + 'subj', textarea.value) && (!assume || save(base + 'assume', assume.value));
        if (indicator) indicator.textContent = ok ? 'Draft saved on this device at ' + clock() + '.' : 'Could not save the draft on this device.';
      }, 700);
      textarea.addEventListener('input', function () { refresh(); persist(); updateSummary(); });
      if (assume) assume.addEventListener('input', persist);
    }

    // ── submit ──
    var submitBtn = document.getElementById('submitSprintBtn');
    var confirmBtn = document.getElementById('confirmSubmitBtn');
    if (submitBtn) submitBtn.addEventListener('click', function () {
      var n = answeredCount();
      var chars = textarea ? textarea.value.trim().length : 0;
      var text = 'You answered ' + n + ' of ' + mcqs.length + ' MCQs' + (n < mcqs.length ? '. The ' + (mcqs.length - n) + ' unanswered will score 0' : '') + '. ' +
        (chars ? 'Your subjective answer is ' + chars + ' characters.' : 'You haven\u2019t written a subjective answer, so it will score 0.');
      document.getElementById('submitSummary').textContent = text;
    });
    if (confirmBtn) confirmBtn.addEventListener('click', function () { window.location.href = data.resultUrl; });

    // init
    switchTo('notes', false);
    show(0, false);
    updateSummary();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Monthly simulation player
  // ═══════════════════════════════════════════════════════════════════════════
  function initSimulation() {
    var sim = parseJson('simData');
    var content = document.getElementById('simContent');
    if (!sim || !content) return;

    var base = sim.id + '_';
    var mcq = load(base + 'mcq', {});
    var written = load(base + 'written', {});
    var status = document.getElementById('autosaveStatus');
    var limits = sim.limits;

    var screens = [];
    sim.partA.forEach(function (p) { screens.push({ section: 'A', kind: 'passage', label: 'A' + p.number, passage: p }); });
    sim.partB.forEach(function (q, i) { screens.push({ section: 'B', kind: 'written', label: 'B' + (i + 1), q: q, part: 'Part B' }); });
    sim.partC.forEach(function (q, i) { screens.push({ section: 'C', kind: 'written', label: 'C' + (i + 1), q: q, part: 'Part C' }); });
    var current = Math.min(load(base + 'screen', 0), screens.length - 1);
    var finished = false;

    function persistAll() {
      var ok = save(base + 'mcq', mcq) && save(base + 'written', written) && save(base + 'screen', current);
      if (status) status.textContent = ok ? 'Saved on this device at ' + clock() : 'Could not save on this device';
    }
    var persistSoon = debounce(persistAll, 600);

    // completeness: 'full' | 'partial' | 'none'
    function stateOf(s) {
      if (s.kind === 'passage') {
        var n = s.passage.questions.filter(function (q) { return mcq[q.id]; }).length;
        return n === s.passage.questions.length ? 'full' : n ? 'partial' : 'none';
      }
      var w = written[s.q.id];
      return w && w.answer && w.answer.trim() ? 'full' : 'none';
    }

    function renderDots() {
      var host = document.getElementById('simDots');
      host.textContent = '';
      ['A', 'B', 'C'].forEach(function (sec) {
        var group = el('div', { class: 'dot-group' }, [el('span', { class: 'dot-group-label', text: 'Part ' + sec })]);
        var row = el('div', { class: 'dot-row' });
        screens.forEach(function (s, i) {
          if (s.section !== sec) return;
          var st = stateOf(s);
          var desc = s.kind === 'passage'
            ? 'Part A passage ' + s.passage.number + ', ' + s.passage.questions.filter(function (q) { return mcq[q.id]; }).length + ' of 5 answered'
            : s.part + ' question ' + s.label.slice(1) + (st === 'full' ? ', answered' : ', not answered');
          row.appendChild(el('button', {
            type: 'button',
            class: 'q-dot sim-dot' + (st === 'full' ? ' answered' : st === 'partial' ? ' partial' : '') + (i === current ? ' active' : ''),
            'aria-label': desc, 'aria-current': i === current ? 'true' : false, text: s.label,
            onclick: function () { go(i); },
          }));
        });
        group.appendChild(row);
        host.appendChild(group);
      });
      document.querySelectorAll('.section-tab').forEach(function (t) {
        var on = t.getAttribute('data-section') === screens[current].section;
        t.classList.toggle('active', on); t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
      });
    }

    function questionBlock(q, headingText) {
      var headId = 'sq_' + q.id;
      var card = el('div', { class: 'question-card' }, [
        el('div', { class: 'question-header' }, [
          el('span', { class: 'question-number', 'aria-hidden': 'true', text: String(q.number) }),
          el('p', { class: 'question-prompt', id: headId }, [el('span', { class: 'visually-hidden', text: 'Question ' + q.number + '. ' }), q.prompt]),
        ]),
        radioGroup(q.id, q.options, mcq[q.id], headId, function (opt) { mcq[q.id] = opt; persistSoon(); renderDots(); }),
      ]);
      return card;
    }

    function renderPassage(s) {
      var p = s.passage;
      var passage = el('section', { class: 'passage-display', 'aria-label': 'Passage ' + p.number }, [
        el('h2', { class: 'passage-title', text: p.title }),
        p.isPlaceholder ? el('p', {}, [el('span', { class: 'badge badge-warning', text: 'Stage 1 placeholder passage' })]) : null,
        el('p', { class: 'passage-text', text: p.text }),
      ]);
      var qs = el('div', { class: 'passage-questions' }, p.questions.map(function (q) { return questionBlock(q); }));
      return el('div', { class: 'passage-split' }, [passage, qs]);
    }

    function renderWritten(s) {
      var q = s.q;
      var w = written[q.id] || { answer: '', assumptions: '' };
      var counter = el('div', { class: 'char-counter', id: 'ctr_' + q.id, 'aria-live': 'polite' });
      var ta = el('textarea', { class: 'form-control', id: 'ans_' + q.id, rows: '14', 'aria-describedby': 'ctr_' + q.id + ' help_' + q.id });
      ta.value = w.answer || '';
      var as = el('textarea', { class: 'assumptions-field', id: 'asm_' + q.id, rows: '3', maxlength: String(limits.assumptionsMaxChars) });
      as.value = w.assumptions || '';
      function store() { written[q.id] = { answer: ta.value, assumptions: as.value }; persistSoon(); renderDots(); }
      ta.addEventListener('input', store);
      as.addEventListener('input', store);
      bindCounter(ta, counter, limits.subjectiveMaxChars, 0);

      return el('div', { class: 'question-card subjective-card' }, [
        el('h2', { class: 'section-title', text: s.part + ', question ' + s.label.slice(1) + ' (' + q.marks + ' marks)' }),
        el('p', { class: 'question-prompt subjective-prompt', text: q.prompt }),
        el('div', { class: 'subjective-editor' }, [
          el('label', { class: 'form-label', for: ta.id, text: 'Your answer' }),
          el('p', { class: 'form-text', id: 'help_' + q.id, text: 'Number each sub-part, for example (a), (b), (c). Cite relevant case law.' }),
          ta, counter,
          el('label', { class: 'form-label mt-3', for: as.id, text: 'Assumptions (optional)' }),
          as,
        ]),
      ]);
    }

    function render(focus) {
      var s = screens[current];
      content.textContent = '';
      content.appendChild(s.kind === 'passage' ? renderPassage(s) : renderWritten(s));
      content.appendChild(el('div', { class: 'question-nav' }, [
        el('button', { type: 'button', class: 'btn btn-secondary', text: 'Previous', disabled: current === 0, onclick: function () { go(current - 1); } }),
        el('span', { class: 'text-secondary text-small', text: 'Screen ' + (current + 1) + ' of ' + screens.length }),
        el('button', { type: 'button', class: 'btn btn-primary', text: current === screens.length - 1 ? 'Review and submit' : 'Next', onclick: function () { if (current === screens.length - 1) { buildSummary(); window.openModal('submitSimModal'); } else go(current + 1); } }),
      ]));
      renderDots();
      content.scrollTop = 0;
      window.scrollTo(0, 0);
      if (focus) content.focus();
    }

    function go(i) {
      if (finished) return;
      current = Math.max(0, Math.min(screens.length - 1, i));
      persistAll();
      render(true);
    }

    document.querySelectorAll('.section-tab').forEach(function (t) {
      t.addEventListener('click', function () {
        var sec = t.getAttribute('data-section');
        for (var i = 0; i < screens.length; i++) if (screens[i].section === sec) { go(i); return; }
      });
    });

    // ── submit summary (unanswered items + unlabelled sub-parts; PRD §7.3) ──
    function buildSummary() {
      var host = document.getElementById('simSubmitSummary');
      host.textContent = '';
      var totalMcq = 0, answeredMcq = 0;
      sim.partA.forEach(function (p) { p.questions.forEach(function (q) { totalMcq++; if (mcq[q.id]) answeredMcq++; }); });
      var lines = [];
      lines.push('Part A: ' + answeredMcq + ' of ' + totalMcq + ' MCQs answered' + (answeredMcq < totalMcq ? ' (unanswered score 0)' : '') + '.');
      [['Part B', sim.partB], ['Part C', sim.partC]].forEach(function (pair) {
        var done = pair[1].filter(function (q) { return written[q.id] && written[q.id].answer.trim(); }).length;
        lines.push(pair[0] + ': ' + done + ' of ' + pair[1].length + ' written answers started' + (done < pair[1].length ? ' (blank answers score 0)' : '') + '.');
      });
      var ul = el('ul', { class: 'summary-list' }, lines.map(function (l) { return el('li', { text: l }); }));
      host.appendChild(ul);

      var hints = [];
      sim.partB.concat(sim.partC).forEach(function (q, i) {
        var w = written[q.id]; if (!w || !w.answer.trim()) return;
        var missing = subParts(q.prompt).filter(function (p) { return !labelled(w.answer, p); });
        if (missing.length) hints.push(q.label + ': no label found for ' + missing.map(function (m) { return '(' + m + ')'; }).join(', ') + '.');
      });
      if (hints.length) {
        host.appendChild(el('p', { class: 'form-label mt-3', text: 'Check these sub-parts' }));
        host.appendChild(el('ul', { class: 'summary-list' }, hints.map(function (h) { return el('li', { text: h }); })));
        host.appendChild(el('p', { class: 'text-secondary text-small', text: 'This is a hint only. If you answered a sub-part without labelling it, you can submit.' }));
      }
      host.appendChild(el('p', { class: 'text-secondary text-small mt-3', text: 'After you submit, you can\u2019t change your answers. Stage 1 preview: nothing is scored or saved on a server.' }));
    }
    var submitBtn = document.getElementById('submitSimBtn');
    if (submitBtn) submitBtn.addEventListener('click', buildSummary);

    // ── finish (manual or timer expiry) ──
    function finish(auto) {
      if (finished) return;
      finished = true;
      persistAll();
      if (window.examTimer) window.examTimer.stop();
      clearWith(sim.id); // next visit starts a fresh preview attempt
      window.closeModal('submitSimModal');
      window.closeModal('timeUpModal');
      document.querySelector('.assessment-sidebar').hidden = true;
      if (submitBtn) submitBtn.disabled = true;
      content.textContent = '';
      content.appendChild(el('div', { class: 'simulation-instructions' }, [
        el('h2', { class: 'page-title', text: auto ? 'Time ran out, so your answers were submitted' : 'Simulation submitted' }),
        el('p', { text: 'This is a Stage 1 preview. Your answers were not scored or sent anywhere. In Stage 2, MCQs are scored immediately and your five written answers are evaluated, then you see section scores and feedback out of 100.' }),
        el('div', { class: 'flex gap-2 mt-3' }, [
          el('a', { class: 'btn btn-primary', href: '/results/attempt_m02_c02', text: 'View a sample monthly result' }),
          el('a', { class: 'btn btn-secondary', href: '/monthly', text: 'Back to Monthly Revision' }),
        ]),
      ]));
      content.setAttribute('tabindex', '-1'); content.focus();
    }
    var confirm = document.getElementById('confirmSimSubmit');
    if (confirm) confirm.addEventListener('click', function () { finish(false); });
    document.addEventListener('exam:expired', function () { if (!finished) window.openModal('timeUpModal'); });
    var cont = document.getElementById('timeUpContinue');
    if (cont) cont.addEventListener('click', function () { finish(true); });

    // warn before accidentally leaving (the timer keeps running either way)
    window.addEventListener('beforeunload', function (e) { if (!finished) { e.preventDefault(); e.returnValue = ''; } });

    render(false);
  }

  document.addEventListener('DOMContentLoaded', function () {
    initInstructions();
    initSprint();
    initSimulation();
  });
})();
