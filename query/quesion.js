const prisma = require('../config/db');

const getQuestionsBySection = (sprintId, section) =>
    prisma.assessments.findUnique({
        where: { id: sprintId },
        select: {
            id: true,
            title: true,
            assessment_items: {
                where: { section },
                orderBy: { item_order: 'asc' },
                select: {
                    section: true,
                    item_order: true,
                    compulsory: true,
                    questions: {
                        select: {
                            id: true,
                            question_number: true,
                            prompt_markdown: true,
                            options: true,
                            stem_form: true,
                            learner_badge: true,
                            marks: true,
                        },
                    },
                },
            },
        },
    });

exports.getMcqQuestionBySprintId = (sprintId) =>
    getQuestionsBySection(sprintId, 'mcq');

exports.getSubQuestionBySprintId = (sprintId) =>
    getQuestionsBySection(sprintId, 'subjective');