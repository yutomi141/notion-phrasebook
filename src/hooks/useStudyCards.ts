'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueue, queueCount, isQueueAvailable } from '@/lib/offline/queue';
import { flush } from '@/lib/offline/flush';
import type {
  CardSourceId,
  PhraseCard,
  ReviewPayload,
  StudyDirection,
  StudySource,
} from '@/types';

async function fetchCards(sourceId: CardSourceId): Promise<PhraseCard[]> {
  const res = await fetch(`/api/sync?source=${encodeURIComponent(sourceId)}`);
  if (!res.ok) throw new Error('カードの取得に失敗しました');
  const data = await res.json();
  return data.cards as PhraseCard[];
}

async function fetchSources(): Promise<StudySource[]> {
  const res = await fetch('/api/sources');
  if (!res.ok) throw new Error('学習モードの取得に失敗しました');
  const data = await res.json();
  return data.sources as StudySource[];
}

async function submitReview(payload: ReviewPayload) {
  // オフライン確定なら即座にキューへ（HTTP/2接続キャッシュによるfetchハングを防ぐ）
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    if (isQueueAvailable()) {
      await enqueue({ key: `${payload.sessionId}:${payload.itemId}`, payload, endpoint: '/api/study' });
      return { ok: true, queued: true };
    }
    throw new Error('復習記録の保存に失敗しました');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8_000);

  let res: Response;
  try {
    res = await fetch('/api/study', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload }),
      signal: controller.signal,
    });
  } catch {
    // ネットワークエラー・タイムアウト → キューへ
    if (isQueueAvailable()) {
      await enqueue({ key: `${payload.sessionId}:${payload.itemId}`, payload, endpoint: '/api/study' });
      return { ok: true, queued: true };
    }
    throw new Error('復習記録の保存に失敗しました');
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.ok) {
    flush().catch(() => undefined);
    return res.json();
  }

  // 4xx: バリデーションエラー・競合等 → キューに入れない
  if (res.status >= 400 && res.status < 500) {
    throw new Error(`復習記録の保存に失敗しました (${res.status})`);
  }

  // 5xx → キューへ
  if (isQueueAvailable()) {
    await enqueue({ key: `${payload.sessionId}:${payload.itemId}`, payload, endpoint: '/api/study' });
    return { ok: true, queued: true };
  }

  throw new Error('復習記録の保存に失敗しました');
}

/** ソースごとにキャッシュを分離する — 別モードのカードが同一セッションへ混ざらない */
export function useStudyCards(sourceId: CardSourceId) {
  return useQuery({
    queryKey: ['study-cards', sourceId],
    queryFn: () => fetchCards(sourceId),
  });
}

export function useStudySources() {
  return useQuery({
    queryKey: ['study-sources'],
    queryFn: fetchSources,
    staleTime: Infinity,
  });
}

export function useSubmitReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payload }: { payload: ReviewPayload }) => submitReview(payload),
    networkMode: 'always',
    onSettled: () => {
      // キュー件数バッジを即座に更新
      queryClient.invalidateQueries({ queryKey: ['queue-count'] });
    },
  });
}

export function useQueueCount() {
  return useQuery({
    queryKey: ['queue-count'],
    queryFn: () => (isQueueAvailable() ? queueCount() : Promise.resolve(0)),
    refetchInterval: 5_000,
    networkMode: 'always',
  });
}

export function generateSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeReviewPayload(
  card: PhraseCard,
  result: 'remembered' | 'forgotten',
  direction: StudyDirection,
  sessionId: string,
  sourceId: CardSourceId = 'phrase',
): ReviewPayload {
  return {
    itemId: card.id,
    itemType: 'phrase',
    result,
    direction,
    sessionId,
    reviewedAt: new Date().toISOString(),
    sourceId,
  };
}
