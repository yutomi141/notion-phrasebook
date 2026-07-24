import { describe, it, expect } from 'vitest';
import { calculateNextInterval } from '@/lib/srs/algorithm';

describe('calculateNextInterval', () => {
  it('忘れた場合は間隔を1日にリセットする', () => {
    const result = calculateNextInterval('forgotten', 10, 3);
    expect(result.nextIntervalDays).toBe(1);
    expect(result.newStreak).toBe(0);
    expect(result.newStatus).toBe('Reviewing');
  });

  it('覚えた初回（interval=0）は1日後に設定する', () => {
    const result = calculateNextInterval('remembered', 0, 0);
    expect(result.nextIntervalDays).toBe(1);
    expect(result.newStreak).toBe(1);
    expect(result.newStatus).toBe('Reviewing');
  });

  it('覚えた2回目（interval=1）は3日後に設定する', () => {
    const result = calculateNextInterval('remembered', 1, 1);
    expect(result.nextIntervalDays).toBe(3);
    expect(result.newStreak).toBe(2);
  });

  it('streak>=3かつinterval>=7でMasteredになる', () => {
    const result = calculateNextInterval('remembered', 7, 2);
    expect(result.newStatus).toBe('Mastered');
    expect(result.newStreak).toBe(3);
  });

  it('streak<3ならMasteredにならない', () => {
    const result = calculateNextInterval('remembered', 7, 1);
    expect(result.newStatus).toBe('Reviewing');
  });

  it('間隔は365日を超えない', () => {
    const result = calculateNextInterval('remembered', 200, 10);
    expect(result.nextIntervalDays).toBeLessThanOrEqual(365);
  });
});
