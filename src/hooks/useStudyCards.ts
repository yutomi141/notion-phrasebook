'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import type { PhraseCard, ReviewPayload, StudyDirection } from '@/types';

async function fetchCards(): Promise<PhraseCard[]> {
  const res = await fetch('/api/sync');
  if (!res.ok) throw new Error('カードの取得に失敗しました');
  const data = await res.json();
  return data.cards as PhraseCard[];
}

async function submitReview(payload: ReviewPayload) {
  const res = await fetch('/api/study', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload }),
  });
  if (!res.ok) throw new Error('復習記録の保存に失敗しました');
  return res.json();
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
