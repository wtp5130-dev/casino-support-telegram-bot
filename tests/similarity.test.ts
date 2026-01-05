import { describe, it, expect } from 'vitest';
import { cosineSim } from '../src/rag/store.js';

describe('cosineSim', () => {
  it('is high for similar vectors', () => {
    const a = [1, 2, 3];
    const b = [1, 2, 3];
    expect(cosineSim(a, b)).toBeGreaterThan(0.99);
  });
  it('is low for orthogonal-ish vectors', () => {
    const a = [1, 0];
    const b = [0, 1];
    expect(cosineSim(a, b)).toBeLessThan(0.2);
  });
});
