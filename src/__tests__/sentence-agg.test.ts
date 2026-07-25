import { describe, it, expect } from 'vitest';
import { aggregateSentences } from '@/lib/notion/sentence-agg';

const TOMORROW = '2026-07-25';
const IN_7_DAYS = '2026-07-31';
const TODAY = '2026-07-24';

describe('aggregateSentences — N-3 Script Next Review 集計', () => {
  it('Done=明日、In progress=7日後 → minNextReview は明日', () => {
    const result = aggregateSentences([
      { status: 'Done', nextReview: TOMORROW },
      { status: 'In progress', nextReview: IN_7_DAYS },
    ]);
    expect(result.minNextReview).toBe(TOMORROW);
    expect(result.done).toBe(1);
    expect(result.total).toBe(2);
    expect(result.hasUnscheduled).toBe(false);
  });

  it('Not started で日付なし → hasUnscheduled=true', () => {
    const result = aggregateSentences([
      { status: 'Not started', nextReview: null },
    ]);
    expect(result.hasUnscheduled).toBe(true);
    expect(result.done).toBe(0);
    expect(result.minNextReview).toBeNull();
  });

  it('In progress で日付なし → hasUnscheduled=true', () => {
    const result = aggregateSentences([
      { status: 'In progress', nextReview: null },
    ]);
    expect(result.hasUnscheduled).toBe(true);
  });

  it('全文 Done + 日付あり → done===total, hasUnscheduled=false, minNextReview は最小日付', () => {
    const result = aggregateSentences([
      { status: 'Done', nextReview: TOMORROW },
      { status: 'Done', nextReview: IN_7_DAYS },
    ]);
    expect(result.done).toBe(2);
    expect(result.total).toBe(2);
    expect(result.hasUnscheduled).toBe(false);
    expect(result.minNextReview).toBe(TOMORROW);
  });

  it('全文 Done ではない＋未学習あり → hasUnscheduled=true', () => {
    const result = aggregateSentences([
      { status: 'Done', nextReview: TOMORROW },
      { status: 'Not started', nextReview: null },
    ]);
    expect(result.hasUnscheduled).toBe(true);
    expect(result.done).toBe(1);
    expect(result.total).toBe(2);
  });

  it('全文 Done ではない＋全件日付あり → minNextReview は最小日付', () => {
    const result = aggregateSentences([
      { status: 'In progress', nextReview: IN_7_DAYS },
      { status: 'In progress', nextReview: TOMORROW },
      { status: 'Done', nextReview: TODAY },
    ]);
    expect(result.minNextReview).toBe(TODAY);
    expect(result.hasUnscheduled).toBe(false);
  });

  it('Done で Next Review なしは hasUnscheduled に影響しない', () => {
    // Done 済み = 一度は学習済み。Next Review 未設定でも未学習扱いにしない
    const result = aggregateSentences([
      { status: 'Done', nextReview: null },
    ]);
    expect(result.hasUnscheduled).toBe(false);
    expect(result.done).toBe(1);
    expect(result.minNextReview).toBeNull();
  });

  it('aggregateSentences は入力配列を変更しない（純粋関数）', () => {
    const inputs = [
      { status: 'In progress' as const, nextReview: TOMORROW },
      { status: 'Not started' as const, nextReview: null },
    ];
    const copy = JSON.stringify(inputs);
    aggregateSentences(inputs);
    expect(JSON.stringify(inputs)).toBe(copy);
  });
});

describe('aggregateSentences — 全文Done時のNext Review保持', () => {
  it('Done=明日、In progress=7日後 → minNextReview は明日（script-dbがそのまま設定）', () => {
    const result = aggregateSentences([
      { status: 'Done', nextReview: TOMORROW },
      { status: 'In progress', nextReview: IN_7_DAYS },
    ]);
    expect(result.minNextReview).toBe(TOMORROW);
    expect(result.hasUnscheduled).toBe(false);
  });

  it('全文Done・Next Reviewが明日と7日後 → minNextReview は明日', () => {
    const result = aggregateSentences([
      { status: 'Done', nextReview: TOMORROW },
      { status: 'Done', nextReview: IN_7_DAYS },
    ]);
    expect(result.minNextReview).toBe(TOMORROW);
    expect(result.hasUnscheduled).toBe(false);
    expect(result.done).toBe(2);
  });

  it('全文Done・全Next Reviewがnull → minNextReview は null', () => {
    const result = aggregateSentences([
      { status: 'Done', nextReview: null },
      { status: 'Done', nextReview: null },
    ]);
    expect(result.minNextReview).toBeNull();
    expect(result.hasUnscheduled).toBe(false);
    expect(result.done).toBe(2);
  });

  it('Not started（Next Reviewなし）＋Done（明日） → hasUnscheduled=true で未学習優先', () => {
    const result = aggregateSentences([
      { status: 'Not started', nextReview: null },
      { status: 'Done', nextReview: TOMORROW },
    ]);
    expect(result.hasUnscheduled).toBe(true);
    expect(result.minNextReview).toBe(TOMORROW);
  });

  it('全文DoneでもhasUnscheduled=falseなのでscript-db側がPerfect判定できる', () => {
    const result = aggregateSentences([
      { status: 'Done', nextReview: TOMORROW },
      { status: 'Done', nextReview: IN_7_DAYS },
    ]);
    const allDone = result.done === result.total;
    expect(allDone).toBe(true);
    expect(result.hasUnscheduled).toBe(false);
    // hasUnscheduled=false, minNextReview=TOMORROW → script-db は TOMORROW を設定
    expect(result.minNextReview).toBe(TOMORROW);
  });
});
