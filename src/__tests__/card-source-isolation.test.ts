/**
 * 受け入れ条件の中核テスト。
 *  - モード選択で Phrase と Reading Vocab のカードが混在しない
 *  - Reading Vocab DB の既存カードが取得できる
 *  - 覚えた／忘れたが Reading Vocab DB の該当行へ反映される
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

const mockPagesRetrieve = vi.fn();
const mockPagesUpdate = vi.fn().mockResolvedValue({});
const mockDbQuery = vi.fn();
const mockDbRetrieve = vi.fn();

vi.mock('@/lib/notion/client', () => ({
  notion: {
    pages: { retrieve: mockPagesRetrieve, update: mockPagesUpdate },
    databases: { query: mockDbQuery, retrieve: mockDbRetrieve },
  },
}));
vi.mock('server-only', () => ({}));

const PHRASE_DB_ID = 'phrase-db-id';
const VOCAB_DB_ID = 'reading-vocab-db-id';

/** Reading Vocab DB の実スキーマ（Phrase DB と同一のデータ契約） */
const VOCAB_SCHEMA = {
  'Phrase': { type: 'title' },
  'Meaning': { type: 'rich_text' },
  'Example': { type: 'rich_text' },
  'Tags': { type: 'multi_select' },
  'ステータス': { type: 'status' },
  'Last Reviewed': { type: 'date' },
  'Next Review': { type: 'date' },
  'Interval Days': { type: 'number' },
  'Correct Streak': { type: 'number' },
  'Review Count': { type: 'number' },
  'Forgotten Count': { type: 'number' },
  'Sync Version': { type: 'rich_text' },
};

function makeVocabPage(overrides: {
  id?: string;
  parentDbId?: string;
  phrase?: string;
  intervalDays?: number;
  correctStreak?: number;
  status?: string;
} = {}): PageObjectResponse {
  return {
    id: overrides.id ?? 'vocab-page-id',
    object: 'page',
    last_edited_time: '2026-07-31T00:00:00.000Z',
    parent: { type: 'database_id', database_id: overrides.parentDbId ?? VOCAB_DB_ID },
    properties: {
      'Phrase': { type: 'title', title: [{ plain_text: overrides.phrase ?? 'erosion' }] },
      'Meaning': { type: 'rich_text', rich_text: [{ plain_text: '侵食' }] },
      'Example': { type: 'rich_text', rich_text: [{ plain_text: 'Wind erosion shaped the dunes.' }] },
      'Tags': { type: 'multi_select', multi_select: [{ name: 'Noun' }, { name: 'Geology' }] },
      'ステータス': { type: 'status', status: { name: overrides.status ?? 'New' } },
      'Interval Days': { type: 'number', number: overrides.intervalDays ?? 0 },
      'Correct Streak': { type: 'number', number: overrides.correctStreak ?? 0 },
      'Review Count': { type: 'number', number: 0 },
      'Forgotten Count': { type: 'number', number: 0 },
      'Next Review': { type: 'date', date: null },
      'Last Reviewed': { type: 'date', date: null },
      'Sync Version': { type: 'rich_text', rich_text: [] },
    },
  } as unknown as PageObjectResponse;
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.NOTION_PHRASE_DB_ID = PHRASE_DB_ID;
  process.env.NOTION_REVIEW_LOG_DB_ID = 'review-log-db-id';
  process.env.NOTION_READING_VOCAB_DB_ID = VOCAB_DB_ID;
  mockDbRetrieve.mockResolvedValue({ properties: VOCAB_SCHEMA });
  mockDbQuery.mockResolvedValue({ results: [], has_more: false });
});

async function load() {
  const cardDb = await import('@/lib/notion/card-db');
  const registry = await import('@/lib/schema/card-sources');
  const schema = await import('@/lib/notion/card-source-schema');
  schema.clearPropertyMapCache();
  return { ...cardDb, ...registry };
}

describe('カードソースの分離', () => {
  it('Reading Vocab の同期は Reading Vocab DB だけをクエリする', async () => {
    const { fetchDueCards, getCardSource } = await load();
    mockDbQuery.mockResolvedValue({ results: [makeVocabPage()], has_more: false });

    await fetchDueCards(getCardSource('reading-vocab')!);

    expect(mockDbQuery).toHaveBeenCalledTimes(1);
    expect(mockDbQuery.mock.calls[0][0].database_id).toBe(VOCAB_DB_ID);
    // Phrase DB は一切参照しない
    for (const call of mockDbQuery.mock.calls) {
      expect(call[0].database_id).not.toBe(PHRASE_DB_ID);
    }
  });

  it('Phrase の同期は Phrase DB だけをクエリする', async () => {
    const { fetchDueCards, getCardSource } = await load();

    await fetchDueCards(getCardSource('phrase')!);

    expect(mockDbQuery).toHaveBeenCalledTimes(1);
    expect(mockDbQuery.mock.calls[0][0].database_id).toBe(PHRASE_DB_ID);
  });

  it('Reading Vocab DB の既存カードをアプリのカード型へ変換できる', async () => {
    const { fetchDueCards, getCardSource } = await load();
    mockDbQuery.mockResolvedValue({
      results: [makeVocabPage({ id: 'v1', phrase: 'erosion' })],
      has_more: false,
    });

    const cards = await fetchDueCards(getCardSource('reading-vocab')!);

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      id: 'v1',
      phrase: 'erosion',
      meaning: '侵食',
      example: 'Wind erosion shaped the dunes.',
      tags: ['Noun', 'Geology'],
      status: 'New',
    });
  });

  it('全ページを取得するまでページネーションを追う', async () => {
    const { fetchDueCards, getCardSource } = await load();
    mockDbQuery
      .mockResolvedValueOnce({
        // 重複排除に巻き込まれないよう、ページごとに別のフレーズを返す
        results: [makeVocabPage({ id: 'v1', phrase: 'erosion' })],
        has_more: true,
        next_cursor: 'cursor-1',
      })
      .mockResolvedValueOnce({
        results: [makeVocabPage({ id: 'v2', phrase: 'sediment' })],
        has_more: false,
      });

    const cards = await fetchDueCards(getCardSource('reading-vocab')!);

    expect(cards.map((c) => c.id)).toEqual(['v1', 'v2']);
    expect(mockDbQuery.mock.calls[1][0].start_cursor).toBe('cursor-1');
  });

  it('他ソースのページIDを渡しても状態を返さない（セッション混在の防止）', async () => {
    const { fetchCardSrsState, getCardSource } = await load();
    // Phrase DB に属するページを Reading Vocab ソースで参照する
    mockPagesRetrieve.mockResolvedValue(makeVocabPage({ parentDbId: PHRASE_DB_ID }));

    const state = await fetchCardSrsState(getCardSource('reading-vocab')!, 'phrase-page-id');

    expect(state).toBeNull();
  });

  it('親DBが一致すれば状態を返す（ハイフンの有無を無視する）', async () => {
    process.env.NOTION_READING_VOCAB_DB_ID = '00000000-1111-2222-3333-444444444444';
    const { fetchCardSrsState, getCardSource } = await load();
    mockPagesRetrieve.mockResolvedValue(
      makeVocabPage({ parentDbId: '00000000111122223333444444444444', intervalDays: 3, correctStreak: 2 }),
    );

    const state = await fetchCardSrsState(getCardSource('reading-vocab')!, 'vocab-page-id');

    expect(state).not.toBeNull();
    expect(state!.intervalDays).toBe(3);
    expect(state!.correctStreak).toBe(2);
  });
});

describe('Reading Vocab への復習結果の反映', () => {
  it('覚えた結果が Reading Vocab DB の該当行へ書き込まれる', async () => {
    const { updateCardAfterReview, getCardSource } = await load();

    await updateCardAfterReview(getCardSource('reading-vocab')!, 'vocab-page-id', {
      status: 'Reviewing',
      intervalDays: 3,
      correctStreak: 2,
      nextReviewDate: '2026-08-03',
      reviewedAt: '2026-07-31T12:00:00.000Z',
      reviewCount: 2,
      forgottenCount: 0,
      syncVersion: 'session-1:vocab-page-id',
    });

    expect(mockPagesUpdate).toHaveBeenCalledTimes(1);
    const call = mockPagesUpdate.mock.calls[0][0];
    expect(call.page_id).toBe('vocab-page-id');
    expect(call.properties['Next Review']).toEqual({ date: { start: '2026-08-03' } });
    expect(call.properties['Interval Days']).toEqual({ number: 3 });
    expect(call.properties['Correct Streak']).toEqual({ number: 2 });
    expect(call.properties['ステータス']).toEqual({ status: { name: 'Reviewing' } });
    expect(call.properties['Review Count']).toEqual({ number: 2 });
    expect(call.properties['Last Reviewed']).toEqual({
      date: { start: '2026-07-31T12:00:00.000Z' },
    });
  });

  it('自動検出されたプロパティ名で書き込む（リネームに追従する）', async () => {
    mockDbRetrieve.mockResolvedValue({
      properties: {
        'Word': { type: 'title' },
        'Japanese': { type: 'rich_text' },
        'Status': { type: 'status' },
        'Due': { type: 'date' },
        'Last Reviewed': { type: 'date' },
        'Interval': { type: 'number' },
        'Streak': { type: 'number' },
        'Review Count': { type: 'number' },
        'Forgotten Count': { type: 'number' },
        'Sync Version': { type: 'rich_text' },
      },
    });
    const { updateCardAfterReview, getCardSource } = await load();

    await updateCardAfterReview(getCardSource('reading-vocab')!, 'vocab-page-id', {
      status: 'Mastered',
      intervalDays: 7,
      correctStreak: 3,
      nextReviewDate: '2026-08-07',
      reviewedAt: '2026-07-31T12:00:00.000Z',
      reviewCount: 3,
      forgottenCount: 0,
      syncVersion: 'session-1:vocab-page-id',
    });

    const props = mockPagesUpdate.mock.calls[0][0].properties;
    expect(props['Due']).toEqual({ date: { start: '2026-08-07' } });
    expect(props['Interval']).toEqual({ number: 7 });
    expect(props['Streak']).toEqual({ number: 3 });
    expect(props['Status']).toEqual({ status: { name: 'Mastered' } });
  });

  it('スキーマ取得に失敗しても正準プロパティ名で動作を継続する', async () => {
    mockDbRetrieve.mockRejectedValue(new Error('unauthorized'));
    const { updateCardAfterReview, getCardSource } = await load();

    await updateCardAfterReview(getCardSource('reading-vocab')!, 'vocab-page-id', {
      status: 'Reviewing',
      intervalDays: 1,
      correctStreak: 1,
      nextReviewDate: '2026-08-01',
      reviewedAt: '2026-07-31T12:00:00.000Z',
      reviewCount: 1,
      forgottenCount: 0,
      syncVersion: 'session-1:vocab-page-id',
    });

    const props = mockPagesUpdate.mock.calls[0][0].properties;
    expect(props['Next Review']).toEqual({ date: { start: '2026-08-01' } });
    expect(props['ステータス']).toEqual({ status: { name: 'Reviewing' } });
  });
});
