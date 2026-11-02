'use strict';

// Looks up the internal database UUID for an academic year label (e.g. '2024-2025')
async function getAcademicYearId(prisma, label) {
  const academicYear = await prisma.academic_years.findUnique({
    where: { label },
    select: { id: true },
  });
  if (!academicYear) throw new Error(`Academic year "${label}" not found. Seed it first.`);
  return academicYear.id;
}

// Looks up the internal database UUID for a course code (e.g. 'L1')
async function getCourseId(prisma, code) {
  const course = await prisma.courses.findUnique({
    where: { code },
    select: { id: true },
  });
  if (!course) throw new Error(`Course "${code}" not found. Seed it first.`);
  return course.id;
}

// Finds the most recent approved blueprint for an assessment type
async function getLatestApprovedBlueprintId(prisma, type) {
  const blueprint = await prisma.assessment_blueprints.findFirst({
    where: { type, status: 'approved' },
    orderBy: { version: 'desc' },
    select: { id: true },
  });
  if (!blueprint) throw new Error(`No approved "${type}" blueprint exists. Seed one first.`);
  return blueprint.id;
}

// Inserts a new content release record in 'needs_review' status from imported manifest
async function insertContentRelease(prisma, manifest, archiveKey) {
  const academicYearId = await getAcademicYearId(prisma, manifest.academic_year_id);
  const release = await prisma.content_releases.create({
    data: {
      release_id: manifest.release_id,
      release_type: manifest.release_type,
      academic_year_id: academicYearId,
      program_year: manifest.program_year,
      week_number: manifest.week_number || null,
      month_number: manifest.month_number || null,
      version: manifest.version,
      content_checksum: manifest.content_checksum || null,
      status: 'needs_review',
      notes_approval_status: 'draft',
      assessment_approval_status: 'draft',
      manifest: { ...manifest, _archive_key: archiveKey },
    },
    select: { id: true },
  });
  return release.id;
}

// Stores revision notes markdown for a specific release and course
async function insertRevisionNote(prisma, releaseId, courseCode, markdown, version, releaseCode) {
  const courseId = await getCourseId(prisma, courseCode);
  await prisma.revision_notes.create({
    data: {
      stable_id: `${releaseCode}-${courseCode}-notes`,
      version,
      release_id: releaseId,
      course_id: courseId,
      markdown,
    },
  });
}

// Looks up passage UUID by stable identifier and version
async function getPassageId(prisma, stableId, version) {
  if (!stableId) return null;

  const passage = await prisma.passages.findUnique({
    where: { stable_id_version: { stable_id: stableId, version } },
    select: { id: true },
  });
  if (!passage) {
    throw new Error(
      `Passage "${stableId}" v${version} not found — import passages before questions that reference them.`
    );
  }
  return passage.id;
}

// Creates or updates a reading passage referenced by assessment questions
async function insertPassage(prisma, courseCode, stableId, text, version, sourceLineage) {
  const courseId = await getCourseId(prisma, courseCode);
  const passage = await prisma.passages.upsert({
    where: { stable_id_version: { stable_id: stableId, version } },
    update: { passage_text: text },
    create: {
      stable_id: stableId,
      version,
      course_id: courseId,
      passage_text: text,
      source_lineage: sourceLineage || [],
    },
    select: { id: true },
  });
  return passage.id;
}

// Inserts an exam question along with its options, rubric, and metadata
async function insertQuestion(prisma, question) {
  const courseId = await getCourseId(prisma, question.course_id);
  const passageId = await getPassageId(
    prisma,
    question.shared_passage_id,
    question.version || 1
  );

  const inserted = await prisma.questions.create({
    data: {
      question_id: question.question_id,
      version: question.version || 1,
      course_id: courseId,
      concept_ids: question.concept_ids || [],
      exam_role: question.exam_role,
      question_type: question.question_type,
      response_format: question.response_format,
      stem_form: question.stem_form,
      shared_passage_id: passageId,
      question_number: question.question_number || null,
      prompt_markdown: question.prompt_markdown,
      options: question.options || [],
      correct_option_ids: question.correct_option_ids || [],
      explanation_markdown: question.explanation_markdown || null,
      directive_verbs: question.directive_verbs || [],
      marks: question.marks,
      sub_issues: question.sub_issues || [],
      required_authority: question.required_authority || [],
      required_output: question.required_output || [],
      assumptions_policy: question.assumptions_policy || null,
      rubric: question.rubric || [],
      expected_answer_points: question.expected_answer_points || [],
      origin: question.origin,
      source_refs: question.source_refs || [],
      pattern_confidence: question.pattern_confidence,
      approval_status: 'needs_review',
      learner_badge: question.learner_badge || null,
    },
    select: { id: true },
  });
  return inserted.id;
}

// Creates an assessment shell linked to the release, course, and blueprint
async function insertAssessment(
  prisma,
  releaseId,
  courseCode,
  academicYearLabel,
  blueprintType
) {
  const courseId = await getCourseId(prisma, courseCode);
  const academicYearId = await getAcademicYearId(prisma, academicYearLabel);
  const assessmentType = blueprintType === 'practice_bank' ? 'practice' : blueprintType;
  const blueprintId = await getLatestApprovedBlueprintId(prisma, assessmentType);

  const assessment = await prisma.assessments.create({
    data: {
      assessment_id: `${releaseId}-${courseCode}`,
      release_id: releaseId,
      course_id: courseId,
      academic_year_id: academicYearId,
      blueprint_id: blueprintId,
      type: assessmentType,
      title: `${courseCode} assessment`,
      status: 'draft',
    },
    select: { id: true },
  });
  return assessment.id;
}

// Links a question to an assessment in a specific section and ordering
async function insertAssessmentItem(
  prisma,
  assessmentId,
  section,
  questionDbId,
  passageDbId,
  order,
  compulsory
) {
  await prisma.assessment_items.create({
    data: {
      assessment_id: assessmentId,
      section,
      question_id: questionDbId,
      passage_id: passageDbId,
      item_order: order,
      compulsory,
    },
  });
}

module.exports = {
  getCourseId,
  getAcademicYearId,
  getLatestApprovedBlueprintId,
  getPassageId,
  insertContentRelease,
  insertRevisionNote,
  insertPassage,
  insertQuestion,
  insertAssessment,
  insertAssessmentItem,
};
