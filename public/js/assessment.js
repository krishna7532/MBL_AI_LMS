'use strict';

/**
 * assessment.js — authenticated weekly and monthly exam players.
 *
 * SECURITY NOTE: the original version scored MCQs in the browser using an `isCorrect` flag,
 * which would ship answer keys to the client (PRD §15.1 / SEC-01). This version receives
 * prompts and options ONLY and never scores. Scoring is server-side.
 *
 * All learner-visible text is inserted with textContent (never innerHTML).
 * The server stores authoritative answers. Local storage remains a short-term draft fallback
 * while a save is being retried; result scoring is always calculated by the server.
 */
(function () {
  var PREFIX = 'mbl_stage1_';

  // ── helpers ──────────────────────────────────────────────────────────────
  // Reads a stored draft value, falling back when no valid value exists.
  function load(key, fallback) {
    try { var raw = localStorage.getItem(PREFIX + key); return raw === null ? fallback : JSON.parse(raw); }
    catch (e) { return fallback; }
  }
  // Stores a draft value locally and reports whether storage succeeded.
  function save(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }
  // Removes saved draft entries associated with one attempt.
  function clearWith(fragment) {
    try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf(PREFIX) === 0 && k.indexOf(fragment) !== -1) localStorage.removeItem(k); }); }
    catch (e) { /* ignore */ }
  }
  // Creates a DOM node and applies safe attributes, text, events, and children.
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
  // Reads JSON embedded in the page and reports malformed payloads.
  function parseJson(id) {
    var node = document.getElementById(id);
    if (!node) return null;
    try { return JSON.parse(node.textContent); } catch (e) { console.error('Could not parse #' + id, e); return null; }
  }
  // Sends an authenticated same-origin JSON request and surfaces API errors.
  function requestJson(url, body) {
    return fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body || {}),
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (result) {
        if (!response.ok || result.success === false) {
          var error = new Error(result.message || 'The request could not be completed.');
          error.status = response.status;
          error.userMessage = true;
          throw error;
        }
        return result;
      });
    }).catch(function (error) {
      if (error && error.userMessage) throw error;
      var safeError = new Error('Unable to connect right now. Check your connection and try again.');
      safeError.status = 0;
      throw safeError;
    });
  }
  // Checks whether an answer value contains at least one selection.
  function hasSelection(value) {
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  }
  // Formats the current local time for autosave status messages.
  function clock() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  // Delays invoking a function until calls stop for the requested interval.
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }

  /** Accessible radio group. Selecting an option calls onPick(optionId). */
  function radioGroup(qid, options, current, labelledBy, onPick, multiple) {
    var group = el('div', { class: 'options-list', role: multiple ? 'group' : 'radiogroup', 'aria-labelledby': labelledBy });
    options.forEach(function (opt) {
      var id = qid + '_' + opt.id;
      var selected = multiple ? (Array.isArray(current) ? current : []).indexOf(opt.id) !== -1 : current === opt.id;
      var input = el('input', { type: multiple ? 'checkbox' : 'radio', class: 'option-input', name: qid, value: opt.id, id: id, checked: selected });
      var label = el('label', { class: 'option-item' + (selected ? ' selected' : ''), for: id }, [
        input,
        el('span', { class: 'option-letter', 'aria-hidden': 'true', text: opt.id }),
        el('span', { class: 'option-text', text: opt.text }),
      ]);
      input.addEventListener('change', function () {
        if (!multiple) {
          group.querySelectorAll('.option-item').forEach(function (l) { l.classList.remove('selected'); });
          label.classList.add('selected');
          onPick(opt.id);
          return;
        }
        label.classList.toggle('selected', input.checked);
        var choices = Array.prototype.map.call(
          group.querySelectorAll('input:checked'),
          function (selectedInput) { return selectedInput.value; }
        );
        onPick(choices);
      });
      group.appendChild(label);
    });
    return group;
  }

  /** Character counter with warning / limit states. */
  // Tracks textarea length and updates its warning and limit indicators.
  function bindCounter(textarea, counter, max, warn) {
    // Refreshes the visible count and threshold styles.
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
  // Finds lettered sub-parts at the beginning of prompt lines.
  function subParts(prompt) {
    var found = [], re = /^\s*\(([a-z])\)/gim, m;
    while ((m = re.exec(prompt))) found.push(m[1].toLowerCase());
    return found;
  }
  // Checks whether an answer explicitly labels a requested sub-part.
  function labelled(answer, part) {
    return new RegExp('(^|[\\s(])' + part + '[).]', 'i').test(answer);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Monthly simulation instructions
  // ═══════════════════════════════════════════════════════════════════════════
  // Enables the simulation start button after its timer confirmation is checked.
  function initInstructions() {
    var box = document.getElementById('confirmTimer');
    var btn = document.getElementById('startSimBtn');
    if (!box || !btn) return;
    box.addEventListener('change', function () { btn.disabled = !box.checked; });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Weekly sprint
  // ═══════════════════════════════════════════════════════════════════════════
  // Restores and renders a weekly sprint, including autosave and submission.
  function initSprint() {
    var data = parseJson('mcqData');
    var player = document.querySelector('.mcq-player');
    if (!data || !player) return;

    var mcqs = data.mcqs;
    var base = data.attemptId + '_';
    var localAnswers = load(base + 'mcq', {});
    var answers = {};
    mcqs.forEach(function (q) {
      var saved = data.savedResponses && data.savedResponses[q.assessmentItemId];
      if (Object.prototype.hasOwnProperty.call(localAnswers, q.id)) {
        if (hasSelection(localAnswers[q.id])) answers[q.id] = localAnswers[q.id];
      } else if (saved) {
        var choices = saved.selectedOptionIds || [];
        if (choices.length) answers[q.id] = q.responseFormat === 'multiple_select_mcq' ? choices : choices[0];
      }
    });
    var index = 0;
    var autosaveTimer = null;
    var retryTimer = null;
    var saveQueue = Promise.resolve();
    var saveRevision = 0;
    var latestResponses = null;
    var saveStatus = document.getElementById('autosaveStatus');
    var saveIndicator = document.getElementById('saveIndicator');
    var saveIndicator = document.getElementById('saveIndicator');
    var submitting = false;

    // Builds the complete response payload from the current weekly answers.
    function collectResponses() {
      var values = mcqs.map(function (q) {
        var answer = answers[q.id];
        return {
          assessmentItemId: q.assessmentItemId,
          selectedOptionIds: answer === undefined ? [] : Array.isArray(answer) ? answer : [answer],
        };
      });
      if (data.subjective && data.subjective.assessmentItemId) {
        values.push({
          assessmentItemId: data.subjective.assessmentItemId,
          subjectiveAnswer: textarea ? textarea.value : '',
          assumptions: assume ? assume.value : '',
        });
      }
      return values;
    }

    // Persists queued weekly answers and retries transient failures.
    function flushAutosave() {
      clearTimeout(autosaveTimer);
      if (!latestResponses) return Promise.resolve();
      var sentRevision = saveRevision;
      var payload = latestResponses;
      if (saveStatus) saveStatus.textContent = 'Saving answers to your account…';
      saveQueue = saveQueue.catch(function () {}).then(function () {
        return requestJson(data.autosaveUrl, { responses: payload });
      }).then(function () {
        clearWith(data.attemptId);
        if (saveIndicator) saveIndicator.textContent = 'Saved to your account at ' + clock() + '.';
        if (saveStatus && sentRevision === saveRevision) {
          saveStatus.textContent = 'Saved to your account at ' + clock() + '.';
        } else if (sentRevision !== saveRevision) {
          flushAutosave();
        }
      }).catch(function (error) {
        if (saveIndicator) saveIndicator.textContent = 'Account save failed. Retrying automatically…';
        if (saveStatus) saveStatus.textContent = error.status === 409
          ? 'This attempt is closed. Refreshing…'
          : 'Save failed. Retrying automatically…';
        if (error.status === 409) {
          setTimeout(function () { window.location.reload(); }, 1200);
        } else {
          clearTimeout(retryTimer);
          retryTimer = setTimeout(flushAutosave, 2500);
        }
      });
      return saveQueue;
    }

    // Captures the latest weekly answers and schedules a server save.
    function queueAutosave() {
      latestResponses = collectResponses();
      saveRevision += 1;
      save(base + 'mcq', answers);
      if (textarea) save(base + 'subj', textarea.value);
      if (assume) save(base + 'assume', assume.value);
      clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(flushAutosave, 500);
    }

    // Submits saved weekly answers when the server-derived exam timer expires.
    document.addEventListener('exam:expired', function () {
      if (submitting) return;
      submitting = true;
      document.querySelectorAll('.mcq-player input, #subjectiveAnswer, #assumptions, .sprint-tab-link, #submitSprintBtn, #confirmSubmitBtn')
        .forEach(function (control) { control.disabled = true; });
      if (saveStatus) saveStatus.textContent = 'Time expired. Submitting saved answers…';
      requestJson(data.submitUrl, {}).then(function (response) {
        window.location.href = response.result.resultUrl;
      }).catch(function (error) {
        if (error.status === 409 && error.message === 'This attempt has already been submitted or expired.') {
          window.location.href = data.resultUrl;
          return;
        }
        if (saveStatus) saveStatus.textContent = 'Automatic submission will be retried by the server.';
        setTimeout(function () {
          submitting = false;
          if (window.examTimer) {
            window.examTimer.onExpiry = function () {
              document.dispatchEvent(new CustomEvent('exam:expired'));
            };
          }
          window.location.reload();
        }, 2500);
      });
    });

    // ── tabs ──
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.sprint-tab-link'));
    var panes = Array.prototype.slice.call(document.querySelectorAll('.sprint-tab-pane'));
    // Activates the requested sprint tab and optionally moves keyboard focus.
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
    // Updates the learner's notes-completion indicator.
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

    // Counts the weekly MCQs that currently have answers.
    function answeredCount() { return mcqs.filter(function (q) { return hasSelection(answers[q.id]); }).length; }

    // Refreshes progress text, bars, and completion state for the sprint.
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

    // Renders question navigation dots with their current answer state.
    function renderDots() {
      dots.textContent = '';
      mcqs.forEach(function (q, i) {
        var done = hasSelection(answers[q.id]);
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

    // Renders the selected MCQ and wires its answer and navigation controls.
    function show(i, focusHeading) {
      index = Math.max(0, Math.min(mcqs.length - 1, i));
      var q = mcqs[index];
      var headId = 'q_prompt_' + q.id;
      var clear = el('button', {
        type: 'button', class: 'btn btn-ghost btn-sm', text: 'Clear answer',
        onclick: function () { answers[q.id] = null; save(base + 'mcq', answers); show(index, false); updateSummary(); queueAutosave(); },
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
        radioGroup(q.id, q.options, answers[q.id], headId, function (selection) {
          answers[q.id] = selection; save(base + 'mcq', answers);
          clear.hidden = false; renderDots(); updateSummary(); queueAutosave();
        }, q.responseFormat === 'multiple_select_mcq'),
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
    if (editor && textarea) {
      var max = parseInt(editor.getAttribute('data-max'), 10) || 3000;
      var warn = parseInt(editor.getAttribute('data-warn'), 10) || 0;
      var savedSubjective = data.savedResponses && data.savedResponses[data.subjective.assessmentItemId];
      var localSubjective = load(base + 'subj', null);
      var localAssumptions = load(base + 'assume', null);
      textarea.value = localSubjective !== null ? localSubjective : savedSubjective ? savedSubjective.subjectiveAnswer : '';
      if (assume) assume.value = localAssumptions !== null ? localAssumptions : savedSubjective ? savedSubjective.assumptions : '';
      var refresh = bindCounter(textarea, document.getElementById('answerCounter'), max, warn);
      var persist = debounce(function () {
        var ok = save(base + 'subj', textarea.value) && (!assume || save(base + 'assume', assume.value));
        if (saveIndicator) saveIndicator.textContent = ok ? 'Saving your answer to your account…' : 'Could not save a local draft.';
        queueAutosave();
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
    if (confirmBtn) confirmBtn.addEventListener('click', function () {
      if (submitting) return;
      submitting = true;
      document.querySelectorAll('.mcq-player input, #subjectiveAnswer, #assumptions, .sprint-tab-link, #submitSprintBtn, #confirmSubmitBtn')
        .forEach(function (control) { control.disabled = true; });
      confirmBtn.disabled = true;
      if (saveStatus) saveStatus.textContent = 'Submitting your sprint…';
      requestJson(data.submitUrl, { responses: collectResponses() }).then(function (response) {
        window.location.href = response.result.resultUrl;
      }).catch(function (error) {
        if (error.status === 409 && error.message === 'This attempt has already been submitted or expired.') {
          window.location.href = data.resultUrl;
          return;
        }
        submitting = false;
        document.querySelectorAll('.mcq-player input, #subjectiveAnswer, #assumptions, .sprint-tab-link, #submitSprintBtn, #confirmSubmitBtn')
          .forEach(function (control) { control.disabled = false; });
        confirmBtn.disabled = false;
        if (saveStatus) saveStatus.textContent = error.status === 409
          ? 'This attempt is already closed. Refreshing…'
          : 'Submission failed. Your saved answers are unchanged; try again.';
        if (error.status === 409) setTimeout(function () { window.location.reload(); }, 1200);
      });
    });

    // init
    switchTo('notes', false);
    show(0, false);
    updateSummary();
    latestResponses = collectResponses();
    saveStatus.textContent = 'Saved answers restored from your account.';
    queueAutosave();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Monthly simulation player
  // ═══════════════════════════════════════════════════════════════════════════
  // Restores and renders a monthly simulation with saved answers and timer.
  function initSimulation() {
    var sim = parseJson('simData');
    var content = document.getElementById('simContent');
    if (!sim || !content) return;

    var base = sim.attempt.id + '_';
    var savedResponses = sim.savedResponses || {};
    var localMcq = load(base + 'mcq', {});
    var localWritten = load(base + 'written', {});
    var mcq = {};
    var written = {};
    var status = document.getElementById('autosaveStatus');
    var limits = sim.limits;
    var autosaveTimer = null;
    var retryTimer = null;
    var saveQueue = Promise.resolve();
    var saveRevision = 0;
    var latestResponses = null;
    var submitting = false;
    var saveFailure = null;

    sim.partA.forEach(function (passage) {
      passage.questions.forEach(function (question) {
        var saved = savedResponses[question.assessmentItemId];
        if (Object.prototype.hasOwnProperty.call(localMcq, question.id)) {
          if (hasSelection(localMcq[question.id])) mcq[question.id] = localMcq[question.id];
        } else if (saved) {
          if (hasSelection(saved.selectedOptionIds)) {
            mcq[question.id] = question.responseFormat === 'multiple_select_mcq'
              ? saved.selectedOptionIds
              : saved.selectedOptionIds[0];
          }
        }
      });
    });
    sim.partB.concat(sim.partC).forEach(function (question) {
      var saved = savedResponses[question.assessmentItemId];
      if (Object.prototype.hasOwnProperty.call(localWritten, question.id)) {
        written[question.id] = localWritten[question.id];
      } else if (saved) {
        written[question.id] = {
          answer: saved.subjectiveAnswer || '',
          assumptions: saved.assumptions || '',
        };
      } else {
        written[question.id] = { answer: '', assumptions: '' };
      }
    });

    // Builds a submission payload from all monthly MCQ and written answers.
    function collectResponses() {
      var values = [];
      sim.partA.forEach(function (passage) {
        passage.questions.forEach(function (question) {
          var answer = mcq[question.id];
          values.push({
            assessmentItemId: question.assessmentItemId,
            selectedOptionIds: answer === undefined ? [] : Array.isArray(answer) ? answer : [answer],
          });
        });
      });
      sim.partB.concat(sim.partC).forEach(function (question) {
        var answer = written[question.id] || { answer: '', assumptions: '' };
        values.push({
          assessmentItemId: question.assessmentItemId,
          subjectiveAnswer: answer.answer,
          assumptions: answer.assumptions,
        });
      });
      return values;
    }

    // Saves the queued monthly answers and retries recoverable failures.
    function flushAutosave() {
      clearTimeout(autosaveTimer);
      if (!latestResponses || submitting) return Promise.resolve();
      var sentRevision = saveRevision;
      var payload = latestResponses;
      if (status) status.textContent = 'Saving answers to your account…';
      saveQueue = saveQueue.catch(function () {}).then(function () {
        return requestJson(sim.attempt.autosaveUrl, { responses: payload });
      }).then(function () {
        saveFailure = null;
        clearWith(sim.attempt.id);
        if (status && sentRevision === saveRevision) {
          status.textContent = 'Saved to your account at ' + clock();
        } else if (sentRevision !== saveRevision) {
          flushAutosave();
        }
      }).catch(function (error) {
        saveFailure = error;
        if (status) status.textContent = error.status === 409
          ? 'This attempt is closed. Refreshing…'
          : 'Save failed. Retrying automatically…';
        if (error.status === 409) {
          setTimeout(function () { window.location.reload(); }, 1200);
        } else {
          clearTimeout(retryTimer);
          retryTimer = setTimeout(flushAutosave, 2500);
        }
      });
      return saveQueue;
    }

    // Captures the latest monthly answers and schedules a server save.
    function queueAutosave() {
      latestResponses = collectResponses();
      saveRevision += 1;
      save(base + 'mcq', mcq);
      save(base + 'written', written);
      save(base + 'screen', current);
      clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(flushAutosave, 500);
    }

    var screens = [];
    sim.partA.forEach(function (p) { screens.push({ section: 'A', kind: 'passage', label: 'A' + p.number, passage: p }); });
    sim.partB.forEach(function (q, i) { screens.push({ section: 'B', kind: 'written', label: 'B' + (i + 1), q: q, part: 'Part B' }); });
    sim.partC.forEach(function (q, i) { screens.push({ section: 'C', kind: 'written', label: 'C' + (i + 1), q: q, part: 'Part C' }); });
    var current = Math.min(load(base + 'screen', 0), screens.length - 1);
    var finished = false;

    // Stores the current draft locally and queues it for server autosave.
    function persistAll() {
      var ok = save(base + 'mcq', mcq) && save(base + 'written', written) && save(base + 'screen', current);
      if (status && !saveFailure) status.textContent = ok ? 'Saving answers to your account…' : 'Could not save a local draft.';
      queueAutosave();
    }
    // completeness: 'full' | 'partial' | 'none'
    // Classifies a monthly screen by how many of its answers are complete.
    function stateOf(s) {
      if (s.kind === 'passage') {
        var n = s.passage.questions.filter(function (q) { return hasSelection(mcq[q.id]); }).length;
        return n === s.passage.questions.length ? 'full' : n ? 'partial' : 'none';
      }
      var w = written[s.q.id];
      return w && w.answer && w.answer.trim() ? 'full' : 'none';
    }

    // Renders monthly navigation dots and marks the active section tab.
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
            ? 'Part A passage ' + s.passage.number + ', ' + s.passage.questions.filter(function (q) { return hasSelection(mcq[q.id]); }).length + ' of ' + s.passage.questions.length + ' answered'
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

    // Builds the MCQ card for a question in a monthly passage.
    function questionBlock(q, headingText) {
      var headId = 'sq_' + q.id;
      var card = el('div', { class: 'question-card' }, [
        el('div', { class: 'question-header' }, [
          el('span', { class: 'question-number', 'aria-hidden': 'true', text: String(q.number) }),
          el('p', { class: 'question-prompt', id: headId }, [el('span', { class: 'visually-hidden', text: 'Question ' + q.number + '. ' }), q.prompt]),
        ]),
        radioGroup(q.id, q.options, mcq[q.id], headId, function (selection) { mcq[q.id] = selection; persistAll(); renderDots(); }, q.responseFormat === 'multiple_select_mcq'),
      ]);
      return card;
    }

    // Builds a passage view and its associated MCQ cards.
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

    // Builds a written-question editor and saves changes as they are typed.
    function renderWritten(s) {
      var q = s.q;
      var w = written[q.id] || { answer: '', assumptions: '' };
      var counter = el('div', { class: 'char-counter', id: 'ctr_' + q.id, 'aria-live': 'polite' });
      var ta = el('textarea', { class: 'form-control', id: 'ans_' + q.id, rows: '14', 'aria-describedby': 'ctr_' + q.id + ' help_' + q.id });
      ta.value = w.answer || '';
      var as = el('textarea', { class: 'assumptions-field', id: 'asm_' + q.id, rows: '3', maxlength: String(limits.assumptionsMaxChars) });
      as.value = w.assumptions || '';
      // Copies the editor contents into draft state and queues persistence.
      function store() { written[q.id] = { answer: ta.value, assumptions: as.value }; persistAll(); renderDots(); }
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

    // Renders the current simulation screen and its previous/next controls.
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

    // Changes the active screen, persists progress, and redraws the player.
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
    // Summarizes unanswered questions and flags likely missing sub-part labels.
    function buildSummary() {
      var host = document.getElementById('simSubmitSummary');
      host.textContent = '';
      var totalMcq = 0, answeredMcq = 0;
      sim.partA.forEach(function (p) { p.questions.forEach(function (q) { totalMcq++; if (hasSelection(mcq[q.id])) answeredMcq++; }); });
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
      host.appendChild(el('p', { class: 'text-secondary text-small mt-3', text: 'After you submit, you can’t change your answers. MCQs are scored on the server; written answers may remain pending evaluation.' }));
    }
    var submitBtn = document.getElementById('submitSimBtn');
    if (submitBtn) submitBtn.addEventListener('click', buildSummary);

    // ── Submit once through the same endpoint for manual and expired attempts. ──
    // Locks monthly answer controls while submission is in progress.
    function disableEditing() {
      document.querySelectorAll('#simContent input, #simContent textarea, #simContent button, .section-tab, #submitSimBtn, #confirmSimSubmit')
        .forEach(function (control) { control.disabled = true; });
    }

    // Submits monthly answers manually or automatically at the deadline.
    function finish(automatic) {
      if (finished || submitting) return;
      submitting = true;
      disableEditing();
      if (status) status.textContent = automatic ? 'Time expired. Submitting saved answers…' : 'Submitting your answers…';
      var body = automatic ? {} : { responses: collectResponses() };
      requestJson(sim.attempt.submitUrl, body).then(function (response) {
        finished = true;
        if (window.examTimer) window.examTimer.stop();
        clearWith(sim.attempt.id);
        window.location.href = response.result.resultUrl;
      }).catch(function (error) {
        if (error.status === 409 && error.message === 'This attempt has already been submitted or expired.') {
          window.location.href = '/results/' + encodeURIComponent(sim.attempt.id);
          return;
        }
        if (error.status === 409) {
          window.location.reload();
          return;
        }
        if (status) status.textContent = automatic
          ? 'Connection lost. Retrying automatic submission…'
          : 'Submission failed. Your saved answers remain unchanged; try again.';
        if (automatic) {
          retryTimer = setTimeout(function () { submitting = false; finish(true); }, 3000);
        } else {
          submitting = false;
          if (submitBtn) submitBtn.disabled = false;
          if (confirm) confirm.disabled = false;
          document.querySelectorAll('#simContent input, #simContent textarea, #simContent button, .section-tab, #submitSimBtn, #confirmSimSubmit')
            .forEach(function (control) { control.disabled = false; });
        }
      });
    }
    var confirm = document.getElementById('confirmSimSubmit');
    if (confirm) confirm.addEventListener('click', function () { finish(false); });
    document.addEventListener('exam:expired', function () { finish(true); });

    // warn before accidentally leaving (the timer keeps running either way)
    window.addEventListener('beforeunload', function (e) { if (!finished && !submitting) { e.preventDefault(); e.returnValue = ''; } });

    render(false);
    queueAutosave();
  }

  document.addEventListener('DOMContentLoaded', function () {
    initInstructions();
    initSprint();
    initSimulation();
  });
})();
