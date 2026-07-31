/**
 * Review Log をカードソース別に記録するテスト。
 * 既存の Phrase / Script Sentence の記録に回帰がないことも併せて検証する。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPagesCreate = vi.fn().mockResolvedValue({});
const mockDbQuery = vi.fn().mockResolvedValue({ results: [], has_more: false });

vi.mock('@/lib/notion/client', () => ({
  notion: {
    pages: { create: mockPagesCreate },
    databases: { query: mockDbQuery },
  },
}));
vi.mock('server-only', () => ({}));

import type { ReviewPayload } from '@/types';

function makePayload(overrides: Partial<ReviewPayload> = {}): ReviewPayload {
  return {
    itemId: 'item-1',
    itemType: 'phrase',
    result: 'remembered',
    direction: 'EN_TO_JA',
    sessionId: 'session-1',
    reviewedAt: '2026-07-31T12:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mockDbQuery.mockResolvedValue({ results: [], has_more: false });
  process.env.NOTION_PHRASE_DB_ID = 'phrase-db-id';
  process.env.NOTION_REVIEW_LOG_DB_ID = 'review-log-db-id';
  process.env.NOTION_READING_VOCAB_DB_ID = 'reading-vocab-db-id';
});

async function write(payload: ReviewPayload) {
  const { writeReviewLog } = await import('@/lib/notion/review-log');
  await writeReviewLog(payload, '2026-07-31T12:00:00.000Z', 1, 3);
  return mockPagesCreate.mock.calls[0][0].properties;
}

describe('Review Log のソース別記録', () => {
  it('リーディング語彙は Item Type が Reading Vocab、relation も専用プロパティ', async () => {
    const props = await write(makePayload({ sourceId: 'reading-vocab' }));

    expect(props['Item Type']).toEqual({ select: { name: 'Reading Vocab' } });
    expect(props['Reading Vocab']).toEqual({ relation: [{ id: 'item-1' }] });
    // Phrase DB の relation は使わない（別DBのページは入れられない）
    expect(props['Phrase']).toBeUndefined();
  });

  it('フレーズは従来どおり Item Type が Phrase、relation は Phrase', async () => {
    const props = await write(makePayload({ sourceId: 'phrase' }));

    expect(props['Item Type']).toEqual({ select: { name: 'Phrase' } });
    expect(props['Phrase']).toEqual({ relation: [{ id: 'item-1' }] });
    expect(props['Reading Vocab']).toBeUndefined();
  });

  it('sourceId 省略時は Phrase として記録する（旧クライアントとの後方互換）', async () => {
    const props = await write(makePayload());

    expect(props['Item Type']).toEqual({ select: { name: 'Phrase' } });
    expect(props['Phrase']).toEqual({ relation: [{ id: 'item-1' }] });
  });

  it('Script Sentence の記録は sourceId の影響を受けない', async () => {
    const props = await write(
      makePayload({ itemType: 'sentence', sourceId: 'reading-vocab' }),
    );

    expect(props['Item Type']).toEqual({ select: { name: 'Script Sentence' } });
    expect(props['Script Sentence']).toEqual({ relation: [{ id: 'item-1' }] });
    expect(props['Phrase']).toBeUndefined();
    expect(props['Reading Vocab']).toBeUndefined();
  });

  it('ソースに関係なく共通項目は記録される', async () => {
    const props = await write(makePayload({ sourceId: 'reading-vocab', result: 'forgotten' }));

    expect(props['Log Entry']).toEqual({ title: [{ text: { content: 'session-1:item-1' } }] });
    expect(props['Result']).toEqual({ select: { name: 'Forgotten' } });
    expect(props['Direction']).toEqual({ select: { name: 'EN→JA' } });
    expect(props['Previous Interval']).toEqual({ number: 1 });
    expect(props['Next Interval']).toEqual({ number: 3 });
    expect(props['Session ID']).toEqual({ rich_text: [{ text: { content: 'session-1' } }] });
  });

  it('同一 Log Entry が既にあれば二重登録しない', async () => {
    mockDbQuery.mockResolvedValue({ results: [{ id: 'existing' }], has_more: false });
    const { writeReviewLog } = await import('@/lib/notion/review-log');

    await writeReviewLog(makePayload({ sourceId: 'reading-vocab' }), '2026-07-31T12:00:00.000Z');

    expect(mockPagesCreate).not.toHaveBeenCalled();
  });

  it('Reading Vocab DB 未設定なら Phrase の記録先へフォールバックする', async () => {
    delete process.env.NOTION_READING_VOCAB_DB_ID;
    const props = await write(makePayload({ sourceId: 'reading-vocab' }));

    expect(props['Item Type']).toEqual({ select: { name: 'Phrase' } });
    expect(props['Phrase']).toEqual({ relation: [{ id: 'item-1' }] });
  });
});
