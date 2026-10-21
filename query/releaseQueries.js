'use strict';

async function getAcademicYearId(client, label) {
  const r = await client.query(`SELECT id FROM academic_years WHERE label = $1`, [label]);
  if (!r.rows[0]) throw new Error(`Academic year "${label}" not found. Seed it first.`);
  return r.rows[0].id;
}

async function getCourseId(client, code) {
  const r = await client.query(`SELECT id FROM courses WHERE code = $1`, [code]);
  if (!r.rows[0]) throw new Error(`Course "${code}" not found. Seed it first.`);
  return r.rows[0].id;
}

async function getLatestApprovedBlueprintId(client, type) {
  const r = await client.query(
    `SELECT id FROM assessment_blueprints WHERE type = $1 AND status = 'approved' ORDER BY version DESC LIMIT 1`,
    [type]
  );
  if (!r.rows[0]) throw new Error(`No approved "${type}" blueprint exists. Seed one first.`);
  return r.rows[0].id;
}

async function insertContentRelease(client, manifest, archivePath) {
  const academicYearId = await getAcademicYearId(client, manifest.academic_year_id);
  const r = await client.query(
    `INSERT INTO content_releases
       (release_id, release_type, academic_year_id, program_year, week_number, month_number,
        version, content_checksum, status, notes_approval_status, assessment_approval_status, manifest)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'needs_review','draft','draft',$9)
     RETURNING id`,
    [
      manifest.release_id,
      manifest.release_type,
      academicYearId,
      manifest.program_year,
      manifest.week_number || null,
      manifest.month_number || null,
      manifest.version,
      manifest.content_checksum || null,
      JSON.stringify({ ...manifest, _archive_path: archivePath }),
    ]
  );
  return r.rows[0].id;
}

async function insertRevisionNote(client, releaseId, courseCode, markdown, version) {
  const courseId = await getCourseId(client, courseCode);
  await client.query(
    `INSERT INTO revision_notes (stable_id, version, release_id, course_id, markdown)
     VALUES ($1,$2,$3,$4,$5)`,
    [`${courseCode}-notes`, version, releaseId, courseId, markdown]
  );
}

// Looks up a passage by stable_id if the question references one; returns null if none given
async function getPassageId(client, stableId, version) {
  if (!stableId) return null;
  const r = await client.query(
    `SELECT id FROM passages WHERE stable_id = $1 AND version = $2`,
    [stableId, version]
  );
  if (!r.rows[0]) throw new Error(`Passage "${stableId}" v${version} not found — import passages before questions that reference them.`);
  return r.rows[0].id;
}

async function insertPassage(client, courseCode, stableId, text, version, sourceLineage) {
  const courseId = await getCourseId(client, courseCode);
  const r = await client.query(
    `INSERT INTO passages (stable_id, version, course_id, passage_text, source_lineage)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (stable_id, version) DO UPDATE SET passage_text = EXCLUDED.passage_text
     RETURNING id`,
    [stableId, version, courseId, text, JSON.stringify(sourceLineage || [])]
  );
  return r.rows[0].id;
}

// q is a question object matching the PRD §9.6 field names exactly
async function insertQuestion(client, q) {
  const courseId = await getCourseId(client, q.course_id);
  const passageId = await getPassageId(client, q.shared_passage_id, q.version || 1);

  const r = await client.query(
    `INSERT INTO questions
       (question_id, version, course_id, concept_ids, exam_role, question_type, response_format,
        stem_form, shared_passage_id, question_number, prompt_markdown, options, correct_option_ids,
        explanation_markdown, directive_verbs, marks, sub_issues, required_authority, required_output,
        assumptions_policy, rubric, expected_answer_points, origin, source_refs, pattern_confidence,
        approval_status, learner_badge)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
     RETURNING id`,
    [
      q.question_id, q.version || 1, courseId, JSON.stringify(q.concept_ids || []),
      q.exam_role, q.question_type, q.response_format, q.stem_form, passageId, q.question_number || null,
      q.prompt_markdown, JSON.stringify(q.options || []), JSON.stringify(q.correct_option_ids || []),
      q.explanation_markdown || null, JSON.stringify(q.directive_verbs || []), q.marks,
      JSON.stringify(q.sub_issues || []), JSON.stringify(q.required_authority || []),
      JSON.stringify(q.required_output || []), q.assumptions_policy || null,
      JSON.stringify(q.rubric || []), JSON.stringify(q.expected_answer_points || []),
      q.origin, JSON.stringify(q.source_refs || []), q.pattern_confidence,
      'needs_review', q.learner_badge || null,
    ]
  );
  return r.rows[0].id;
}

async function insertAssessment(client, releaseId, courseCode, academicYearLabel, blueprintType) {
  const courseId = await getCourseId(client, courseCode);
  const academicYearId = await getAcademicYearId(client, academicYearLabel);
  const assessmentType = blueprintType === 'practice_bank' ? 'practice' : blueprintType;
  const blueprintId = await getLatestApprovedBlueprintId(client, assessmentType);

  const r = await client.query(
    `INSERT INTO assessments (assessment_id, release_id, course_id, academic_year_id, blueprint_id, type, title, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'draft')
     RETURNING id`,
    [`${releaseId}-${courseCode}`, releaseId, courseId, academicYearId, blueprintId, assessmentType, `${courseCode} assessment`]
  );
  return r.rows[0].id;
}

async function insertAssessmentItem(client, assessmentId, section, questionDbId, passageDbId, order, compulsory) {
  await client.query(
    `INSERT INTO assessment_items (assessment_id, section, question_id, passage_id, item_order, compulsory)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [assessmentId, section, questionDbId, passageDbId, order, compulsory]
  );
}

module.exports = {
  getCourseId, getAcademicYearId, getLatestApprovedBlueprintId, getPassageId,
  insertContentRelease, insertRevisionNote, insertPassage,
  insertQuestion, insertAssessment, insertAssessmentItem,
};