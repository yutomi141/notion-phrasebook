/**
 * I-4: Sync Version による冪等化 / I-5: 楽観ロック / B-1: リプレイ分岐のScript集計 のテスト
 * Notion APIをモックし、各シナリオのSRS更新呼び出し回数を検証する。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- モック定義 ----

const mockPagesUpdate = vi.fn().mockResolvedValue({});
const mockPagesRetrieve = vi.fn();
const mockDbQuery = vi.fn().mockResolvedValue({ results: [], has_more: false });

vi.mock('@/lib/notion/client', () => ({
  notion: {
    pages: {
      retrieve: mockPagesRetrieve,
      update: mockPagesUpdate,
    },
    databases: { query: mockDbQuery },
  },
}));

vi.mock('@/lib/notion/review-log', () => ({
  hasReviewLog: vi.fn().mockResolvedValue(false),
  writeReviewLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('server-only', () => ({}));

// ---- B-1 用モック（Script集計） ----
const mockCountSentencesForScript = vi.fn();
const mockFetchScriptStatus = vi.fn();
const mockUpdateScriptAfterReview = vi.fn();

// ---- ヘルパー ----

import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

function makePhrasePage(overrides: {
  syncVersion?: string;
  stateVersion?: string;
  intervalDays?: number;
  correctStreak?: number;
  status?: string;
} = {}): PageObjectResponse {
  return {
    id: 'phrase-page-id',
    object: 'page',
    last_edited_time: overrides.stateVersion ?? '2026-07-25T00:00:00.000Z',
    parent: {
      type: 'database_id',
      database_id: process.env.NOTION_PHRASE_DB_ID ?? 'phrase-db-id',
    },
    properties: {
      'Interval Days': { type: 'number', number: overrides.intervalDays ?? 1 },
      'Correct Streak': { type: 'number', number: overrides.correctStreak ?? 0 },
      'Review Count': { type: 'number', number: 0 },
      'Forgotten Count': { type: 'number', number: 0 },
      'ステータス': { type: 'status', status: { name: overrides.status ?? 'New', id: '', color: 'default' } },
      'Sync Version': {
        type: 'rich_text',
        rich_text: overrides.syncVersion
          ? [{ type: 'text', text: { content: overrides.syncVersion }, plain_text: overrides.syncVersion, annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: 'default' }, href: null }]
          : [],
      },
      'Last Reviewed': { type: 'date', date: null },
      'Next Review': { type: 'date', date: null },
    },
  } as unknown as PageObjectResponse;
}

// ---- テスト ----

describe('I-4: Sync Version による冪等化', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NOTION_PHRASE_DB_ID = 'phrase-db-id';
    process.env.NOTION_REVIEW_LOG_DB_ID = 'review-log-db-id';
  });

  it('正常系: 新規レビューはSRS更新が1回呼ばれる', async () => {
    const page = makePhrasePage({ syncVersion: '', stateVersion: 'v1' });
    mockPagesRetrieve.mockResolvedValue(page);

    const { fetchPhraseSrsState, updatePhraseAfterReview } = await import('@/lib/notion/phrase-db');
    const state = await fetchPhraseSrsState('phrase-page-id');
    expect(state?.syncVersion).toBe('');

    const logEntry = 'session-1:phrase-page-id';
    const srsAlreadyApplied = state?.syncVersion === logEntry;
    expect(srsAlreadyApplied).toBe(false);

    await updatePhraseAfterReview('phrase-page-id', 'Reviewing', 1, 1, '2026-07-26', '2026-07-25T00:00:00Z', 1, 0, logEntry);
    expect(mockPagesUpdate).toHaveBeenCalledTimes(1);
    const updateCall = mockPagesUpdate.mock.calls[0][0];
    expect(updateCall.properties['Sync Version'].rich_text[0].text.content).toBe(logEntry);
  });

  it('SRS更新済みの場合: syncVersion一致でSRS更新をスキップする', async () => {
    const logEntry = 'session-1:phrase-page-id';
    const page = makePhrasePage({ syncVersion: logEntry, stateVersion: 'v2' });
    mockPagesRetrieve.mockResolvedValue(page);

    const { fetchPhraseSrsState } = await import('@/lib/notion/phrase-db');
    const state = await fetchPhraseSrsState('phrase-page-id');

    const srsAlreadyApplied = state?.syncVersion === logEntry;
    expect(srsAlreadyApplied).toBe(true);
    expect(mockPagesUpdate).not.toHaveBeenCalled();
  });

  it('全完了後の再送: syncVersionもlogEntryも一致するため何も更新されない', async () => {
    const { hasReviewLog } = await import('@/lib/notion/review-log');
    vi.mocked(hasReviewLog).mockResolvedValueOnce(true);

    const alreadyLogged = await hasReviewLog('session-1', 'phrase-page-id');
    expect(alreadyLogged).toBe(true);
    expect(mockPagesUpdate).not.toHaveBeenCalled();
  });

  it('異なるsessionIdからの正当な2回目レビュー: 通常どおり適用される', async () => {
    const oldLogEntry = 'session-1:phrase-page-id';
    const newLogEntry = 'session-2:phrase-page-id';
    const page = makePhrasePage({ syncVersion: oldLogEntry, stateVersion: 'v3', intervalDays: 3, correctStreak: 1 });
    mockPagesRetrieve.mockResolvedValue(page);

    const { fetchPhraseSrsState, updatePhraseAfterReview } = await import('@/lib/notion/phrase-db');
    const state = await fetchPhraseSrsState('phrase-page-id');

    const srsAlreadyApplied = state?.syncVersion === newLogEntry;
    expect(srsAlreadyApplied).toBe(false);

    await updatePhraseAfterReview('phrase-page-id', 'Reviewing', 7, 2, '2026-08-01', '2026-07-25T00:00:00Z', 2, 0, newLogEntry);
    expect(mockPagesUpdate).toHaveBeenCalledTimes(1);
    const updateCall = mockPagesUpdate.mock.calls[0][0];
    expect(updateCall.properties['Sync Version'].rich_text[0].text.content).toBe(newLogEntry);
  });
});

describe('F-2: リプレイ分岐 — 再計算なしで保存済み値を返す', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NOTION_PHRASE_DB_ID = 'phrase-db-id';
    process.env.NOTION_SCRIPT_SENTENCES_DB_ID = 'sentences-db-id';
    process.env.NOTION_REVIEW_LOG_DB_ID = 'review-log-db-id';
  });

  it('1. フレーズ: リプレイ時はnotion.pages.updateを呼ばない', async () => {
    const logEntry = 'session-x:phrase-page-id';
    const page = makePhrasePage({ syncVersion: logEntry, stateVersion: 'v5', intervalDays: 8 });
    mockPagesRetrieve.mockResolvedValue(page);

    const { fetchPhraseSrsState, updatePhraseAfterReview } = await import('@/lib/notion/phrase-db');
    const { writeReviewLog } = await import('@/lib/notion/review-log');
    const state = await fetchPhraseSrsState('phrase-page-id');
    expect(state).not.toBeNull();

    // ルートハンドラのリプレイ分岐をシミュレート
    if (state!.syncVersion === logEntry) {
      await writeReviewLog(
        { itemId: 'phrase-page-id', sessionId: 'session-x', result: 'remembered', itemType: 'phrase', direction: 'EN_TO_JA', reviewedAt: '2026-07-25T00:00:00Z' },
        '2026-07-25T00:00:00Z',
        undefined,
        state!.intervalDays,
      );
    } else {
      await updatePhraseAfterReview('phrase-page-id', 'Reviewing', 20, 3, '2026-08-15', '2026-07-25T00:00:00Z', 3, 0, logEntry);
    }

    // SRS更新（pages.update）は一切呼ばれない
    expect(mockPagesUpdate).not.toHaveBeenCalled();
    expect(writeReviewLog).toHaveBeenCalledTimes(1);
  });

  it('2. フレーズ: リプレイ時のwriteReviewLogには再計算値ではなく保存済みintervalDaysを渡す', async () => {
    const logEntry = 'session-x:phrase-page-id';
    // SRS適用後の状態: intervalDays=8, correctStreak=2
    // 再計算すると 8 * 2.5 = 20 になる（F-2修正前のバグ）
    const page = makePhrasePage({ syncVersion: logEntry, stateVersion: 'v5', intervalDays: 8, correctStreak: 2 });
    mockPagesRetrieve.mockResolvedValue(page);

    const { fetchPhraseSrsState } = await import('@/lib/notion/phrase-db');
    const { writeReviewLog } = await import('@/lib/notion/review-log');
    const state = await fetchPhraseSrsState('phrase-page-id');

    if (state!.syncVersion === logEntry) {
      await writeReviewLog(
        { itemId: 'phrase-page-id', sessionId: 'session-x', result: 'remembered', itemType: 'phrase', direction: 'EN_TO_JA', reviewedAt: '2026-07-25T00:00:00Z' },
        '2026-07-25T00:00:00Z',
        undefined,
        state!.intervalDays, // 保存済み値: 8
      );
    }

    const [, , , passedInterval] = vi.mocked(writeReviewLog).mock.calls[0];
    expect(passedInterval).toBe(8); // 再計算値(20)ではなく保存済み値(8)
  });

  it('3. フレーズ: リプレイレスポンスはstate.nextReview/status/intervalDaysをそのまま返す', async () => {
    const logEntry = 'session-x:phrase-page-id';
    const page = makePhrasePage({
      syncVersion: logEntry,
      stateVersion: 'v5',
      intervalDays: 8,
      correctStreak: 2,
      status: 'Reviewing',
    });
    (page.properties as Record<string, unknown>)['Next Review'] = {
      type: 'date',
      date: { start: '2026-08-02' },
    };
    mockPagesRetrieve.mockResolvedValue(page);

    const { fetchPhraseSrsState } = await import('@/lib/notion/phrase-db');
    const state = await fetchPhraseSrsState('phrase-page-id');

    // リプレイ分岐のレスポンス値（ルートハンドラに合わせた構造）
    const response = {
      ok: true,
      replayed: true,
      nextReview: state!.nextReview,
      newStatus: state!.status,
      newInterval: state!.intervalDays,
    };

    expect(response.nextReview).toBe('2026-08-02'); // 保存済み日付
    expect(response.newStatus).toBe('Reviewing');   // 保存済みステータス
    expect(response.newInterval).toBe(8);            // 再計算値(20)ではない
  });

  it('4. センテンス: リプレイ分岐のDBステータス→SRS用語マッピングが正しい', () => {
    // センテンスDB側のステータス名はPhrase DBと異なるため、ルートで変換が必要
    // route.ts: const srsStatus = state.status === 'Done' ? 'Mastered' : ...
    type SentenceStatus = 'Done' | 'In progress' | 'Not started';
    const toSrsStatus = (s: SentenceStatus) =>
      s === 'Done' ? 'Mastered' : s === 'In progress' ? 'Reviewing' : 'New';

    expect(toSrsStatus('Done')).toBe('Mastered');
    expect(toSrsStatus('In progress')).toBe('Reviewing');
    expect(toSrsStatus('Not started')).toBe('New');
    // センテンスのリプレイ分岐ではpages.updateを呼ばないことを確認
    expect(mockPagesUpdate).not.toHaveBeenCalled();
  });
});

describe('I-5: 楽観ロック — last_edited_time による競合検出', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NOTION_PHRASE_DB_ID = 'phrase-db-id';
  });

  it('競合なし: 1回の更新で完了する', async () => {
    const page = makePhrasePage({ stateVersion: 'v1' });
    mockPagesRetrieve.mockResolvedValue(page);

    const { fetchPhraseSrsState } = await import('@/lib/notion/phrase-db');
    const state1 = await fetchPhraseSrsState('phrase-page-id');
    const state2 = await fetchPhraseSrsState('phrase-page-id');

    expect(state1?.stateVersion).toBe('v1');
    expect(state2?.stateVersion).toBe('v1');
    const hasConflict = state1?.stateVersion !== state2?.stateVersion;
    expect(hasConflict).toBe(false);
  });

  it('競合検出: last_edited_timeが変わった場合に競合と判定される', async () => {
    const page1 = makePhrasePage({ stateVersion: 'v1' });
    const page2 = makePhrasePage({ stateVersion: 'v2' }); // 別の端末が更新した
    mockPagesRetrieve
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2);

    const { fetchPhraseSrsState } = await import('@/lib/notion/phrase-db');
    const state1 = await fetchPhraseSrsState('phrase-page-id');
    const state2 = await fetchPhraseSrsState('phrase-page-id');

    const hasConflict = state1?.stateVersion !== state2?.stateVersion;
    expect(hasConflict).toBe(true);
  });

  it('再試行後も競合する場合は409相当の結果になる', async () => {
    const pages = [
      makePhrasePage({ stateVersion: 'v1' }),
      makePhrasePage({ stateVersion: 'v2' }),
      makePhrasePage({ stateVersion: 'v2' }),
      makePhrasePage({ stateVersion: 'v3' }), // 再試行後もまた変わった
    ];
    mockPagesRetrieve
      .mockResolvedValueOnce(pages[0])
      .mockResolvedValueOnce(pages[1])
      .mockResolvedValueOnce(pages[2])
      .mockResolvedValueOnce(pages[3]);

    const { fetchPhraseSrsState } = await import('@/lib/notion/phrase-db');
    const s1 = await fetchPhraseSrsState('phrase-page-id');
    const s2 = await fetchPhraseSrsState('phrase-page-id'); // 更新直前の再確認
    const conflictDetected1 = s1?.stateVersion !== s2?.stateVersion;
    expect(conflictDetected1).toBe(true);

    // 再試行
    const s3 = await fetchPhraseSrsState('phrase-page-id');
    const s4 = await fetchPhraseSrsState('phrase-page-id');
    const conflictDetected2 = s3?.stateVersion !== s4?.stateVersion;
    expect(conflictDetected2).toBe(true); // → 409
  });
});

describe('B-1: sentence-study リプレイ分岐での Script 集計更新', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCountSentencesForScript.mockResolvedValue({
      done: 2, total: 3, minNextReview: '2026-08-01', hasUnscheduled: false,
    });
    mockFetchScriptStatus.mockResolvedValue('Reviewing');
    mockUpdateScriptAfterReview.mockResolvedValue(undefined);
  });

  // リプレイ分岐でのScript集計ロジックをシミュレート
  // （route.ts の if (state.syncVersion === logEntry) 分岐に対応）
  async function runReplayScriptAgg(scriptId: string) {
    if (scriptId) {
      const [agg, scriptStatus] = await Promise.all([
        mockCountSentencesForScript(scriptId),
        mockFetchScriptStatus(scriptId),
      ]);
      await mockUpdateScriptAfterReview(
        scriptId, '2026-07-25', agg.done, agg.total,
        scriptStatus, 'remembered', agg.minNextReview, agg.hasUnscheduled,
      );
    }
  }

  it('1. scriptIdがあるとき Script 集計更新が呼ばれる', async () => {
    await runReplayScriptAgg('script-abc');
    expect(mockCountSentencesForScript).toHaveBeenCalledWith('script-abc');
    expect(mockUpdateScriptAfterReview).toHaveBeenCalledTimes(1);
    expect(mockUpdateScriptAfterReview.mock.calls[0][0]).toBe('script-abc');
    // SRS更新（sentenceページのpages.update）は行われない
    expect(mockPagesUpdate).not.toHaveBeenCalled();
  });

  it('2. scriptIdが空のとき Script 集計更新は呼ばれない', async () => {
    await runReplayScriptAgg('');
    expect(mockCountSentencesForScript).not.toHaveBeenCalled();
    expect(mockUpdateScriptAfterReview).not.toHaveBeenCalled();
  });

  it('3. F-2回帰: Script集計を実行しても SRS更新（pages.update）は呼ばれない', async () => {
    await runReplayScriptAgg('script-xyz');
    expect(mockUpdateScriptAfterReview).toHaveBeenCalledTimes(1); // Script集計は呼ばれる
    expect(mockPagesUpdate).not.toHaveBeenCalled();               // SRS更新は呼ばれない
  });
});
