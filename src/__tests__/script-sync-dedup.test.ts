import { describe, it, expect } from 'vitest';
import { normalizeForDedup, parseBlock, nextOrderAfter } from '@/lib/notion/script-parser';

describe('nextOrderAfter', () => {
  it('既存 Order [1,2,3,4] → 新規は 5', () => {
    expect(nextOrderAfter([1, 2, 3, 4])).toBe(5);
  });

  it('既存 Order [1,3,7] → 新規は 8', () => {
    expect(nextOrderAfter([1, 3, 7])).toBe(8);
  });

  it('既存 0 件 → 新規は 1', () => {
    expect(nextOrderAfter([])).toBe(1);
  });
});

describe('同期重複チェック（dedup）', () => {
  it('同期対象がすべて既存なら新規作成 0 件', () => {
    const existingSentences = [
      "I'm a physics student.",
      'Fencing is all about creating and exploiting opportunities.',
    ];
    const blocks = existingSentences.map((s) => `${s} (ダミー訳)`);

    const existingNormalized = new Map(
      existingSentences.map((s) => [normalizeForDedup(s), true as const]),
    );

    let created = 0;
    let unchanged = 0;
    for (const text of blocks) {
      const { sentence } = parseBlock(text);
      if (existingNormalized.has(normalizeForDedup(sentence))) {
        unchanged++;
      } else {
        created++;
      }
    }

    expect(created).toBe(0);
    expect(unchanged).toBe(2);
  });

  it('1回目同期後に同じ本文を再同期しても新規作成 0 件', () => {
    const sentence = 'I am a student.';
    const block = `${sentence} (私は学生です。)`;

    const existingNormalized = new Map([[normalizeForDedup(sentence), true as const]]);
    const { sentence: parsed } = parseBlock(block);

    expect(existingNormalized.has(normalizeForDedup(parsed))).toBe(true);
  });

  it('カーリークォート版と通常版を同一と見なす', () => {
    const existingSentence = "opponent's balance";
    const blockSentence = 'opponent’s balance'; // curly right single quote
    expect(normalizeForDedup(existingSentence)).toBe(normalizeForDedup(blockSentence));
  });

  it('剣道文の内側括弧が保持され、既存Sentenceと正しく照合される', () => {
    const existing =
      'In Kendo, we call this "striking after the thought." ' +
      'You induce the opponent to move, create a gap in their defense, ' +
      'and strike at the exact moment they lose their balance.';
    const block =
      existing +
      ' (剣道ではこれを「あとの先（相手を動かして打つ）」のように捉えます。)';

    const { sentence: parsed } = parseBlock(block);
    expect(normalizeForDedup(parsed)).toBe(normalizeForDedup(existing));
  });
});
