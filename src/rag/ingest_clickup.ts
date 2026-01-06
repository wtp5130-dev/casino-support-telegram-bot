import { initSchema } from '../db.js';
import { chunkText } from './chunk.js';
import { embedTexts } from './embed.js';
import { insertKBChunk } from './store.js';
import { fetchTasksFromList, fetchTaskComments } from '../integrations/clickup.js';

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && String(v).trim() !== '' ? String(v) : undefined;
}

function mdToText(md: string): string {
  // Minimal markdown to text: strip code fences and headings, keep content
  return (md || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\!\[[^\]]*\]\([^\)]*\)/g, '') // images
    .replace(/\[[^\]]*\]\([^\)]*\)/g, '$1') // links to text
    .replace(/[#*_>`~]/g, '')
    .replace(/\r?\n/g, '\n')
    .trim();
}

async function ingestList(token: string, listId: string) {
  const tasks = await fetchTasksFromList(token, listId);
  for (const t of tasks) {
    const comments = await fetchTaskComments(token, t.id).catch(() => []);
    const commentsText = comments
      .map((c) => `- ${c.user?.username || 'user'}: ${(c.comment || c.text || '').trim()}`)
      .filter(Boolean)
      .join('\n');

    const body = [
      `Title: ${t.name}`,
      `URL: ${t.url || `https://app.clickup.com/t/${t.id}`}`,
      '',
      mdToText(t.description || ''),
      '',
      commentsText ? `Recent Comments:\n${commentsText}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    if (!body || body.trim().length < 10) continue;

    const chunks = chunkText(body, 800, 100);
    const embeddings = await embedTexts(chunks.map((c) => c.text));
    for (let i = 0; i < chunks.length; i++) {
      await insertKBChunk(`clickup/${t.id}`, chunks[i].index, chunks[i].text, embeddings[i]);
    }
    // eslint-disable-next-line no-console
    console.log(`Ingested task ${t.id} (${t.name}) -> ${chunks.length} chunks`);
  }
}

async function main() {
  const token = env('CLICKUP_API_TOKEN');
  const listCsv = env('CLICKUP_LIST_IDS');
  if (!token || !listCsv) {
    throw new Error('Missing CLICKUP_API_TOKEN or CLICKUP_LIST_IDS env vars. Set them to ingest from ClickUp.');
  }

  await initSchema();

  const listIds = listCsv.split(',').map((s) => s.trim()).filter(Boolean);
  for (const listId of listIds) {
    await ingestList(token, listId);
  }
}

main().catch((err) => {
  console.error('ClickUp ingest error', err);
  process.exit(1);
});
