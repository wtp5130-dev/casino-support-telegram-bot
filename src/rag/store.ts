import { db, nowIso } from '../db.js';

export function insertKBChunk(source: string, chunk_index: number, text: string, embedding: number[]) {
  const created_at = nowIso();
  const embedding_json = JSON.stringify(embedding);
  db.prepare(`INSERT OR REPLACE INTO kb_chunks(source, chunk_index, text, embedding_json, created_at) VALUES(?,?,?,?,?)`)
    .run(source, chunk_index, text, embedding_json, created_at);
}

export type KBChunk = {
  id: number;
  source: string;
  chunk_index: number;
  text: string;
  embedding_json: string;
};

export function getAllKBChunks(): KBChunk[] {
  return db.prepare(`SELECT * FROM kb_chunks`).all() as KBChunk[];
}

export function cosineSim(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

export function searchKBByEmbedding(queryEmbedding: number[], topK = 5) {
  const rows = db.prepare(`SELECT id, source, chunk_index, text, embedding_json FROM kb_chunks`).all() as KBChunk[];
  const scored = rows.map((r) => {
    const emb = JSON.parse(r.embedding_json) as number[];
    return { ...r, score: cosineSim(queryEmbedding, emb) };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
