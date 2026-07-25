/**
 * Script本文の解析・正規化 — 純粋関数、Notion API不要
 */

/**
 * ブロックテキスト "英文 (日本語訳)" を英文とMeaningに分割する。
 *
 * 末尾の対訳括弧をネスト深度でトレースするため、
 * 日本語訳内に （括弧） が含まれていても正しく分割できる。
 */
export function parseBlock(text: string): { sentence: string; meaning: string } {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { sentence: '', meaning: '' };

  // 末尾が ) または ） で終わらなければ対訳なし
  if (!/[）)]\s*$/.test(trimmed)) {
    return { sentence: trimmed, meaning: '' };
  }

  // 末尾の閉じ括弧位置（半角・全角どちらか遅い方）
  const lastClose = Math.max(trimmed.lastIndexOf(')'), trimmed.lastIndexOf('）'));

  // 閉じ括弧からネスト深度をトレースして対応する開き括弧を探す
  let depth = 0;
  let openPos = -1;
  for (let i = lastClose; i >= 0; i--) {
    const ch = trimmed[i];
    if (ch === ')' || ch === '）') depth++;
    else if (ch === '(' || ch === '（') {
      depth--;
      if (depth === 0) {
        openPos = i;
        break;
      }
    }
  }

  // 文頭 (openPos===0) または見つからなければ対訳なし
  if (openPos <= 0) return { sentence: trimmed, meaning: '' };

  const enPart = trimmed.slice(0, openPos).trim();
  const jaPart = trimmed.slice(openPos + 1, lastClose).trim();

  // 括弧内に日本語文字（ひらがな・カタカナ・漢字）がなければ対訳と見なさない
  const hasJapanese = /[぀-ヿ一-鿿㐀-䶿]/.test(jaPart);
  if (!hasJapanese || enPart.length === 0) {
    return { sentence: trimmed, meaning: '' };
  }

  return { sentence: enPart, meaning: jaPart };
}

/**
 * 重複判定用正規化。
 * カーリークォート・NBSP・大文字小文字・句読点を統一する。
 * opponent's と opponent’s が同一になるよう引用符を先に正規化する。
 */
export function normalizeForDedup(text: string): string {
  return text
    // 非標準スペース（NBSP・thin space 等）を通常スペースへ
    .replace(/[        ﻿]/g, ' ')
    // カーリー系アポストロフィ → 直立アポストロフィ
    .replace(/[''ʼ‘’ʼ]/g, "'")
    // カーリーダブルクォート → 直立ダブルクォート
    .replace(/["""“”]/g, '"')
    .toLowerCase()
    .trim()
    // 単語文字・スペース・アポストロフィ以外を除去
    .replace(/[^\w\s']/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * 新規 Sentence の Order 値を計算する。
 * 既存 Order の最大値 + 1。既存が0件なら 1 を返す。
 */
export function nextOrderAfter(existingOrders: number[]): number {
  return Math.max(0, ...existingOrders) + 1;
}

export interface ParsedEntry {
  sentence: string;
  meaning: string;
}

export interface DBEntry {
  id: string;
  sentence: string;
  meaning: string;
  order: number;
}

export interface SyncPlan {
  toCreate: ParsedEntry[];
  toUpdate: Array<{ id: string; meaning: string }>;
  toArchive: Array<{ id: string; sentence: string }>;
  toReorder: Array<{ id: string; newOrder: number }>;
  unchanged: number;
}

const ARCHIVE_THRESHOLD = 0.3;

/**
 * 本文パース結果とDB既存データを突き合わせてDiffを計算する純粋関数。
 * Notion呼び出しを含まないため、テストとdry-runに使用できる。
 */
export function planSync(
  parsed: ParsedEntry[],
  existing: DBEntry[],
): { plan: SyncPlan; tooManyArchives: boolean; archiveRatio: number } {
  // 本文の出現順で正規化キー → ParsedEntry のマップ
  const parsedByKey = new Map<string, { entry: ParsedEntry; parsedIndex: number }>();
  for (let i = 0; i < parsed.length; i++) {
    const key = normalizeForDedup(parsed[i].sentence);
    if (!parsedByKey.has(key)) {
      parsedByKey.set(key, { entry: parsed[i], parsedIndex: i });
    }
  }

  // 既存DBを正規化キー → DBEntry のマップ
  const existingByKey = new Map<string, DBEntry>();
  for (const e of existing) {
    existingByKey.set(normalizeForDedup(e.sentence), e);
  }

  const plan: SyncPlan = {
    toCreate: [],
    toUpdate: [],
    toArchive: [],
    toReorder: [],
    unchanged: 0,
  };

  // 本文側を走査
  for (const [key, { entry, parsedIndex }] of parsedByKey.entries()) {
    const dbEntry = existingByKey.get(key);
    if (!dbEntry) {
      plan.toCreate.push(entry);
    } else {
      // Meaning の変化チェック
      if (entry.meaning !== dbEntry.meaning) {
        plan.toUpdate.push({ id: dbEntry.id, meaning: entry.meaning });
      }
      // Order の変化チェック（本文順は 1-based）
      const expectedOrder = parsedIndex + 1;
      if (dbEntry.order !== expectedOrder) {
        plan.toReorder.push({ id: dbEntry.id, newOrder: expectedOrder });
      }
      if (entry.meaning === dbEntry.meaning && dbEntry.order === parsedIndex + 1) {
        plan.unchanged++;
      }
    }
  }

  // DBにあり本文にない → アーカイブ候補
  for (const [key, dbEntry] of existingByKey.entries()) {
    if (!parsedByKey.has(key)) {
      plan.toArchive.push({ id: dbEntry.id, sentence: dbEntry.sentence });
    }
  }

  const archiveRatio = existing.length > 0 ? plan.toArchive.length / existing.length : 0;
  const tooManyArchives = archiveRatio > ARCHIVE_THRESHOLD;

  return { plan, tooManyArchives, archiveRatio };
}
