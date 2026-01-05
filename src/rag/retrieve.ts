import { embedText } from './embed.js';
import { searchKBByEmbedding } from './store.js';

export async function retrieveTopK(query: string, k = 5) {
  const qEmb = await embedText(query);
  const hits = searchKBByEmbedding(qEmb, k);
  return hits.map((h) => ({
    source: h.source,
    chunk_index: h.chunk_index,
    text: h.text,
    score: h.score,
  }));
}
