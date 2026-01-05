import { describe, it, expect } from 'vitest';
import { chunkText } from '../src/rag/chunk.js';

describe('chunkText', () => {
  it('chunks with overlap', () => {
    const text = 'a'.repeat(1700);
    const chunks = chunkText(text, 800, 100);
    expect(chunks.length).toBe(3);
    expect(chunks[0].text.length).toBe(800);
    expect(chunks[1].text.length).toBe(800);
    expect(chunks[2].text.length).toBe(100); // remainder after overlap
  });
});
