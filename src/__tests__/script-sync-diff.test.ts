/**
 * I-8: Script同期の差分計算テスト（planSync 純粋関数）
 */
import { describe, it, expect } from 'vitest';
import { planSync, normalizeForDedup } from '@/lib/notion/script-parser';
import type { ParsedEntry, DBEntry } from '@/lib/notion/script-parser';

const existing27: DBEntry[] = [
  { id: 'e1', sentence: "I'm a physics student.", meaning: '私は物理学の学生です。', order: 1 },
  { id: 'e2', sentence: 'Programming and physics share a common foundation: thinking in systems.', meaning: 'プログラミングと物理学は共通の基盤を持つ。', order: 2 },
  { id: 'e3', sentence: 'In fencing, every action is a calculated risk.', meaning: '剣道では、すべての行動が計算されたリスクだ。', order: 3 },
];

describe('I-8: planSync — 差分計算（純粋関数）', () => {
  it('1. 本文とDBが完全一致 → すべてunchanged', () => {
    const parsed: ParsedEntry[] = existing27.map((e) => ({ sentence: e.sentence, meaning: e.meaning }));
    const { plan, tooManyArchives } = planSync(parsed, existing27);
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.toArchive).toHaveLength(0);
    expect(plan.unchanged).toBe(3);
    expect(tooManyArchives).toBe(false);
  });

  it('2. 本文に1文追加 → created: 1、既存はunchanged', () => {
    const parsed: ParsedEntry[] = [
      ...existing27.map((e) => ({ sentence: e.sentence, meaning: e.meaning })),
      { sentence: 'New sentence added.', meaning: '新しい文が追加された。' },
    ];
    const { plan } = planSync(parsed, existing27);
    expect(plan.toCreate).toHaveLength(1);
    expect(plan.toCreate[0].sentence).toBe('New sentence added.');
    expect(plan.toArchive).toHaveLength(0);
    expect(plan.unchanged).toBe(3);
  });

  it('3. 本文から1文削除 → archived: 1、他はunchanged', () => {
    const parsed: ParsedEntry[] = [
      { sentence: existing27[0].sentence, meaning: existing27[0].meaning },
      { sentence: existing27[1].sentence, meaning: existing27[1].meaning },
      // existing27[2] は削除
    ];
    const { plan } = planSync(parsed, existing27);
    expect(plan.toArchive).toHaveLength(1);
    expect(plan.toArchive[0].id).toBe('e3');
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.unchanged).toBe(2);
  });

  it('4. Meaningのみ変更 → updated: 1、SRS系には触れない', () => {
    const parsed: ParsedEntry[] = existing27.map((e, i) => ({
      sentence: e.sentence,
      meaning: i === 0 ? '更新された意味。' : e.meaning,
    }));
    const { plan } = planSync(parsed, existing27);
    expect(plan.toUpdate).toHaveLength(1);
    expect(plan.toUpdate[0].id).toBe('e1');
    expect(plan.toUpdate[0].meaning).toBe('更新された意味。');
    expect(plan.toArchive).toHaveLength(0);
    expect(plan.toCreate).toHaveLength(0);
  });

  it('5. 文順入れ替え → reordered、Orderが本文順に一致', () => {
    const parsed: ParsedEntry[] = [
      { sentence: existing27[2].sentence, meaning: existing27[2].meaning }, // index 0 → order 1
      { sentence: existing27[0].sentence, meaning: existing27[0].meaning }, // index 1 → order 2
      { sentence: existing27[1].sentence, meaning: existing27[1].meaning }, // index 2 → order 3
    ];
    const { plan } = planSync(parsed, existing27);
    expect(plan.toReorder.length).toBeGreaterThan(0);
    const e3reorder = plan.toReorder.find((r) => r.id === 'e3');
    expect(e3reorder?.newOrder).toBe(1);
    const e1reorder = plan.toReorder.find((r) => r.id === 'e1');
    expect(e1reorder?.newOrder).toBe(2);
  });

  it('6. 31%以上の削除 → tooManyArchives=true, force=falseでブロック', () => {
    // 3文中2文削除 (66%) → 閾値超え
    const parsed: ParsedEntry[] = [
      { sentence: existing27[0].sentence, meaning: existing27[0].meaning },
    ];
    const { plan, tooManyArchives, archiveRatio } = planSync(parsed, existing27);
    expect(tooManyArchives).toBe(true);
    expect(plan.toArchive).toHaveLength(2);
    expect(archiveRatio).toBeGreaterThan(0.3);
  });

  it('7. スマートアポストロフィ・NBSP等の表記揺れが吸収される', () => {
    const dbSentence = "opponent's balance";
    const blockSentence = 'opponent’s balance'; // RIGHT SINGLE QUOTATION MARK
    const dbEntries: DBEntry[] = [{ id: 'x1', sentence: dbSentence, meaning: '相手のバランス', order: 1 }];
    const parsedEntries: ParsedEntry[] = [{ sentence: blockSentence, meaning: '相手のバランス' }];

    expect(normalizeForDedup(dbSentence)).toBe(normalizeForDedup(blockSentence));

    const { plan } = planSync(parsedEntries, dbEntries);
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.toArchive).toHaveLength(0);
    expect(plan.unchanged).toBe(1);
  });
});
