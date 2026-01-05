import OpenAI from 'openai';
import { config } from '../config.js';

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const resp = await openai.embeddings.create({
    model: config.OPENAI_EMBEDDING_MODEL,
    input: texts,
  });
  return resp.data.map((d) => d.embedding as unknown as number[]);
}

export async function embedText(text: string): Promise<number[]> {
  const [vec] = await embedTexts([text]);
  return vec;
}
