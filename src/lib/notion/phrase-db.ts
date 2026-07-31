import 'server-only';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import {
  fetchDueCards,
  fetchCardSrsState,
  updateCardAfterReview,
  mapPageToCard,
  CANONICAL_CARD_PROPS,
  type CardSrsState,
} from './card-db';
import { getCardSource } from '@/lib/schema/card-sources';
import type { PhraseCard } from '@/types';

/**
 * Phrase DB 専用の薄いラッパ。実装は card-db.ts に一本化されている。
 * 既存の呼び出し元との後方互換のために残している。
 */

function phraseSource() {
  const source = getCardSource('phrase');
  if (!source) throw new Error('Phrase DB is not configured (NOTION_PHRASE_DB_ID)');
  return source;
}

export function mapPageToPhrase(page: PageObjectResponse): PhraseCard {
  return mapPageToCard(page, CANONICAL_CARD_PROPS);
}

export async function fetchDuePhrasesFromNotion(): Promise<PhraseCard[]> {
  return fetchDueCards(phraseSource());
}

export type PhraseSrsState = CardSrsState;

export async function fetchPhraseSrsState(phraseId: string): Promise<PhraseSrsState | null> {
  return fetchCardSrsState(phraseSource(), phraseId);
}

export async function updatePhraseAfterReview(
  phraseId: string,
  status: 'New' | 'Reviewing' | 'Mastered',
  intervalDays: number,
  newStreak: number,
  nextReviewDate: string,
  reviewedAt: string,
  newReviewCount: number,
  newForgottenCount: number,
  syncVersion: string,
): Promise<void> {
  return updateCardAfterReview(phraseSource(), phraseId, {
    status,
    intervalDays,
    correctStreak: newStreak,
    nextReviewDate,
    reviewedAt,
    reviewCount: newReviewCount,
    forgottenCount: newForgottenCount,
    syncVersion,
  });
}
