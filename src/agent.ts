import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error('GEMINI_API_KEY is not set in the environment.');
}

const ai = new GoogleGenAI({ apiKey });
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

export async function generateReply(emailBody: string): Promise<string> {
  const prompt = `You are a professional assistant. Draft a polite and clear reply to this email:\n\n${emailBody}`;
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      temperature: 0.7,
    },
  });

  return response.text?.trim() || '';
}

export async function generateSummary(emailBody: string): Promise<string> {
  const prompt = `Summarize this email in one short sentence of 50 words or less:\n\n${emailBody}`;
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      temperature: 0.3,
    },
  });

  return response.text?.trim() || '';
}
