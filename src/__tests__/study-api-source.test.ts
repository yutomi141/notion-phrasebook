/**
 * /api/sync ・ /api/study ・ /api/sources のソース解決テスト。
 * 未知ソースの拒否、旧クライアント（sourceId なし）の後方互換を検証する。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetchDueCards = vi.fn();
const mockFetchCardSrsState = vi.fn();
const mockUpdateCardAfterReview = vi.fn().mockResolvedValue(undefined);
const mockHasReviewLog = vi.fn().mockResolvedValue(false);
const mockWriteReviewLog = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/notion/card-db', () => ({
  fetchDueCards: mockFetchDueCards,
  fetchCardSrsState: mockFetchCardSrsState,
  updateCardAfterReview: mockUpdateCardAfterReview,
}));
vi.mock('@/lib/notion/review-log', () => ({
  hasReviewLog: mockHasReviewLog,
  writeReviewLog: mockWriteReviewLog,
}));
vi.mock('@/auth', () => ({ auth: vi.fn().mockResolvedValue({ user: { email: 'me@example.com' } }) }));
vi.mock('server-only', () => ({}));

import { NextRequest } from 'next/server';

const STATE = {
  intervalDays: 0,
  correctStreak: 0,
  reviewCount: 0,
  forgottenCount: 0,
  status: 'New' as const,
  nextReview: null,
  syncVersion: '',
  stateVersion: '2026-07-31T00:00:00.000Z',
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.NOTION_PHRASE_DB_ID = 'phrase-db-id';
  process.env.NOTION_REVIEW_LOG_DB_ID = 'review-log-db-id';
  process.env.NOTION_READING_VOCAB_DB_ID = 'reading-vocab-db-id';
  mockFetchDueCards.mockResolvedValue([]);
  mockFetchCardSrsState.mockResolvedValue(STATE);
  mockHasReviewLog.mockResolvedValue(false);
});

function studyRequest(payload: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/study', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload }),
  });
}

const BASE_PAYLOAD = {
  itemId: 'item-1',
  itemType: 'phrase',
  result: 'remembered',
  direction: 'EN_TO_JA',
  sessionId: 'session-1',
  reviewedAt: '2026-07-31T12:00:00.000Z',
};

describe('GET /api/sources', () => {
  it('有効なソースを返し、DB ID は含めない', async () => {
    const { GET } = await import('@/app/api/sources/route');
    const body = await (await GET()).json();

    expect(body.sources.map((s: { id: string }) => s.id)).toEqual(['phrase', 'reading-vocab']);
    expect(JSON.stringify(body)).not.toContain('reading-vocab-db-id');
    expect(JSON.stringify(body)).not.toContain('phrase-db-id');
  });

  it('DB ID 未設定のソースは返さない', async () => {
    delete process.env.NOTION_READING_VOCAB_DB_ID;
    const { GET } = await import('@/app/api/sources/route');
    const body = await (await GET()).json();

    expect(body.sources.map((s: { id: string }) => s.id)).toEqual(['phrase']);
  });
});

describe('GET /api/sync', () => {
  it('source 指定でそのソースだけを取得する', async () => {
    const { GET } = await import('@/app/api/sync/route');
    const res = await GET(new NextRequest('http://localhost/api/sync?source=reading-vocab'));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ source: 'reading-vocab' });
    expect(mockFetchDueCards.mock.calls[0][0].id).toBe('reading-vocab');
  });

  it('source 未指定は phrase（既存クライアントとの後方互換）', async () => {
    const { GET } = await import('@/app/api/sync/route');
    const res = await GET(new NextRequest('http://localhost/api/sync'));

    expect(res.status).toBe(200);
    expect(mockFetchDueCards.mock.calls[0][0].id).toBe('phrase');
  });

  it('未知の source は 400 で拒否する', async () => {
    const { GET } = await import('@/app/api/sync/route');
    const res = await GET(new NextRequest('http://localhost/api/sync?source=bogus'));

    expect(res.status).toBe(400);
    expect(mockFetchDueCards).not.toHaveBeenCalled();
  });

  it('DB ID 未設定のソースは同期できない', async () => {
    delete process.env.NOTION_READING_VOCAB_DB_ID;
    const { GET } = await import('@/app/api/sync/route');
    const res = await GET(new NextRequest('http://localhost/api/sync?source=reading-vocab'));

    expect(res.status).toBe(400);
  });
});

describe('POST /api/study', () => {
  it('sourceId のソースへ SRS を書き込む', async () => {
    const { POST } = await import('@/app/api/study/route');
    const res = await POST(studyRequest({ ...BASE_PAYLOAD, sourceId: 'reading-vocab' }));

    expect(res.status).toBe(200);
    expect(mockUpdateCardAfterReview).toHaveBeenCalledTimes(1);
    expect(mockUpdateCardAfterReview.mock.calls[0][0].id).toBe('reading-vocab');
    expect(mockUpdateCardAfterReview.mock.calls[0][1]).toBe('item-1');
    // 状態参照も同一ソースに対して行う
    for (const call of mockFetchCardSrsState.mock.calls) {
      expect(call[0].id).toBe('reading-vocab');
    }
  });

  it('sourceId 省略時は phrase へ書き込む（旧オフラインキューを壊さない）', async () => {
    const { POST } = await import('@/app/api/study/route');
    const res = await POST(studyRequest(BASE_PAYLOAD));

    expect(res.status).toBe(200);
    expect(mockUpdateCardAfterReview.mock.calls[0][0].id).toBe('phrase');
  });

  it('未知の sourceId は 400 で拒否し、Notion へ書き込まない', async () => {
    const { POST } = await import('@/app/api/study/route');
    const res = await POST(studyRequest({ ...BASE_PAYLOAD, sourceId: 'bogus' }));

    expect(res.status).toBe(400);
    expect(mockUpdateCardAfterReview).not.toHaveBeenCalled();
    expect(mockWriteReviewLog).not.toHaveBeenCalled();
  });

  it('別ソースのカードIDは 404 になる（セッション混在の防止）', async () => {
    mockFetchCardSrsState.mockResolvedValue(null);
    const { POST } = await import('@/app/api/study/route');
    const res = await POST(studyRequest({ ...BASE_PAYLOAD, sourceId: 'reading-vocab' }));

    expect(res.status).toBe(404);
    expect(mockUpdateCardAfterReview).not.toHaveBeenCalled();
  });

  it('Review Log には sourceId 付きの payload を渡す', async () => {
    const { POST } = await import('@/app/api/study/route');
    await POST(studyRequest({ ...BASE_PAYLOAD, sourceId: 'reading-vocab' }));

    expect(mockWriteReviewLog.mock.calls[0][0].sourceId).toBe('reading-vocab');
  });
});
