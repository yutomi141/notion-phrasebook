import type { PhraseCard } from '@/types';

/**
 * 同じフレーズが Notion に重複行として存在しても、1セッションに2回出題しないための正規化。
 * 前後空白・連続空白・大文字小文字の違いは同一フレーズとみなす。
 */
function dedupeKey(card: PhraseCard): string | null {
  const key = card.phrase.trim().replace(/\s+/g, ' ').toLowerCase();
  return key.length > 0 ? key : null;
}

/** 学習履歴がより進んでいる行を残す（履歴を捨てないため） */
function isMoreAdvanced(candidate: PhraseCard, current: PhraseCard): boolean {
  if (candidate.reviewCount !== current.reviewCount) {
    return candidate.reviewCount > current.reviewCount;
  }
  if (candidate.intervalDays !== current.intervalDays) {
    return candidate.intervalDays > current.intervalDays;
  }
  return candidate.correctStreak > current.correctStreak;
}

/**
 * 同一フレーズの重複カードを1枚にまとめる。
 * 元の並び順は保持し、残す行だけを履歴の進んでいるものへ差し替える。
 * フレーズが空の行は判定できないためそのまま残す。
 */
export function dedupeCards(cards: PhraseCard[]): PhraseCard[] {
  const result: PhraseCard[] = [];
  const indexByKey = new Map<string, number>();

  for (const card of cards) {
    const key = dedupeKey(card);
    if (key === null) {
      result.push(card);
      continue;
    }

    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      indexByKey.set(key, result.length);
      result.push(card);
      continue;
    }

    if (isMoreAdvanced(card, result[existingIndex])) {
      result[existingIndex] = card;
    }
  }

  return result;
}
