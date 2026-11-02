const prisma = require('../config/db');

// Fetches assessment items and questions for a specific section (e.g. 'mcq' or 'subjective')
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
                    id: true,
                    section: true,
                    item_order: true,
                    compulsory: true,
                    questions: {
                        select: {
                            id: true,
                            question_number: true,
                            prompt_markdown: true,
                            options: true,
                            response_format: true,
                            stem_form: true,
                            learner_badge: true,
                            marks: true,
                        },
                    },
                },
            },
        },
    });

// Loads the MCQ questions linked to a weekly sprint.
exports.getMcqQuestionBySprintId = (sprintId) =>
    getQuestionsBySection(sprintId, 'mcq');

// Loads the subjective questions linked to a weekly sprint.
exports.getSubQuestionBySprintId = (sprintId) =>
    getQuestionsBySection(sprintId, 'subjective');
