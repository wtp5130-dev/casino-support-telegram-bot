import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import { chunkText } from './chunk.js';
import { embedTexts } from './embed.js';
import { insertKBChunk } from './store.js';

const KB_DIR = path.resolve('kb');

async function readTextFile(filePath: string) {
  return fs.promises.readFile(filePath, 'utf-8');
}

async function readPdfFile(filePath: string) {
  const data = await fs.promises.readFile(filePath);
  const pdf = await pdfParse(data);
  return pdf.text;
}

async function ingestFile(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  let text = '';
  if (ext === '.txt' || ext === '.md') {
    text = await readTextFile(filePath);
  } else if (ext === '.pdf') {
    text = await readPdfFile(filePath);
  } else {
    return; // skip unsupported
  }
  const rel = path.relative(KB_DIR, filePath).replace(/\\/g, '/');
  const chunks = chunkText(text, 800, 100);
  const embeddings = await embedTexts(chunks.map((c) => c.text));
  for (let i = 0; i < chunks.length; i++) {
    insertKBChunk(rel, chunks[i].index, chunks[i].text, embeddings[i]);
  }
  // eslint-disable-next-line no-console
  console.log(`Ingested ${rel} -> ${chunks.length} chunks`);
}

async function main() {
  if (!fs.existsSync(KB_DIR)) {
    throw new Error('kb folder not found');
  }
  const files = await fs.promises.readdir(KB_DIR);
  for (const f of files) {
    const p = path.join(KB_DIR, f);
    const stat = await fs.promises.stat(p);
    if (stat.isFile()) {
      await ingestFile(p);
    }
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Ingest error', err);
  process.exit(1);
});
