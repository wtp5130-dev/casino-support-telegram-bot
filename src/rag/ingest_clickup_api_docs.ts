import { initSchema } from '../db.js';
import { chunkText } from './chunk.js';
import { embedTexts } from './embed.js';
import { insertKBChunk } from './store.js';
import { listWorkspaceDocs, listDocPages, getPageContentHtml } from '../integrations/clickup_docs.js';

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

async function ingestDoc(token: string, docId: string) {
  const pages = await listDocPages(token, docId);
  for (const p of pages) {
    try {
      const html = await getPageContentHtml(token, p.id);
      const text = stripHtml(html);
      if (!text || text.length < 20) continue;
      const chunks = chunkText(text, 800, 100);
      const embeddings = await embedTexts(chunks.map((c) => c.text));
      for (let i = 0; i < chunks.length; i++) {
        await insertKBChunk(`clickup_doc/${docId}/${p.id}`, chunks[i].index, chunks[i].text, embeddings[i]);
      }
      // eslint-disable-next-line no-console
      console.log(`Ingested doc ${docId} page ${p.id} (${p.name || ''}) -> ${chunks.length} chunks`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`Skip page ${p.id}: ${(e as any)?.message || e}`);
    }
  }
}

async function main() {
  const token = env('CLICKUP_API_TOKEN');
  const workspaceId = env('CLICKUP_WORKSPACE_ID');
  const docIdsCsv = env('CLICKUP_DOC_IDS');
  if (!token) throw new Error('Missing CLICKUP_API_TOKEN');
  if (!workspaceId && !docIdsCsv) throw new Error('Set CLICKUP_WORKSPACE_ID or CLICKUP_DOC_IDS');

  await initSchema();

  if (docIdsCsv) {
    const ids = docIdsCsv.split(',').map((s) => s.trim()).filter(Boolean);
    for (const id of ids) await ingestDoc(token, id);
    return;
  }

  const docs = await listWorkspaceDocs(token, workspaceId!);
  for (const d of docs) {
    await ingestDoc(token, d.id);
  }
}

main().catch((err) => {
  console.error('ClickUp API Docs ingest error', err);
  process.exit(1);
});
