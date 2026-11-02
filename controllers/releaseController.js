'use strict';

const { parseReleasePackage, validateRelease } = require('../services/releaseImporter');
const { saveReleaseArchive, deleteReleaseArchive } = require('../services/releaseStorage');
const prisma = require('../config/db');
const dataService = require('../services/lmsDataService');
const q = require('../query/releaseQueries');

// Helper to render the release management view with current list of releases
async function renderReleasesPage(res, { error = null, success = null } = {}) {
  const releases = await dataService.getReleases();
  return res.render('admin/releases', {
    title: 'Release management',
    pageStyles: ['admin'],
    pageScripts: ['admin'],
    releases,
    error,
    success,
  });
}

// Renders the releases overview table for administrators
exports.showReleasesPage = async (req, res, next) => {
  try {
    return await renderReleasesPage(res);
  } catch (error) {
    return next(error);
  }
};

// Shows preview of notes, passages, and assessments inside a release package
exports.previewRelease = async (req, res, next) => {
  try {
    const release = await dataService.getReleasePreview(req.params.releaseId);
    if (!release) {
      const error = new Error('Release not found.');
      error.status = 404;
      throw error;
    }

    return res.render('admin/release-preview', {
      title: `Preview: ${release.releaseId}`,
      pageStyles: ['admin'],
      pageScripts: ['admin'],
      release,
    });
  } catch (error) {
    return next(error);
  }
};

// Parses, validates, uploads S3 archive, and saves content release database records
exports.importRelease = async (req, res, next) => {
  if (!req.file) {
    try {
      await renderReleasesPage(res.status(400), { error: 'No file uploaded.' });
      return;
    } catch (error) {
      return next(error);
    }
  }

  let parsed;
  try {
    parsed = parseReleasePackage(req.file.buffer, req.file.originalname);
  } catch (err) {
    try {
      await renderReleasesPage(res.status(400), { error: err.message });
      return;
    } catch (error) {
      return next(error);
    }
  }

  const errors = validateRelease(parsed);
  if (errors.length) {
    try {
      await renderReleasesPage(res.status(422), { error: errors.join(' | ') });
      return;
    } catch (error) {
      return next(error);
    }
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

    return await renderReleasesPage(res, {
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

// Publishes an approved release, making its assessments visible to learners
exports.publishRelease = async (req, res, next) => {
  const releaseId = req.params.releaseId;
  const actorId = req.user ? req.user.id : null;

  try {
    await prisma.$transaction(async (transaction) => {
      const release = await transaction.content_releases.findUnique({
        where: { id: releaseId },
        select: {
          status: true,
          notes_approval_status: true,
          assessment_approval_status: true,
          publish_at: true,
        },
      });
      if (!release) {
        const error = new Error('Release not found.');
        error.status = 404;
        throw error;
      }

      const notesApproved =
        release.notes_approval_status === 'approved' ||
        release.notes_approval_status === 'n/a';
      if (
        release.status !== 'approved' ||
        !notesApproved ||
        release.assessment_approval_status !== 'approved'
      ) {
        const error = new Error('Only fully approved releases can be published.');
        error.status = 409;
        throw error;
      }

      const publishAt = new Date();
      await transaction.content_releases.update({
        where: { id: releaseId },
        data: {
          status: 'published',
          publish_at: publishAt,
        },
      });
      await transaction.audit_events.create({
        data: {
          actor_id: actorId,
          action: 'content_release.published',
          target_type: 'content_release',
          target_id: releaseId,
          before_data: {
            status: release.status,
            publish_at: release.publish_at,
          },
          after_data: {
            status: 'published',
            publish_at: publishAt.toISOString(),
          },
          reason: null,
        },
      });
    });

    return await renderReleasesPage(res, {
      success: 'Release published successfully.',
    });
  } catch (error) {
    return next(error);
  }
};

// Retires a published release, removing it from active assessment schedules
exports.retireRelease = async (req, res, next) => {
  const releaseId = req.params.releaseId;
  const actorId = req.user ? req.user.id : null;

  try {
    await prisma.$transaction(async (transaction) => {
      const release = await transaction.content_releases.findUnique({
        where: { id: releaseId },
        select: { status: true },
      });
      if (!release) {
        const error = new Error('Release not found.');
        error.status = 404;
        throw error;
      }
      if (release.status !== 'published') {
        const error = new Error('Only published releases can be retired.');
        error.status = 409;
        throw error;
      }

      await transaction.content_releases.update({
        where: { id: releaseId },
        data: { status: 'retired' },
      });
      await transaction.audit_events.create({
        data: {
          actor_id: actorId,
          action: 'content_release.retired',
          target_type: 'content_release',
          target_id: releaseId,
          before_data: { status: release.status },
          after_data: { status: 'retired' },
          reason: null,
        },
      });
    });

    return await renderReleasesPage(res, {
      success: 'Release retired successfully.',
    });
  } catch (error) {
    return next(error);
  }
};
