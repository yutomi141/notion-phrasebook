/**
 * Notion に同じフレーズの行が重複していても、1セッションに同じ単語を2回出題しない。
 */
import { describe, it, expect } from 'vitest';
import { dedupeCards } from '@/lib/cards/dedupe';
import type { PhraseCard } from '@/types';

function card(overrides: Partial<PhraseCard> & Pick<PhraseCard, 'id' | 'phrase'>): PhraseCard {
  return {
    meaning: '意味',
    example: null,
    tags: [],
    status: 'New',
    intervalDays: 0,
    correctStreak: 0,
    reviewCount: 0,
    forgottenCount: 0,
    nextReview: null,
    lastReviewed: null,
    syncVersion: '',
    ...overrides,
  };
}

describe('dedupeCards', () => {
  it('同じフレーズの重複行は1枚にまとめる', () => {
    const result = dedupeCards([
      card({ id: 'a', phrase: 'It really comes down to [noun]' }),
      card({ id: 'b', phrase: 'Something else' }),
      card({ id: 'c', phrase: 'It really comes down to [noun]' }),
    ]);

    expect(result.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('前後空白・連続空白・大文字小文字の違いは同一フレーズとみなす', () => {
    const result = dedupeCards([
      card({ id: 'a', phrase: 'Comes  down to it' }),
      card({ id: 'b', phrase: '  comes down to it ' }),
    ]);

    expect(result).toHaveLength(1);
  });

  it('学習履歴が進んでいる行を残す', () => {
    const result = dedupeCards([
      card({ id: 'new', phrase: 'Same phrase', status: 'New' }),
      card({
        id: 'reviewing',
        phrase: 'Same phrase',
        status: 'Reviewing',
        reviewCount: 3,
        intervalDays: 3,
        correctStreak: 2,
      }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('reviewing');
  });

  it('重複がなければ並び順を変えない', () => {
    const input = [
      card({ id: 'a', phrase: 'A' }),
      card({ id: 'b', phrase: 'B' }),
      card({ id: 'c', phrase: 'C' }),
    ];

    expect(dedupeCards(input).map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('フレーズが空の行は判定できないためそのまま残す', () => {
    const result = dedupeCards([
      card({ id: 'a', phrase: '' }),
      card({ id: 'b', phrase: '   ' }),
    ]);

    expect(result.map((c) => c.id)).toEqual(['a', 'b']);
  });
});
