import { initSchema } from '../db.js';
import { insertKBChunk } from './store.js';
import { chunkText } from './chunk.js';
import { embedTexts } from './embed.js';
import { ingestDoc } from './ingest_clickup_api_docs.js';
import { getPageContentHtml } from '../integrations/clickup_docs.js';

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && String(v).trim() !== '' ? String(v) : undefined;
}

function parseDocAndPage(urlStr: string): { docId?: string; pageId?: string } {
  try {
    const u = new URL(urlStr);
    const parts = u.pathname.split('/').filter(Boolean);
    // Expect .../v/dc/{docId}/{pageId}
    const docId = parts[parts.length - 2];
    const pageId = parts[parts.length - 1];
    return { docId, pageId };
  } catch {
    return {};
  }
}

async function ingestSinglePage(token: string, pageId: string, docIdHint?: string) {
  const html = await getPageContentHtml(token, pageId);
  const text = html
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
  if (!text || text.length < 20) return;
  const src = `clickup_doc/${docIdHint || 'doc'}/${pageId}`;
  const chunks = chunkText(text, 800, 100);
  const embeddings = await embedTexts(chunks.map((c) => c.text));
  for (let i = 0; i < chunks.length; i++) {
    await insertKBChunk(src, chunks[i].index, chunks[i].text, embeddings[i]);
  }
  // eslint-disable-next-line no-console
  console.log(`Ingested page ${pageId} -> ${chunks.length} chunks`);
}

async function main() {
  const token = env('CLICKUP_API_TOKEN');
  const urlCsv = env('CLICKUP_DOC_URLS');
  if (!token) throw new Error('Missing CLICKUP_API_TOKEN');
  if (!urlCsv) throw new Error('Set CLICKUP_DOC_URLS with one or more ClickUp app URLs');

  await initSchema();

  const urls = urlCsv.split(',').map((s) => s.trim()).filter(Boolean);
  for (const url of urls) {
    const { docId } = parseDocAndPage(url);
    if (!docId) {
      throw new Error(`Could not parse doc id from URL: ${url}`);
    }
    // Always ingest the entire doc (all pages)
    await ingestDoc(token, docId);
  }
}

main().catch((err) => {
  console.error('ClickUp API URL ingest error', err);
  process.exit(1);
});
