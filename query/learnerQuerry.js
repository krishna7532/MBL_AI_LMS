`use strict`;

const prisma = require('../config/db');

exports.getFirstYearCourses=async()=>
    prisma.courses.findMany({
        where:{program_year:'Y1'}
    });
exports.getSecondYearCourses=async()=>
    prisma.courses.findMany({
        where:{program_year:'Y2'}
    });

exports.getCourseByCode = async (code, userId) => {
    const course = await prisma.courses.findUnique({
        where: { code },
        select: {
            id: true,
            code: true,
            display_name: true,
            program_year: true,
            active: true,
            assessments: {
                where: {
                    type: 'weekly',
                    content_releases: {
                        is: {
                            release_type: 'weekly',
                            status: 'published',
                        },
                    },
                },
                orderBy: { created_at: 'asc' },
                select: {
                    id: true,
                    title: true,
                    release_id: true,
                    content_releases: {
                        select: {
                            release_id: true,
                            week_number: true,
                            publish_at: true,
                        },
                    },
                },
            },
        },
    });
    if (!course) return null;

    const assessmentIds = course.assessments.map((assessment) => assessment.id);
    const attempts = userId && assessmentIds.length
        ? await prisma.attempts.findMany({
            where: {
                user_id: userId,
                assessment_id: { in: assessmentIds },
                submitted_at: { not: null },
            },
            select: { assessment_id: true },
            distinct: ['assessment_id'],
        })
        : [];
    const completedAssessmentIds = new Set(attempts.map((attempt) => attempt.assessment_id));

    return {
        id: course.id,
        code: course.code,
        name: course.display_name,
        programYear: course.program_year,
        active: course.active,
        sprints: course.assessments.map((assessment) => ({
            id: assessment.id,
            title: assessment.title || assessment.content_releases.release_id,
            weekNumber: assessment.content_releases.week_number,
            publishedAt: assessment.content_releases.publish_at,
            status: completedAssessmentIds.has(assessment.id) ? 'completed' : 'not_started',
        })),
    };
};

exports.getWeeklySprintProgress = async (userId) => {
    const assessments = await prisma.assessments.findMany({
        where: {
            type: 'weekly',
            content_releases: {
                is: {
                    release_type: 'weekly',
                    status: 'published',
                },
            },
        },
        select: {
            id: true,
            course_id: true,
            release_id: true,
        },
    });

    const assessmentById = new Map();
    const releasesByCourse = new Map();
    for (const assessment of assessments) {
        if (!assessment.release_id) continue;

        assessmentById.set(assessment.id, {
            courseId: assessment.course_id,
            releaseId: assessment.release_id,
        });
        if (!releasesByCourse.has(assessment.course_id)) {
            releasesByCourse.set(assessment.course_id, new Set());
        }
        releasesByCourse.get(assessment.course_id).add(assessment.release_id);
    }

    const completedReleasesByCourse = new Map();
    if (userId && assessmentById.size) {
        const attempts = await prisma.attempts.findMany({
            where: {
                user_id: userId,
                assessment_id: { in: [...assessmentById.keys()] },
                submitted_at: { not: null },
            },
            select: { assessment_id: true },
        });

        for (const attempt of attempts) {
            const assessment = assessmentById.get(attempt.assessment_id);
            if (!assessment) continue;

            if (!completedReleasesByCourse.has(assessment.courseId)) {
                completedReleasesByCourse.set(assessment.courseId, new Set());
            }
            completedReleasesByCourse.get(assessment.courseId).add(assessment.releaseId);
        }
    }

    return [...releasesByCourse.entries()].map(([courseId, releaseIds]) => ({
        courseId,
        totalSprints: releaseIds.size,
        completedSprints: completedReleasesByCourse.get(courseId)?.size || 0,
    }));
};



exports.getWeeklySprint = async (releaseId) => {
    const assessments = await prisma.assessments.findMany({
        where: {
            release_id: releaseId,
            type: 'weekly',
            content_releases: {
                is: {
                    release_type: 'weekly',
                    status: 'published',
                },
            },
        },
        orderBy: { created_at: 'asc' },
        select: {
            id: true,
            title: true,
            courses: {
                select: {
                    id: true,
                    display_name: true,
                },
            },
            content_releases: {
                select: {
                    id:true,
                    week_number: true,
                    publish_at: true,
                },
            },
            assessment_items: {
                select: {
                    section: true,
                    questions: {
                        select: { marks: true },
                    },
                },
            },
        },
    });

    return assessments.map((assessment) => ({
        id: assessment.id,
        courseId: assessment.courses.id,
        releaseId:assessment.content_releases.id,
        courseName: assessment.courses.display_name,
        weekNumber: assessment.content_releases?.week_number ?? null,
        weekday: 'Monday',
        title: assessment.title || '',
        status: 'not_started',
        bestScore: null,
        maxScore: assessment.assessment_items.reduce(
            (total, item) => total + Number(item.questions.marks),
            0
        ),
        mcqCount: assessment.assessment_items.filter((item) => item.section === 'mcq').length,
        subjectiveCount: assessment.assessment_items.filter((item) => item.section === 'subjective').length,
        publishedAt: assessment.content_releases?.publish_at ?? null,
    }));
};

exports.getAllWeekly=async ()=>
   prisma.content_releases.findMany({
       where:{release_type:'weekly'},
       select:{
        id:true,
        week_number:true,
        status:true,
        publish_at:true
       }
   });
exports.getNoteByReleaseAndCourseId = async (releaseId, courseId) => {
    const note = await prisma.revision_notes.findFirst({
        where: {
            release_id: releaseId,
            course_id: courseId,
            approval_status: 'approved',
        },
        select: {
            markdown: true,
            content_releases: {
                select: {
                    week_number: true,
                },
            },
        },
    });

    if (!note) return null;

    return {
        markdown: note.markdown || '',
        readTime: '15 min',
        weekNumber: note.content_releases?.week_number ?? null,
    };
};
exports.getWeeklySprintByAssessmentId = async (assessmentId) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assessmentId)) {
        return null;
    }

    const assessment = await prisma.assessments.findUnique({
        where: { id: assessmentId },
        select: {
            id: true,
            title: true,
            type: true,
            courses: {
                select: {
                    id: true,
                    display_name: true,
                },
            },
            content_releases: {
                select: {
                    release_type: true,
                    status: true,
                    status: true,
                    week_number: true,
                    publish_at: true,
                },
            },
        },
    });

    if (
        !assessment ||
        assessment.type !== 'weekly' ||
        assessment.content_releases?.release_type !== 'weekly' ||
        assessment.content_releases.status !== 'published'
    ) {
        return null;
    }

    return {
        id: assessment.id,
        courseId: assessment.courses.id,
        courseName: assessment.courses.display_name,
        weekNumber: assessment.content_releases.week_number,
        weekday: 'Monday',
        title: assessment.title || '',
        status: 'not_started',
        bestScore: null,
        maxScore: 40,
        publishedAt: assessment.content_releases.publish_at,
    };
};

exports.getMonthlyAssessments = async () => {
    const assessments = await prisma.assessments.findMany({
        where: {
            type: 'monthly',
            content_releases: {
                is: {
                    release_type: 'monthly',
                    status: 'published',
                },
            },
        },
        select: {
            id: true,
            title: true,
            course_id: true,
            created_at: true,
            courses: {
                select: {
                    id: true,
                    code: true,
                    display_name: true,
                },
            },
            assessment_blueprints: {
                select: {
                    duration_minutes: true,
                    scoring_policy: true,
                    section_configuration: true,
                },
            },
            content_releases: {
                select: {
                    release_type: true,
                    status: true,
                    month_number: true,
                    version: true,
                    publish_at: true,
                    created_at: true,
                },
            },
            assessment_items: {
                orderBy: { item_order: 'asc' },
                select: {
                    section: true,
                    passage_id: true,
                    questions: {
                        select: {
                            marks: true,
                            response_format: true,
                        },
                    },
                },
            },
        },
    });

    return assessments.map((monthlyAssessment) => {
        const release = monthlyAssessment.content_releases;
        const blueprint = monthlyAssessment.assessment_blueprints;
        const sectionConfiguration = blueprint.section_configuration || {};
        const scoringPolicy = blueprint.scoring_policy || {};
        const items = monthlyAssessment.assessment_items;
        const partAMcqs = items.filter(
            (item) => item.passage_id && item.questions.response_format !== 'subjective'
        );
        const passageIds = new Set(partAMcqs.map((item) => item.passage_id));
        const subjectiveItems = items.filter(
            (item) => item.questions.response_format === 'subjective'
        );
        const partBCount = Number(sectionConfiguration.part_b_count) || 0;
        const partCCount = Number(sectionConfiguration.part_c_count) || 0;
        const partBItems = subjectiveItems.slice(0, partBCount);
        const partCItems = subjectiveItems.slice(partBCount, partBCount + partCCount);
        const sectionMarks = (sectionItems) =>
            sectionItems.reduce((total, item) => total + Number(item.questions.marks), 0);
        const configuredTotal = Number(sectionConfiguration.max_score);
        const calculatedTotal = sectionMarks(items);

        return {
            id: monthlyAssessment.id,
            _id: monthlyAssessment.id,
            courseId: monthlyAssessment.courses.code,
            courseName: monthlyAssessment.courses.display_name,
            month: release.month_number,
            title: monthlyAssessment.title || '',
            duration: blueprint.duration_minutes,
            totalMarks: Number.isFinite(configuredTotal) ? configuredTotal : calculatedTotal,
            status: release.status === 'published' ? 'available' : 'not_released',
            sections: {
                partA: {
                    passages: passageIds.size,
                    mcqsPerPassage: Number(sectionConfiguration.mcqs_per_passage) || 0,
                    marksPerMcq: Number(scoringPolicy.mcq_correct) || 0,
                    total: sectionMarks(partAMcqs),
                },
                partB: {
                    questions: partBCount,
                    marksPerQuestion: partBItems.length
                        ? Number(partBItems[0].questions.marks)
                        : 0,
                    total: sectionMarks(partBItems),
                },
                partC: {
                    questions: partCCount,
                    marksPerQuestion: partCItems.length
                        ? Number(partCItems[0].questions.marks)
                        : 0,
                    total: sectionMarks(partCItems),
                },
            },
            bestScore: null,
            attempts: 0,
            publishedAt: release.publish_at,
        };
    });
};

exports.getMonthlySimulationByAssessmentId = async (assessmentId) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assessmentId)) {
        return null;
    }

    const assessment = await prisma.assessments.findFirst({
        where: {
            id: assessmentId,
            type: 'monthly',
            status: 'approved',
            content_releases: {
                is: {
                    release_type: 'monthly',
                    status: 'published',
                },
            },
        },
        select: {
            id: true,
            title: true,
            assessment_blueprints: {
                select: {
                    duration_minutes: true,
                    section_configuration: true,
                },
            },
            courses: {
                select: {
                    display_name: true,
                },
            },
            assessment_items: {
                orderBy: { item_order: 'asc' },
                select: {
                    section: true,
                    item_order: true,
                    passage_id: true,
                    passages: {
                        select: {
                            stable_id: true,
                            passage_text: true,
                        },
                    },
                    questions: {
                        select: {
                            id: true,
                            question_number: true,
                            response_format: true,
                            prompt_markdown: true,
                            options: true,
                            marks: true,
                        },
                    },
                },
            },
        },
    });

    if (!assessment) return null;

    const passages = new Map();
    const subjectiveItems = [];
    let questionNumber = 0;
    for (const item of assessment.assessment_items) {
        const question = item.questions;
        if (item.section === 'mcq' && question.response_format !== 'subjective') {
            const passageKey = item.passage_id || 'unlinked';
            if (!passages.has(passageKey)) {
                const number = passages.size + 1;
                passages.set(passageKey, {
                    id: passageKey === 'unlinked' ? `passage_${number}` : passageKey,
                    number,
                    title: item.passages?.stable_id || `Passage ${number}`,
                    text: item.passages?.passage_text || '',
                    isPlaceholder: false,
                    questions: [],
                });
            }

            questionNumber += 1;
            passages.get(passageKey).questions.push({
                id: question.id,
                number: question.question_number || questionNumber,
                prompt: question.prompt_markdown,
                options: Array.isArray(question.options)
                    ? question.options.map((option) => ({
                        id: String(option.id),
                        text: String(option.text),
                    }))
                    : [],
            });
        } else if (item.section === 'subjective' || question.response_format === 'subjective') {
            subjectiveItems.push(item);
        }
    }

    const sectionConfiguration =
        assessment.assessment_blueprints.section_configuration || {};
    const configuredPartBCount = Number(sectionConfiguration.part_b_count);
    const partBCount = Number.isFinite(configuredPartBCount) && configuredPartBCount >= 0
        ? configuredPartBCount
        : Math.ceil(subjectiveItems.length / 2);
    const toWrittenQuestion = (item, index, sectionLabel) => ({
        id: item.questions.id,
        number: item.questions.question_number || index + 1,
        label: `${sectionLabel}${index + 1}`,
        prompt: item.questions.prompt_markdown,
        marks: Number(item.questions.marks),
    });
    const partB = subjectiveItems.slice(0, partBCount)
        .map((item, index) => toWrittenQuestion(item, index, 'B'));
    const partC = subjectiveItems.slice(partBCount)
        .map((item, index) => toWrittenQuestion(item, index, 'C'));

    const totalMarks = assessment.assessment_items.reduce(
        (total, item) => total + Number(item.questions.marks),
        0
    );

    return {
        id: assessment.id,
        title: assessment.title || 'Monthly Assessment',
        courseName: assessment.courses.display_name,
        durationMinutes: assessment.assessment_blueprints.duration_minutes,
        totalMarks,
        partA: [...passages.values()],
        partB,
        partC,
        limits: { subjectiveMaxChars: 4000, assumptionsMaxChars: 500 },
    };
};

exports.getExamPatternRule = async (ruleKey) =>
    prisma.exam_pattern_rules.findFirst({
        where: { rule_key: ruleKey },
        orderBy: { version: 'desc' },
        select: {
            rule_key: true,
            rule_value: true,
            source: true,
            confidence: true,
            effective_cohort: true,
            version: true,
        },
    });