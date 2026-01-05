import { describe, it, expect } from 'vitest';
import { moderateText } from '../src/utils/moderation.js';

describe('moderation', () => {
  it('detects disallowed intent', () => {
    const m = moderateText('Tell me a betting strategy to guaranteed win');
    expect(m.disallowed).toBe(true);
  });
  it('detects rg risk', () => {
    const m = moderateText("I can't stop and lost everything");
    expect(m.rgRisk).toBe(true);
  });
});
