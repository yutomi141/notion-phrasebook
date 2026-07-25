import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveReviewedAt } from '@/lib/validation/reviewed-at';

const NOW = new Date('2026-07-25T12:00:00.000Z');

afterEach(() => vi.useRealTimers());

describe('resolveReviewedAt', () => {
  it('有効な過去の時刻はそのまま使用する', () => {
    vi.setSystemTime(NOW);
    const valid = '2026-07-25T10:00:00.000Z';
    expect(resolveReviewedAt(valid)).toBe(valid);
  });

  it('未来の時刻はサーバー時刻にフォールバック', () => {
    vi.setSystemTime(NOW);
    const future = '2026-07-26T00:00:00.000Z';
    expect(resolveReviewedAt(future)).toBe(NOW.toISOString());
  });

  it('30日超過去はサーバー時刻にフォールバック', () => {
    vi.setSystemTime(NOW);
    const tooOld = '2026-06-20T00:00:00.000Z'; // 35日前
    expect(resolveReviewedAt(tooOld)).toBe(NOW.toISOString());
  });

  it('不正形式はサーバー時刻にフォールバック', () => {
    vi.setSystemTime(NOW);
    expect(resolveReviewedAt('not-a-date')).toBe(NOW.toISOString());
  });

  it('null/undefined はサーバー時刻にフォールバック', () => {
    vi.setSystemTime(NOW);
    expect(resolveReviewedAt(null)).toBe(NOW.toISOString());
    expect(resolveReviewedAt(undefined)).toBe(NOW.toISOString());
  });

  it('ちょうど30日前は有効', () => {
    vi.setSystemTime(NOW);
    const exactly30DaysAgo = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000 + 1000).toISOString();
    expect(resolveReviewedAt(exactly30DaysAgo)).toBe(exactly30DaysAgo);
  });
});
