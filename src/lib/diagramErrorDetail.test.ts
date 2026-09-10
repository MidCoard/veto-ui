import { describe, expect, it } from 'vitest';
import { diagramErrorDetail } from './diagramErrorDetail';

describe('diagram diagnostics', () => {
  it('preserves multiline parser messages without including the stack', () => {
    const message = 'Parse error on line 2:\nA -->\n     ^';
    expect(diagramErrorDetail(new Error(message))).toBe(message);
    expect(diagramErrorDetail({ message })).toBe(message);
    expect(diagramErrorDetail(message)).toBe(message);
  });

  it('ignores missing diagnostics and bounds long messages', () => {
    for (const value of [null, undefined, {}, { message: 1 }, '   ']) {
      expect(diagramErrorDetail(value)).toBeUndefined();
    }
    expect(diagramErrorDetail('x'.repeat(9000))).toBe(`${'x'.repeat(8192)}\n…`);
  });
});
