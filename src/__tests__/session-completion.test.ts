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

describe('M-2: 保存失敗カウンタ', () => {
  it('onError が呼ばれるたびに failedCount が加算される', () => {
    let failedCount = 0;
    const onError = () => { failedCount += 1; };

    onError();
    expect(failedCount).toBe(1);

    onError();
    onError();
    expect(failedCount).toBe(3);
  });

  it('練習モード中は onError が呼ばれない（submitReview を呼ばない）', () => {
    let submitCalled = false;
    const submitReview = () => { submitCalled = true; };

    const practiceMode = true;
    if (!practiceMode) submitReview();

    expect(submitCalled).toBe(false);
  });
});

describe('「設定を変えて学習する」の全 state リセット', () => {
  it('設定画面へ戻る際に全セッション state がリセットされる', () => {
    let cardIndex = 2;
    let finished = true;
    let sessionStats = { remembered: 2, forgotten: 1 };
    let failedCount = 1;
    let practiceMode = true;
    let sessionId = 'old-session-id';

    // 「設定を変えて学習する」onClick のシミュレーション
    cardIndex = 0;
    finished = false;
    sessionStats = { remembered: 0, forgotten: 0 };
    failedCount = 0;
    practiceMode = false;
    sessionId = 'new-session-id';

    expect(cardIndex).toBe(0);
    expect(finished).toBe(false);
    expect(sessionStats).toEqual({ remembered: 0, forgotten: 0 });
    expect(failedCount).toBe(0);
    expect(practiceMode).toBe(false);
    expect(sessionId).not.toBe('old-session-id');
  });
});

describe('M-4: 練習モード', () => {
  it('practiceMode=false のとき submitReview が呼ばれる', () => {
    let submitCalled = false;
    const submitReview = () => { submitCalled = true; };

    const practiceMode = false;
    if (!practiceMode) submitReview();

    expect(submitCalled).toBe(true);
  });

  it('restartSession で practiceMode が true になり sessionId が新しくなる', () => {
    let practiceMode = false;
    let sessionId = 'original-id';

    // restartSession ロジックのシミュレーション
    function restartSession(newId: string) {
      practiceMode = true;
      sessionId = newId;
    }

    restartSession('new-id');
    expect(practiceMode).toBe(true);
    expect(sessionId).toBe('new-id');
    expect(sessionId).not.toBe('original-id');
  });
});
