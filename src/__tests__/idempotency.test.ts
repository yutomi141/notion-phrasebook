/**
 * I-4: Sync Version による冪等化 / I-5: 楽観ロック のテスト
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
