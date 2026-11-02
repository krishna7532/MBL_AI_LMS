require('dotenv').config();
const { evaluateSubjectiveAnswer } = require('../services/geminiService');

async function test() {
  const result = await evaluateSubjectiveAnswer({
    promptMarkdown: 'Define consideration in contract law and explain its essential elements.',
    maxMarks: 10,
    expected_answer_points: [
      'Consideration must be sufficient but need not be adequate',
      'Past consideration is no consideration',
      'Consideration must move from the promisee',
    ],
    rubric: [
      { criterion: 'Definition', max_marks: 3, description: 'Accurate definition of consideration' },
      { criterion: 'Essential elements', max_marks: 4, description: 'Three elements correctly identified' },
      { criterion: 'Case law', max_marks: 3, description: 'At least one relevant case cited' },
    ],
    assumptions_policy: null,
    studentAnswer: 'Consideration is something of value exchanged between parties. It must be real and not past. The promisor must receive something in return. In Currie v Misa, consideration was defined as a right, interest, profit or benefit.',
    assumptions: '',
  });

  console.log('Awarded marks:', result.awardedMarks, '/', result.maxMarks);
  console.log('Feedback:', result.feedback);
  console.log('Strengths:', result.strengths);
  console.log('Missing:', result.missingPoints);
  console.log('Latency:', result.latencyMs, 'ms');
}

test().catch(console.error);