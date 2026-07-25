'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { enqueue, queueCount, isQueueAvailable } from '@/lib/offline/queue';
import { flush } from '@/lib/offline/flush';
import type { PhraseCard, ReviewPayload, StudyDirection } from '@/types';

async function fetchCards(): Promise<PhraseCard[]> {
  const res = await fetch('/api/sync');
  if (!res.ok) throw new Error('カードの取得に失敗しました');
  const data = await res.json();
  return data.cards as PhraseCard[];
}

async function submitReview(payload: ReviewPayload) {
  const onLine = typeof navigator !== 'undefined' ? navigator.onLine : true;
  console.error('[B3] submitReview called. navigator.onLine =', onLine);

  // オフライン確定なら即座にキューへ（HTTP/2接続キャッシュによるfetchハングを防ぐ）
  if (!onLine) {
    console.error('[B3] offline path: enqueueing immediately');
    if (isQueueAvailable()) {
      await enqueue({ key: `${payload.sessionId}:${payload.itemId}`, payload, endpoint: '/api/study' });
      console.error('[B3] enqueued, returning');
      return { ok: true, queued: true };
    }
    throw new Error('復習記録の保存に失敗しました');
  }

  console.error('[B3] online path: calling fetch with 5s timeout');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => { console.error('[B3] AbortController fired'); controller.abort(); }, 5_000);

  let res: Response;
  try {
    res = await fetch('/api/study', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload }),
      signal: controller.signal,
    });
  } catch (err) {
    // ネットワークエラー・タイムアウト → キューへ
    console.error('[B3] fetch caught:', err);
    if (isQueueAvailable()) {
      await enqueue({ key: `${payload.sessionId}:${payload.itemId}`, payload, endpoint: '/api/study' });
      console.error('[B3] enqueued after fetch error, returning');
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

export function useStudyCards() {
  return useQuery({
    queryKey: ['study-cards'],
    queryFn: fetchCards,
  });
}

export function useSubmitReview() {
  return useMutation({
    mutationFn: ({ payload }: { payload: ReviewPayload }) => submitReview(payload),
  });
}

export function useQueueCount() {
  return useQuery({
    queryKey: ['queue-count'],
    queryFn: () => (isQueueAvailable() ? queueCount() : Promise.resolve(0)),
    refetchInterval: 10_000,
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
): ReviewPayload {
  return {
    itemId: card.id,
    itemType: 'phrase',
    result,
    direction,
    sessionId,
    reviewedAt: new Date().toISOString(),
  };
}
