'use strict';

const prisma=require('../config/db');
const { evaluateSubjectiveAnswer } = require('./geminiService');

const BATCH_SIZE=5;
const WORKER_INTERVAL_MS = 30000;

// Loads full question rubric, marks, and student answer needed for Gemini evaluation
async function  loadEvaluationData(evalId){
    const evaluation=await prisma.evaluations.findUnique({
        where:{id:evalId},
        select:{
            id:true,
            attempt_id:true,
            responses:{
                select:{
                    id:true,
                    subjective_answer:true,
                    assumptions:true,
                    assessment_items:{
                        select:{
                            questions:{
                                select:{
                                    prompt_markdown:true,
                                    marks:true,
                                    rubric:true,
                                    expected_answer_points:true,
                                    assumptions_policy:true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });
    if(!evaluation)return null;
    const response=evaluation.responses;
    const question=response.assessment_items.questions;
    return{
        evaluationId:evaluation.id,
        attemptId:evaluation.attempt_id,
        promptMarkdown:question.prompt_markdown,
        maxMarks: Number(question.marks),
    rubric: Array.isArray(question.rubric) ? question.rubric : [],
    expected_answer_points: Array.isArray(question.expected_answer_points)
      ? question.expected_answer_points
      : [],
    assumptions_policy: question.assumptions_policy,
    studentAnswer: response.subjective_answer || '',
    assumptions: response.assumptions || '',
  };
    
}

// Claims and processes a single pending subjective evaluation using Gemini
async function processEvaluation(evaluationId) {
    const claim=await prisma.evaluations.updateMany({
        where:{
            id:evaluationId,
            state:'pending',
        },
        data:{
            state:'processing',
            updated_at:new Date(),
        }
    });

    if(claim.count!==1){
        return;
    }
    const data=await loadEvaluationData(evaluationId);
    if(!data)return;
    try{
        const result=await evaluateSubjectiveAnswer(data);

        await prisma.evaluations.update({
            where:{
                id:evaluationId,
            },
            data:{
                 state: result.requiresHumanReview ? 'manual_review' : 'completed',
        score: result.awardedMarks,
        rubric_breakdown: result.criterionMarks,
        feedback: {
          summary: result.feedback,
          strengths: result.strengths,
          missingPoints: result.missingPoints,
          incorrectPoints: result.incorrectPoints,
        },
        model_version: result.modelVersion,
        prompt_version: result.promptVersion,
        latency_ms: result.latencyMs,
        completed_at: new Date(),
        updated_at: new Date(),
             },
        });
    }catch(err){
     console.error('Subjective answer evaluation failed:', err);
     await prisma.evaluations.update({
      where: { id: evaluationId },
      data: {
        state: 'failed',
        error_message: 'Evaluation could not be completed. Please contact support.',
        updated_at: new Date(),
          },
      });
    }
    await maybeMarkAttemptEvaluated(data.attemptId);
}

// Updates attempt state to 'evaluated' once all pending/processing evaluations complete
async function maybeMarkAttemptEvaluated(attemptId) {
  const remaining = await prisma.evaluations.count({
    where: {
      attempt_id: attemptId,
      state: { in: ['pending', 'processing'] },
    },
  });

  if (remaining === 0) {
    await prisma.attempts.updateMany({
      where: {
        id: attemptId,
        state: { in: ['evaluation_pending', 'expired'] },
      },
      data: {
        state: 'evaluated'
      },
    });
  }
}

// Fetches and processes the next batch of oldest pending subjective evaluations
async function processNextBatch() {
  const pending = await prisma.evaluations.findMany({
    where: { state: 'pending' },
    orderBy: { created_at: 'asc' },   // oldest first — fair queue
    take: BATCH_SIZE,
    select: { id: true },
  });

  const outcomes = await Promise.allSettled(
    pending.map((evaluation) => processEvaluation(evaluation.id))
  );
  const failures = outcomes
    .filter((outcome) => outcome.status === 'rejected')
    .map((outcome) => outcome.reason);
  if (failures.length) {
    throw new AggregateError(failures, 'One or more subjective evaluations could not be processed.');
  }
}

// Starts the background evaluation loop running periodically to process pending answers
function startEvaluationWorker({ intervalMs = WORKER_INTERVAL_MS, onError = console.error } = {}) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await processNextBatch();
    } catch (err) {
      onError('Evaluation worker failed:', err);
    } finally {
      running = false;
    }
  };
  const interval = setInterval(tick, intervalMs);
  interval.unref();
  tick();
  return () => clearInterval(interval);
}

module.exports = { startEvaluationWorker };