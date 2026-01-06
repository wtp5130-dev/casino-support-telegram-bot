import { sql, nowIso } from '../db.js';

export async function insertKBChunk(source: string, chunk_index: number, text: string, embedding: number[]) {
  const created_at = nowIso();
  const embedding_json = JSON.stringify(embedding);
  await sql`
    INSERT INTO kb_chunks(source, chunk_index, text, embedding_json, created_at)
    VALUES(${source}, ${chunk_index}, ${text}, ${embedding_json}, ${created_at})
    ON CONFLICT (source, chunk_index)
    DO UPDATE SET text=EXCLUDED.text, embedding_json=EXCLUDED.embedding_json, created_at=EXCLUDED.created_at
  `;
}

export type KBChunk = {
  id: number;
  source: string;
  chunk_index: number;
  text: string;
  embedding_json: string;
};

export async function getAllKBChunks(): Promise<KBChunk[]> {
  const res = await sql`SELECT id, source, chunk_index, text, embedding_json FROM kb_chunks`;
  return (res || []) as any;
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

export async function searchKBByEmbedding(queryEmbedding: number[], topK = 5) {
  const rows = await getAllKBChunks();
  const scored = rows.map((r) => {
    const emb = JSON.parse(r.embedding_json) as number[];
    return { ...r, score: cosineSim(queryEmbedding, emb) };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

export async function countKBChunks(): Promise<number> {
  const res: any = await sql`SELECT COUNT(*)::int AS c FROM kb_chunks`;
  const first = Array.isArray(res) ? res[0] : undefined;
  return Number(first?.c || 0);
}
