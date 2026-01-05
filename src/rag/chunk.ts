export function chunkText(text: string, chunkSize = 800, overlap = 100) {
  const chunks: { text: string; index: number }[] = [];
  const clean = text.replace(/\s+/g, ' ').trim();
  let i = 0;
  let idx = 0;
  while (i < clean.length) {
    const end = Math.min(i + chunkSize, clean.length);
    const chunk = clean.slice(i, end);
    chunks.push({ text: chunk, index: idx });
    idx += 1;
    if (end === clean.length) break;
    i = end - overlap;
    if (i < 0) i = 0;
  }
  return chunks;
}
