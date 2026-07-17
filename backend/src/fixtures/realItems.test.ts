import { describe, expect, it } from 'vitest';
import { ClipboardItemParser } from '../normalizedItemParser.js';
import { realItemFixtures } from './realItems.js';
describe('real item fixture corpus', () => {
  it('keeps a broad regression corpus parseable', () => {
    expect(realItemFixtures.length).toBeGreaterThanOrEqual(12);
    for (const [, text] of realItemFixtures) {
      const item = new ClipboardItemParser().parseClipboard(text);
      expect(item.itemClass).not.toBe('');
      expect(item.baseType).not.toBe('');
    }
  });
  it('preserves unknown modifiers as unknown', () => {
    const item = new ClipboardItemParser().parseClipboard(realItemFixtures.find((x) => x[0] === 'unknown-mod')![1]);
    expect(item.unknownModifiers.some((x) => x.text.includes('mysterious'))).toBe(true);
  });
});
