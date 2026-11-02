'use strict';

const { GoogleGenAI } = require('@google/genai');
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const { PROMPT_VERSION, buildPrompt } = require('./geminiPrompt');
const apiKey = process.env.GEMINI_API_KEY;
const modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

if (!apiKey) {
  throw new Error(
    'GEMINI_API_KEY is not set. Add it to your .env file.'
  );
}

const ai = new GoogleGenAI({ apiKey });

// Calls Gemini to evaluate a subjective answer and returns validated marks and feedback
async function evaluateSubjectiveAnswer(question) {
  const prompt = buildPrompt(question);
  const startedAt = Date.now();

  let rawText;
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
    });
    rawText = response.text;
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    throw Object.assign(
      new Error(`Gemini API call failed: ${err.message}`),
      { code: 'GEMINI_API_ERROR', latencyMs }
    );
  }

  const latencyMs = Date.now() - startedAt;

  let parsed;
  try {
    const cleaned = rawText.trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
    parsed = JSON.parse(cleaned);
  } catch {
    throw Object.assign(
      new Error('Gemini returned a response that is not valid JSON.'),
      { code: 'GEMINI_INVALID_JSON', rawText, latencyMs }
    );
  }

  const awarded = Number(parsed.awarded_marks);
  const max = Number(question.maxMarks);

  if (!Number.isFinite(awarded) || awarded < 0 ) {
    throw Object.assign(
      new Error('Gemini returned an invalid awarded_marks value.'),
      { code: 'GEMINI_INVALID_SCORE', rawText, latencyMs }
    );
  }
const safeMark = Math.min(Math.max(awarded, 0), max);
  return {
    awardedMarks: safeMark,
    maxMarks: max,
    feedback: typeof parsed.feedback === 'string' ? parsed.feedback.slice(0, 2000) : '',
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 20) : [],
    missingPoints: Array.isArray(parsed.missing_points) ? parsed.missing_points.slice(0, 20) : [],
    incorrectPoints: Array.isArray(parsed.incorrect_points) ? parsed.incorrect_points.slice(0, 20) : [],
    criterionMarks: Array.isArray(parsed.criterion_marks) ? parsed.criterion_marks : [],
    requiresHumanReview: parsed.requires_human_review === true,
    modelVersion: modelName,
    promptVersion: PROMPT_VERSION,
    latencyMs,
    rawText,
  };
}

module.exports = { evaluateSubjectiveAnswer };