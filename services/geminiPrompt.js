'use strict';

const PROMPT_VERSION = '1';

// Builds the examiner prompt with question text, marks, rubric, and student answer.
function buildPrompt(question) {
  const rubricText = Array.isArray(question.rubric) && question.rubric.length > 0
    ? question.rubric.map((criterion, index) =>
      `${index + 1}.${criterion.criterion}(${criterion.max_marks}):${criterion.description || ''}`
    ).join('\n')
    : 'No specfic rubric.Use your professional judgment';

  const expectedPoints = Array.isArray(question.expected_answer_points) &&
    question.expected_answer_points.length > 0
    ? question.expected_answer_points.map((point, index) => `  ${index + 1}. ${point}`).join('\n')
    : '  No model answer provided. Evaluate based on legal accuracy and reasoning quality.';

  const assumptionsSection = question.assumptions
    ? `\nSTUDENT ASSUMPTIONS:\n${question.assumptions}\n`
    : '';

  return `You are an experienced law examiner evaluating a student's written answer for a Master of Business Laws (MBL) examination.
QUESTION:
${question.promptMarkdown}
MAXIMUM MARKS: ${question.maxMarks}
EXPECTED ANSWER POINTS:
${expectedPoints}
MARKING RUBRIC:
${rubricText}
STUDENT'S ANSWER:
${question.studentAnswer}
${assumptionsSection}
EVALUATION INSTRUCTIONS:
1. Award marks fairly and strictly according to the rubric.
2. If the student's answer conveys a correct idea using different words or a valid alternative legal interpretation, award marks — do not penalise for paraphrasing.
3. If the student made a reasonable assumption that changes the scope of their answer, consider it before deducting marks.
4. Marks awarded (awarded_marks) must be between 0 and ${question.maxMarks} inclusive. Never exceed maximum marks.
5. Be specific in your feedback — mention exact legal principles, cases, or statutes that were present or absent.
6. Set requires_human_review to true if: the answer is ambiguous, the rubric is insufficient to evaluate it, or your confidence is low.
Respond with ONLY a valid JSON object. No explanation, no markdown, no code fences. The JSON must have exactly these fields:
{
  "awarded_marks": <number between 0 and ${question.maxMarks}>,
  "max_marks": ${question.maxMarks},
  "feedback": "<one paragraph summary of the evaluation>",
  "strengths": ["<point 1>", "<point 2>"],
  "missing_points": ["<point 1>", "<point 2>"],
  "incorrect_points": ["<point 1>"],
  "criterion_marks": [
    { "criterion": "<name>", "awarded": <number>, "max": <number> }
  ],
  "requires_human_review": <true or false>
}`;
}

function getPromptTemplate() {
  return buildPrompt({
    promptMarkdown: '[Question text]',
    maxMarks: '[Maximum marks]',
    expected_answer_points: ['[Expected answer point]'],
    rubric: [{
      criterion: '[Criterion]',
      max_marks: '[Criterion maximum marks]',
      description: '[Criterion description]',
    }],
    studentAnswer: '[Student answer]',
    assumptions: '[Student assumptions, if provided]',
  });
}

module.exports = { PROMPT_VERSION, buildPrompt, getPromptTemplate };
