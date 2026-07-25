'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { enqueue, isQueueAvailable } from '@/lib/offline/queue';
import { flush } from '@/lib/offline/flush';
import type { ScriptCard, SentenceCard, ReviewPayload, StudyDirection } from '@/types';

async function fetchScripts(): Promise<ScriptCard[]> {
  const res = await fetch('/api/scripts');
  if (!res.ok) throw new Error('スクリプトの取得に失敗しました');
  const data = await res.json();
  return data.scripts as ScriptCard[];
}

async function fetchScriptSentences(scriptId: string): Promise<SentenceCard[]> {
  const res = await fetch(`/api/scripts/${scriptId}/sentences`);
  if (!res.ok) throw new Error('文の取得に失敗しました');
  const data = await res.json();
  return data.sentences as SentenceCard[];
}

async function fetchDueSentences(): Promise<SentenceCard[]> {
  const res = await fetch('/api/sentence-study');
  if (!res.ok) throw new Error('本日の文の取得に失敗しました');
  const data = await res.json();
  return data.sentences as SentenceCard[];
}

async function submitSentenceReview(payload: ReviewPayload) {
  // オフライン確定なら即座にキューへ
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    if (isQueueAvailable()) {
      await enqueue({ key: `${payload.sessionId}:${payload.itemId}`, payload, endpoint: '/api/sentence-study' });
      return { ok: true, queued: true };
    }
    throw new Error('復習記録の保存に失敗しました');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8_000);

  let res: Response;
  try {
    res = await fetch('/api/sentence-study', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload }),
      signal: controller.signal,
    });
  } catch {
    // ネットワークエラー・タイムアウト → キューへ
    if (isQueueAvailable()) {
      await enqueue({ key: `${payload.sessionId}:${payload.itemId}`, payload, endpoint: '/api/sentence-study' });
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

  if (res.status >= 400 && res.status < 500) {
    throw new Error(`復習記録の保存に失敗しました (${res.status})`);
  }

  if (isQueueAvailable()) {
    await enqueue({ key: `${payload.sessionId}:${payload.itemId}`, payload, endpoint: '/api/sentence-study' });
    return { ok: true, queued: true };
  }

  throw new Error('復習記録の保存に失敗しました');
}

export function useScripts() {
  return useQuery({
    queryKey: ['scripts'],
    queryFn: fetchScripts,
  });
}

export function useScriptSentences(scriptId: string) {
  return useQuery({
    queryKey: ['script-sentences', scriptId],
    queryFn: () => fetchScriptSentences(scriptId),
    enabled: !!scriptId,
  });
}

export function useDueSentences() {
  return useQuery({
    queryKey: ['due-sentences'],
    queryFn: fetchDueSentences,
  });
}

export function useSubmitSentenceReview() {
  return useMutation({
    mutationFn: ({ payload }: { payload: ReviewPayload }) => submitSentenceReview(payload),
  });
}

export function makeSentenceReviewPayload(
  sentence: SentenceCard,
  result: 'remembered' | 'forgotten',
  direction: StudyDirection,
  sessionId: string,
): ReviewPayload {
  return {
    itemId: sentence.id,
    itemType: 'sentence',
    result,
    direction,
    sessionId,
    reviewedAt: new Date().toISOString(),
  };
}
