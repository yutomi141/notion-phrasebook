import { describe, it, expect, vi, afterEach } from 'vitest';

// server-only モジュールのモック（ユニットテスト環境では不要）
vi.mock('server-only', () => ({}));

import { todayJST, addDaysJST } from '@/lib/date';

describe('todayJST', () => {
  afterEach(() => vi.useRealTimers());

  it('YYYY-MM-DD 形式を返す', () => {
    const result = todayJST();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('UTC 0:00 でも JST 日付（UTC+9）を返す', () => {
    // UTC 2024-01-01 00:00 = JST 2024-01-01 09:00
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    expect(todayJST()).toBe('2024-01-01');
  });

  it('UTC の前日深夜でも JST 当日を返す', () => {
    // UTC 2024-01-01 23:00 = JST 2024-01-02 08:00
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T23:00:00Z'));
    expect(todayJST()).toBe('2024-01-02');
  });
});

describe('addDaysJST', () => {
  it('日数を加算した YYYY-MM-DD を返す', () => {
    const base = new Date('2024-03-15T00:00:00+09:00');
    expect(addDaysJST(base, 7)).toBe('2024-03-22');
  });

  it('月をまたぐ加算', () => {
    const base = new Date('2024-01-30T12:00:00+09:00');
    expect(addDaysJST(base, 3)).toBe('2024-02-02');
  });

  it('0日加算は同日を返す', () => {
    const base = new Date('2024-06-01T00:00:00+09:00');
    expect(addDaysJST(base, 0)).toBe('2024-06-01');
  });
});
