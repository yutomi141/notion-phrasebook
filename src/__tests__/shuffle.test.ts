import { describe, it, expect, vi, afterEach } from 'vitest';
import { shuffle } from '@/lib/cards/shuffle';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('shuffle', () => {
  it('元の配列を破壊しない', () => {
    const input = [1, 2, 3, 4, 5];
    const copy = [...input];
    shuffle(input);
    expect(input).toEqual(copy);
  });

  it('要素の顔ぶれは変わらない（順列になる）', () => {
    const input = ['a', 'b', 'c', 'd', 'e'];
    const result = shuffle(input);
    expect(result).toHaveLength(input.length);
    expect([...result].sort()).toEqual([...input].sort());
  });

  it('Math.random が常に0のとき Fisher–Yates の期待順になる', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    // 末尾から順に先頭要素と入れ替わる
    expect(shuffle([1, 2, 3, 4])).toEqual([2, 3, 4, 1]);
  });

  it('空配列・単一要素でも壊れない', () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle([1])).toEqual([1]);
  });

  it('十分な試行で元の順序以外も出る', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const orders = new Set(Array.from({ length: 50 }, () => shuffle(input).join(',')));
    expect(orders.size).toBeGreaterThan(1);
  });
});
