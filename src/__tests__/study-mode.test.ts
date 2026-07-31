/**
 * FR-05 / ZA-04: モード選択の記憶と、既定出題方向のテスト。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  FALLBACK_SOURCE_ID,
  loadDirection,
  loadSourceId,
  resolveStoredDirection,
  resolveStoredSourceId,
  saveDirection,
  saveSourceId,
} from '@/lib/study-mode';
import type { StudySource } from '@/types';

const PHRASE: StudySource = { id: 'phrase', label: 'フレーズ', defaultDirection: 'EN_TO_JA' };
const VOCAB: StudySource = {
  id: 'reading-vocab',
  label: 'リーディング語彙',
  defaultDirection: 'EN_TO_JA',
};
const BOTH = [PHRASE, VOCAB];

// jsdom の localStorage 実装差を避けるため、テスト内で最小限のスタブを使う
beforeEach(() => {
  const store = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    },
  });
});

describe('モードの記憶（ZA-04）', () => {
  it('記憶がなければ先頭のソースで始まる', () => {
    expect(resolveStoredSourceId(null, BOTH)).toBe('phrase');
  });

  it('記憶したモードを次回も復元する', () => {
    saveSourceId('reading-vocab');
    expect(loadSourceId(BOTH)).toBe('reading-vocab');

    saveSourceId('phrase');
    expect(loadSourceId(BOTH)).toBe('phrase');
  });

  it('記憶されたモードが無効化されていれば先頭へフォールバックする', () => {
    // Reading Vocab DB の設定を外した状況
    expect(resolveStoredSourceId('reading-vocab', [PHRASE])).toBe('phrase');
  });

  it('未知の値が保存されていても壊れない', () => {
    expect(resolveStoredSourceId('bogus', BOTH)).toBe('phrase');
  });

  it('有効なソースが1つもなければ既定値を返す', () => {
    expect(resolveStoredSourceId('reading-vocab', [])).toBe(FALLBACK_SOURCE_ID);
  });
});

describe('出題方向（FR-05）', () => {
  it('リーディング語彙の既定出題方向は EN→JA', () => {
    expect(loadDirection('reading-vocab', VOCAB.defaultDirection)).toBe('EN_TO_JA');
  });

  it('記憶がなければソース既定を使う', () => {
    expect(resolveStoredDirection(null, 'EN_TO_JA')).toBe('EN_TO_JA');
    expect(resolveStoredDirection(null, 'JA_TO_EN')).toBe('JA_TO_EN');
  });

  it('両モードとも JA→EN を選択・記憶できる', () => {
    saveDirection('reading-vocab', 'JA_TO_EN');
    expect(loadDirection('reading-vocab', 'EN_TO_JA')).toBe('JA_TO_EN');

    saveDirection('phrase', 'JA_TO_EN');
    expect(loadDirection('phrase', 'EN_TO_JA')).toBe('JA_TO_EN');
  });

  it('出題方向はモードごとに独立して記憶される', () => {
    saveDirection('phrase', 'JA_TO_EN');

    expect(loadDirection('phrase', 'EN_TO_JA')).toBe('JA_TO_EN');
    expect(loadDirection('reading-vocab', 'EN_TO_JA')).toBe('EN_TO_JA');
  });

  it('不正な保存値はソース既定へ戻す', () => {
    expect(resolveStoredDirection('SIDEWAYS', 'EN_TO_JA')).toBe('EN_TO_JA');
    expect(resolveStoredDirection('', 'EN_TO_JA')).toBe('EN_TO_JA');
  });
});
