import { describe, it, expect } from 'vitest';
import { calculateNextInterval } from '@/lib/srs/algorithm';

describe('SRS Mastered 後の再出題', () => {
  it('Mastered 状態で forgotten → Reviewing に戻る', () => {
    const result = calculateNextInterval('forgotten', 30, 5);
    expect(result.newStatus).toBe('Reviewing');
    expect(result.newStreak).toBe(0);
    expect(result.nextIntervalDays).toBe(1);
  });

  it('Mastered 状態で remembered → 間隔が延びる', () => {
    const result = calculateNextInterval('remembered', 30, 5);
    expect(result.nextIntervalDays).toBeGreaterThan(30);
    expect(result.newStatus).toBe('Mastered');
  });
});

describe('セッション完了ロジック', () => {
  it('最終カード（cardIndex === total - 1）で finished になる', () => {
    const total = 3;
    let cardIndex = 0;
    let finished = false;

    function onSuccess() {
      if (cardIndex >= total - 1) {
        finished = true;
      } else {
        cardIndex += 1;
      }
    }

    // カード0: 次へ
    onSuccess();
    expect(cardIndex).toBe(1);
    expect(finished).toBe(false);

    // カード1: 次へ
    onSuccess();
    expect(cardIndex).toBe(2);
    expect(finished).toBe(false);

    // カード2（最終）: finished
    onSuccess();
    expect(finished).toBe(true);
    expect(cardIndex).toBe(2); // index は増えない
  });
});
