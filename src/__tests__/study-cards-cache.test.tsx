/**
 * 回答後に「今日の復習」の件数が減ることのテスト。
 * 回答したカードを未復習リストから楽観的に取り除き、保存失敗時だけ戻す。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSubmitReview, studyCardsKey } from '@/hooks/useStudyCards';
import type { CardSourceId, PhraseCard, ReviewPayload } from '@/types';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('@/lib/offline/queue', () => ({
  enqueue: vi.fn().mockResolvedValue(undefined),
  queueCount: vi.fn().mockResolvedValue(0),
  isQueueAvailable: vi.fn(() => false),
}));
vi.mock('@/lib/offline/flush', () => ({ flush: vi.fn().mockResolvedValue(undefined) }));

function makeCard(id: string): PhraseCard {
  return {
    id, phrase: id, meaning: `${id}の意味`, example: null, tags: [],
    status: 'New', intervalDays: 0, correctStreak: 0, reviewCount: 0,
    forgottenCount: 0, nextReview: null, lastReviewed: null, syncVersion: '',
  };
}

function makePayload(itemId: string, sourceId?: CardSourceId): ReviewPayload {
  return {
    itemId, itemType: 'phrase', result: 'remembered', direction: 'EN_TO_JA',
    sessionId: 'session-1', reviewedAt: '2026-07-31T12:00:00.000Z', sourceId,
  };
}

function setup(sourceId: CardSourceId, cards: PhraseCard[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(studyCardsKey(sourceId), cards);

  const { result } = renderHook(() => useSubmitReview(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
  const remaining = () =>
    queryClient.getQueryData<PhraseCard[]>(studyCardsKey(sourceId)) ?? [];
  return { result, queryClient, remaining };
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
});

describe('回答後の「今日の復習」件数', () => {
  it('回答したカードが未復習リストから取り除かれる', async () => {
    const { result, remaining } = setup('phrase', [makeCard('a'), makeCard('b'), makeCard('c')]);
    expect(remaining()).toHaveLength(3);

    await act(async () => {
      result.current.mutate({ payload: makePayload('b') });
    });

    await waitFor(() => expect(remaining()).toHaveLength(2));
    expect(remaining().map((c) => c.id)).toEqual(['a', 'c']);
  });

  it('連続で回答するたびに件数が減る', async () => {
    const { result, remaining } = setup('phrase', [makeCard('a'), makeCard('b'), makeCard('c')]);

    for (const id of ['a', 'b']) {
      await act(async () => {
        result.current.mutate({ payload: makePayload(id) });
      });
      await waitFor(() => expect(result.current.isPending).toBe(false));
    }

    expect(remaining().map((c) => c.id)).toEqual(['c']);
  });

  it('リーディング語彙の回答はそのソースの件数だけを減らす', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(studyCardsKey('phrase'), [makeCard('p1'), makeCard('p2')]);
    queryClient.setQueryData(studyCardsKey('reading-vocab'), [makeCard('v1'), makeCard('v2')]);

    const { result } = renderHook(() => useSubmitReview(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    await act(async () => {
      result.current.mutate({ payload: makePayload('v1', 'reading-vocab') });
    });

    await waitFor(() =>
      expect(queryClient.getQueryData<PhraseCard[]>(studyCardsKey('reading-vocab'))).toHaveLength(1),
    );
    // フレーズ側の件数は変わらない
    expect(queryClient.getQueryData<PhraseCard[]>(studyCardsKey('phrase'))).toHaveLength(2);
  });

  it('sourceId 省略時は phrase の件数を減らす（旧クライアント互換）', async () => {
    const { result, remaining } = setup('phrase', [makeCard('a'), makeCard('b')]);

    await act(async () => {
      result.current.mutate({ payload: makePayload('a', undefined) });
    });

    await waitFor(() => expect(remaining().map((c) => c.id)).toEqual(['b']));
  });

  it('保存が確定的に失敗したカードは未復習リストへ戻る', async () => {
    // 4xx はキューに入れず失敗として扱われる
    mockFetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({}) });
    const { result, remaining } = setup('phrase', [makeCard('a'), makeCard('b')]);

    await act(async () => {
      result.current.mutate({ payload: makePayload('a') });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(remaining().map((c) => c.id).sort()).toEqual(['a', 'b']);
  });

  it('失敗時にカードを二重登録しない', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({}) });
    const { result, remaining } = setup('phrase', [makeCard('a')]);

    await act(async () => {
      result.current.mutate({ payload: makePayload('a') });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    await act(async () => {
      result.current.mutate({ payload: makePayload('a') });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(remaining()).toHaveLength(1);
  });

  it('キャッシュが未取得でも例外にならない', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const { result } = renderHook(() => useSubmitReview(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    await act(async () => {
      result.current.mutate({ payload: makePayload('a') });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(studyCardsKey('phrase'))).toBeUndefined();
  });
});
