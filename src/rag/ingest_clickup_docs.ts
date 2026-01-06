import { initSchema } from '../db.js';
import { chunkText } from './chunk.js';
import { embedTexts } from './embed.js';
import { insertKBChunk } from './store.js';
import fetch from 'node-fetch';

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && String(v).trim() !== '' ? String(v) : undefined;
}

function stripHtml(html: string): string {
  return (html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>(?=\n)/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<li>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\r?\n\s*\r?\n\s*/g, '\n\n')
    .trim();
}

function inferDocIdFromUrl(url: string): string {
  try {
    const u = new URL(url);
    // Example: https://app.clickup.com/90181299888/v/dc/2kzkjvng-35718/2kzkjvng-11078
    const parts = u.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1] || '';
    return last; // use trailing segment as identifier
  } catch {
    return url.replace(/[^a-zA-Z0-9_-]/g, '').slice(-50);
  }
}

async function ingestFromPublicUrl(url: string) {
  const resp = await fetch(url, { redirect: 'follow' as any });
  if (!resp.ok) throw new Error(`Fetch doc failed: ${resp.status}`);
  const html = await resp.text();
  const text = stripHtml(html);
  const id = inferDocIdFromUrl(url);
  const baseSource = `clickup_doc/${id}`;
  const chunks = chunkText(text, 800, 100);
  const embeddings = await embedTexts(chunks.map((c) => c.text));
  for (let i = 0; i < chunks.length; i++) {
    await insertKBChunk(baseSource, chunks[i].index, chunks[i].text, embeddings[i]);
  }
  // eslint-disable-next-line no-console
  console.log(`Ingested ClickUp Doc ${url} -> ${chunks.length} chunks`);
}

async function main() {
  const shareCsv = env('CLICKUP_DOC_SHARE_URLS');
  if (!shareCsv) {
    throw new Error('Set CLICKUP_DOC_SHARE_URLS (comma-separated public doc URLs) to ingest ClickUp Docs.');
  }
  await initSchema();
  const urls = shareCsv.split(',').map((s) => s.trim()).filter(Boolean);
  for (const url of urls) {
    await ingestFromPublicUrl(url);
  }
}

main().catch((err) => {
  console.error('ClickUp Docs ingest error', err);
  process.exit(1);
});
