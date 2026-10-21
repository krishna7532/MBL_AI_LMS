'use strict';

const AdmZip = require('adm-zip');
const crypto = require('crypto');

function parseZipPackage(buffer) {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();

  const manifestEntry = entries.find((e) => e.entryName === 'manifest.json');
  if (!manifestEntry) throw new Error('manifest.json missing from package');
  const manifest = JSON.parse(manifestEntry.getData().toString('utf8'));

  const checksumsEntry = entries.find((e) => e.entryName === 'checksums.json');
  const checksums = checksumsEntry ? JSON.parse(checksumsEntry.getData().toString('utf8')) : {};

  for (const entry of entries) {
    if (entry.entryName === 'checksums.json' || entry.isDirectory) continue;
    if (entry.entryName.includes('..')) throw new Error(`Unsafe path in package: ${entry.entryName}`);
    const expected = checksums[entry.entryName];
    if (expected) {
      const actual = crypto.createHash('sha256').update(entry.getData()).digest('hex');
      if (`sha256:${actual}` !== expected) throw new Error(`Checksum mismatch: ${entry.entryName}`);
    }
  }

  // notes/C01.md -> { courseCode: 'C01', markdown: '...' }
  const notes = entries
    .filter((e) => e.entryName.startsWith('notes/') && e.entryName.endsWith('.md'))
    .map((e) => ({
      courseCode: require('path').basename(e.entryName, '.md').toUpperCase(),
      markdown: e.getData().toString('utf8'),
    }));

  // assessments/*.json -> each file is one question object matching PRD §9.6
  const questions = entries
    .filter((e) => e.entryName.startsWith('assessments/') && e.entryName.endsWith('.json'))
    .map((e) => JSON.parse(e.getData().toString('utf8')));

  // passages/*.json (optional) -> { stable_id, version, course_id, passage_text, source_lineage }
  const passages = entries
    .filter((e) => e.entryName.startsWith('passages/') && e.entryName.endsWith('.json'))
    .map((e) => JSON.parse(e.getData().toString('utf8')));

  return { manifest, notes, questions, passages };
}

function parseJsonPackage(buffer) {
  let doc;
  try {
    doc = JSON.parse(buffer.toString('utf8'));
  } catch (err) {
    throw new Error('Uploaded file is not valid JSON');
  }
  if (!doc.manifest) throw new Error('JSON package is missing "manifest"');
  if (!Array.isArray(doc.notes)) throw new Error('JSON package is missing "notes" array');
  if (!Array.isArray(doc.questions)) throw new Error('JSON package is missing "questions" array');

  return {
    manifest: doc.manifest,
    notes: doc.notes.map((n) => ({ courseCode: n.course_id, markdown: n.markdown })),
    questions: doc.questions, // must match PRD §9.6 field names directly
    passages: doc.passages || [],
  };
}

function parseReleasePackage(buffer, originalFilename) {
  const name = originalFilename.toLowerCase();
  if (name.endsWith('.json')) return parseJsonPackage(buffer);
  if (name.endsWith('.zip')) return parseZipPackage(buffer);
  throw new Error('Unsupported file type');
}

function validateWeeklyRelease({ manifest, questions }) {
  const errors = [];
  const courses = manifest.courses || [];
  if (courses.length !== 5) errors.push(`Expected 5 course sprints, got ${courses.length}`);

  for (const course of courses) {
    const cid = course.course_id;
    const mcqs = questions.filter((q) => q.course_id === cid && q.response_format?.includes('mcq'));
    if (mcqs.length !== 15) errors.push(`${cid}: expected 15 MCQs, got ${mcqs.length}`);

    const subjective = questions.filter((q) => q.course_id === cid && q.response_format === 'subjective');
    if (subjective.length !== 1) errors.push(`${cid}: expected 1 subjective question, got ${subjective.length}`);

    for (const q of subjective) {
      const total = (q.rubric || []).reduce((sum, r) => sum + r.marks, 0);
      if (total !== 10) errors.push(`${q.question_id}: rubric sums to ${total}, must be 10`);
    }
  }
  return errors;
}

function validateMonthlyRelease({ manifest, questions, passages }) {
  const errors = [];
  const courses = manifest.courses || [];
  if (courses.length !== 5) errors.push(`Expected 5 courses, got ${courses.length}`);

  for (const course of courses) {
    const cid = course.course_id;
    const partA = questions.filter((q) => q.course_id === cid && q.exam_role === 'part_a');
    const partB = questions.filter((q) => q.course_id === cid && q.exam_role === 'part_b');
    const partC = questions.filter((q) => q.course_id === cid && q.exam_role === 'part_c');
    const coursePassages = passages.filter((p) => p.course_id === cid);

    if (coursePassages.length !== 5) errors.push(`${cid}: expected 5 passages, got ${coursePassages.length}`);
    if (partA.length !== 25) errors.push(`${cid}: expected 25 Part A MCQs, got ${partA.length}`);
    if (partB.length !== 3) errors.push(`${cid}: expected 3 Part B questions, got ${partB.length}`);
    if (partC.length !== 2) errors.push(`${cid}: expected 2 Part C questions, got ${partC.length}`);

    const total = [...partA, ...partB, ...partC].reduce((sum, q) => sum + q.marks, 0);
    if (total !== 100) errors.push(`${cid}: total marks = ${total}, expected 100`);

    for (const q of [...partB, ...partC]) {
      const rubricTotal = (q.rubric || []).reduce((sum, r) => sum + r.marks, 0);
      if (rubricTotal !== 10) errors.push(`${q.question_id}: rubric sums to ${rubricTotal}, must be 10`);
    }
  }
  return errors;
}

function validateRelease(parsed) {
  if (parsed.manifest.release_type === 'monthly') return validateMonthlyRelease(parsed);
  return validateWeeklyRelease(parsed); // default: weekly
}

module.exports = { parseReleasePackage, validateWeeklyRelease, validateMonthlyRelease, validateRelease };