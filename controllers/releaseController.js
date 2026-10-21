'use strict';

const { parseReleasePackage, validateRelease } = require('../services/releaseImporter');
const { saveReleaseArchive } = require('../services/releaseStorage');
const pool = require('../config/db');
const mock = require('../services/mockService');
const q = require('../query/releaseQueries');

function renderReleasesPage(res, { error = null, success = null } = {}) {
  return res.render('admin/releases', {
    title: 'Release management',
    pageStyles: ['admin'],
    pageScripts: ['admin'],
    releases: mock.getReleases(),
    error,
    success,
  });
}

exports.showReleasesPage = (req, res) => renderReleasesPage(res);

exports.importRelease = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).render('admin/releases', {
      title: 'Release management',
      pageStyles: ['admin'],
      pageScripts: ['admin'],
      releases: mock.getReleases(),
      error: 'No file uploaded.',
      success: null,
    });
  }

  let parsed;
  try {
    parsed = parseReleasePackage(req.file.buffer, req.file.originalname);
  } catch (err) {
    return res.status(400).render('admin/releases', {
      title: 'Release management',
      pageStyles: ['admin'],
      pageScripts: ['admin'],
      releases: mock.getReleases(),
      error: err.message,
      success: null,
    });
  }

  const errors = validateRelease(parsed);
  if (errors.length) {
    return res.status(422).render('admin/releases', {
      title: 'Release management',
      pageStyles: ['admin'],
      pageScripts: ['admin'],
      releases: mock.getReleases(),
      error: errors.join(' | '),
      success: null,
    });
  }

  let client;
  let transactionOpen = false;
  let archivePath;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    transactionOpen = true;

    archivePath = saveReleaseArchive(
      req.file.buffer,
      parsed.manifest.release_id,
      parsed.manifest.version,
      req.file.originalname
    );

    const releaseId = await q.insertContentRelease(client, parsed.manifest, archivePath);

    // 1. Notes
    for (const note of parsed.notes) {
      await q.insertRevisionNote(client, releaseId, note.courseCode, note.markdown, parsed.manifest.version);
    }

    // 2. Passages (if any) — insert before questions that reference them
    for (const p of parsed.passages) {
      await q.insertPassage(client, p.course_id, p.stable_id, p.passage_text, p.version || 1, p.source_lineage);
    }

    // 3. One assessment per course, grouping that course's questions under it
    const courseCodes = [...new Set(parsed.questions.map((qq) => qq.course_id))];
    const assessmentIdByCourse = {};
    for (const code of courseCodes) {
      assessmentIdByCourse[code] = await q.insertAssessment(
        client, releaseId, code, parsed.manifest.academic_year_id, parsed.manifest.release_type
      );
    }

    // 4. Questions + assessment_items (linking each question into its course's assessment)
    let order = 1;
    for (const question of parsed.questions) {
      const questionDbId = await q.insertQuestion(client, question);
      const passageDbId = question.shared_passage_id
        ? await q.getPassageId(client, question.shared_passage_id, question.version || 1)
        : null;
      const section = question.response_format === 'subjective' ? 'subjective' : 'mcq';
      await q.insertAssessmentItem(
        client, assessmentIdByCourse[question.course_id], section, questionDbId, passageDbId, order++, true
      );
    }

    await client.query('COMMIT');
    transactionOpen = false;
    return renderReleasesPage(res, {
      success: `Release ${parsed.manifest.release_id} imported with status "needs_review".`,
    });
  } catch (err) {
    if (client && transactionOpen) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Failed to roll back release import:', rollbackError);
      }
    }
    console.error(err);
    return next(err);
  } finally {
    if (client) client.release();
  }
};