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
