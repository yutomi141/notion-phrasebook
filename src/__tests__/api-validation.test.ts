import { describe, it, expect } from 'vitest';

describe('API 入力検証（ユニット）', () => {
  const VALID_RESULTS = ['remembered', 'forgotten'] as const;

  it('remembered / forgotten のみ許可', () => {
    for (const r of VALID_RESULTS) {
      expect(VALID_RESULTS.includes(r)).toBe(true);
    }
    // 不正値
    expect(VALID_RESULTS.includes('correct' as never)).toBe(false);
    expect(VALID_RESULTS.includes('' as never)).toBe(false);
    expect(VALID_RESULTS.includes(null as never)).toBe(false);
  });

  it('必須フィールドが欠けていれば検証失敗', () => {
    function validate(payload: unknown): boolean {
      if (typeof payload !== 'object' || payload === null) return false;
      const p = payload as Record<string, unknown>;
      return (
        typeof p.itemId === 'string' &&
        p.itemId.length > 0 &&
        typeof p.sessionId === 'string' &&
        p.sessionId.length > 0 &&
        (p.result === 'remembered' || p.result === 'forgotten')
      );
    }

    expect(validate({ itemId: 'abc', sessionId: 's1', result: 'remembered' })).toBe(true);
    expect(validate({ itemId: 'abc', sessionId: 's1', result: 'forgotten' })).toBe(true);
    expect(validate({ itemId: '', sessionId: 's1', result: 'remembered' })).toBe(false);
    expect(validate({ itemId: 'abc', sessionId: 's1', result: 'correct' })).toBe(false);
    expect(validate({ itemId: 'abc', result: 'remembered' })).toBe(false);
    expect(validate(null)).toBe(false);
  });
});
