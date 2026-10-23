'use strict';

const { parseReleasePackage, validateRelease } = require('../services/releaseImporter');
const { saveReleaseArchive, deleteReleaseArchive } = require('../services/releaseStorage');
const prisma = require('../config/db');
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

  let transactionCallbackCompleted = false;
  let archiveKey;
  try {
    archiveKey = await saveReleaseArchive(
      req.file.buffer,
      parsed.manifest.release_id,
      parsed.manifest.version,
      req.file.originalname
    );

    await prisma.$transaction(async (transaction) => {
      const releaseId = await q.insertContentRelease(transaction, parsed.manifest, archiveKey);

      for (const note of parsed.notes) {
        await q.insertRevisionNote(
          transaction,
          releaseId,
          note.courseCode,
          note.markdown,
          parsed.manifest.version,
          parsed.manifest.release_id
        );
      }

      for (const passage of parsed.passages) {
        await q.insertPassage(
          transaction,
          passage.course_id,
          passage.stable_id,
          passage.passage_text,
          passage.version || 1,
          passage.source_lineage
        );
      }

      const courseCodes = [...new Set(parsed.questions.map((question) => question.course_id))];
      const assessmentIdByCourse = new Map();
      for (const code of courseCodes) {
        const assessmentId = await q.insertAssessment(
          transaction,
          releaseId,
          code,
          parsed.manifest.academic_year_id,
          parsed.manifest.release_type
        );
        assessmentIdByCourse.set(code, assessmentId);
      }

      let order = 1;
      for (const question of parsed.questions) {
        const questionDbId = await q.insertQuestion(transaction, question);
        const passageDbId = question.shared_passage_id
          ? await q.getPassageId(
            transaction,
            question.shared_passage_id,
            question.version || 1
          )
          : null;
        const section = question.response_format === 'subjective' ? 'subjective' : 'mcq';
        await q.insertAssessmentItem(
          transaction,
          assessmentIdByCourse.get(question.course_id),
          section,
          questionDbId,
          passageDbId,
          order++,
          true
        );
      }

      transactionCallbackCompleted = true;
    }, { timeout: 60000 });

    return renderReleasesPage(res, {
      success: `Release ${parsed.manifest.release_id} imported with status "needs_review".`,
    });
  } catch (err) {
    if (archiveKey && !transactionCallbackCompleted) {
      try {
        await deleteReleaseArchive(archiveKey);
      } catch (cleanupError) {
        console.error('Failed to clean up uploaded release archive:', cleanupError);
      }
    }
    console.error(err);
    return next(err);
  }
};