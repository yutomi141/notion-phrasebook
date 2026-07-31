import { describe, it, expect } from 'vitest';
import { validateReviewPayload } from '@/lib/validation/review-payload';

const BASE = {
  itemId: 'abc-123',
  sessionId: 'sess-456',
  result: 'remembered' as const,
  direction: 'EN_TO_JA' as const,
  reviewedAt: new Date().toISOString(),
};

describe('/api/study — phrase のみ許可', () => {
  it('phrase → 許可', () => {
    expect(validateReviewPayload({ ...BASE, itemType: 'phrase' }, 'phrase').ok).toBe(true);
  });

  it('sentence → 400', () => {
    const r = validateReviewPayload({ ...BASE, itemType: 'sentence' }, 'phrase');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/itemType/);
  });

  it('空白だけの itemId → 400', () => {
    expect(
      validateReviewPayload({ ...BASE, itemType: 'phrase', itemId: '   ' }, 'phrase').ok,
    ).toBe(false);
  });

  it('空白だけの sessionId → 400', () => {
    expect(
      validateReviewPayload({ ...BASE, itemType: 'phrase', sessionId: '\t' }, 'phrase').ok,
    ).toBe(false);
  });

  it('不正 result → 400', () => {
    expect(
      validateReviewPayload({ ...BASE, itemType: 'phrase', result: 'maybe' }, 'phrase').ok,
    ).toBe(false);
  });

  it('不正 direction → 400', () => {
    expect(
      validateReviewPayload({ ...BASE, itemType: 'phrase', direction: 'BOTH' }, 'phrase').ok,
    ).toBe(false);
  });

  it('forgotten も許可', () => {
    expect(
      validateReviewPayload({ ...BASE, itemType: 'phrase', result: 'forgotten' }, 'phrase').ok,
    ).toBe(true);
  });

  it('JA_TO_EN も許可', () => {
    expect(
      validateReviewPayload({ ...BASE, itemType: 'phrase', direction: 'JA_TO_EN' }, 'phrase').ok,
    ).toBe(true);
  });
});

describe('/api/sentence-study — sentence のみ許可', () => {
  it('sentence → 許可', () => {
    expect(validateReviewPayload({ ...BASE, itemType: 'sentence' }, 'sentence').ok).toBe(true);
  });

  it('phrase → 400', () => {
    const r = validateReviewPayload({ ...BASE, itemType: 'phrase' }, 'sentence');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/itemType/);
  });
});

describe('payload が欠損・不正な型', () => {
  it('null → 400', () => {
    expect(validateReviewPayload(null, 'phrase').ok).toBe(false);
  });

  it('空オブジェクト → 400', () => {
    expect(validateReviewPayload({}, 'phrase').ok).toBe(false);
  });
});

describe('sourceId の検証', () => {
  it('省略可（旧クライアント・旧オフラインキューとの後方互換）', () => {
    expect(validateReviewPayload({ ...BASE, itemType: 'phrase' }, 'phrase').ok).toBe(true);
    expect(
      validateReviewPayload({ ...BASE, itemType: 'phrase', sourceId: undefined }, 'phrase').ok,
    ).toBe(true);
  });

  it('文字列なら通す（実在するソースかは呼び出し元が解決する）', () => {
    for (const sourceId of ['phrase', 'reading-vocab']) {
      expect(
        validateReviewPayload({ ...BASE, itemType: 'phrase', sourceId }, 'phrase').ok,
      ).toBe(true);
    }
  });

  it('空文字・空白のみ → 400', () => {
    for (const sourceId of ['', '   ']) {
      const r = validateReviewPayload({ ...BASE, itemType: 'phrase', sourceId }, 'phrase');
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/sourceId/);
    }
  });

  it('文字列以外 → 400', () => {
    for (const sourceId of [123, {}, []]) {
      expect(
        validateReviewPayload({ ...BASE, itemType: 'phrase', sourceId }, 'phrase').ok,
      ).toBe(false);
    }
  });

  it('過剰に長い sourceId → 400', () => {
    expect(
      validateReviewPayload(
        { ...BASE, itemType: 'phrase', sourceId: 'x'.repeat(65) },
        'phrase',
      ).ok,
    ).toBe(false);
  });
});
