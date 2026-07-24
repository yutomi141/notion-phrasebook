'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
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
  const res = await fetch('/api/sentence-study', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload }),
  });
  if (!res.ok) throw new Error('復習記録の保存に失敗しました');
  return res.json();
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
