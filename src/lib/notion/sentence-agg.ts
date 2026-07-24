// Script Next Review 集計ロジック — Notion 呼び出しを含まない純粋関数

export interface SentenceAggInput {
  status: 'Not started' | 'In progress' | 'Done';
  nextReview: string | null;
}

export interface SentenceAggResult {
  done: number;
  total: number;
  minNextReview: string | null;
  hasUnscheduled: boolean;
}

export function aggregateSentences(sentences: SentenceAggInput[]): SentenceAggResult {
  let done = 0;
  let minNextReview: string | null = null;
  let hasUnscheduled = false;

  for (const { status, nextReview } of sentences) {
    if (status === 'Done') done++;

    if (nextReview) {
      // Status に関係なく Next Review が設定されていれば最小値候補にする
      if (minNextReview === null || nextReview < minNextReview) minNextReview = nextReview;
    } else if (status !== 'Done') {
      // Done 以外で Next Review 未設定 → 未学習 or スケジュール未登録
      hasUnscheduled = true;
    }
  }

  return { done, total: sentences.length, minNextReview, hasUnscheduled };
}
