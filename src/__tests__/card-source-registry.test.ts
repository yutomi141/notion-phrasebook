/**
 * カードソースレジストリのテスト。
 * 受け入れ条件「設定に DB ID を追加するだけで同期対象になる」を検証する。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env.NOTION_PHRASE_DB_ID = 'phrase-db-id';
  process.env.NOTION_REVIEW_LOG_DB_ID = 'review-log-db-id';
  delete process.env.NOTION_READING_VOCAB_DB_ID;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

async function loadRegistry() {
  return import('@/lib/schema/card-sources');
}

describe('カードソースレジストリ', () => {
  it('DB ID が未設定のソースは同期対象に現れない', async () => {
    const { listCardSources, getCardSource } = await loadRegistry();

    expect(listCardSources().map((s) => s.id)).toEqual(['phrase']);
    expect(getCardSource('reading-vocab')).toBeNull();
  });

  it('DB ID を設定するだけでリーディング語彙が同期対象になる', async () => {
    process.env.NOTION_READING_VOCAB_DB_ID = 'reading-vocab-db-id';
    const { listCardSources, getCardSource } = await loadRegistry();

    expect(listCardSources().map((s) => s.id)).toEqual(['phrase', 'reading-vocab']);

    const source = getCardSource('reading-vocab');
    expect(source).not.toBeNull();
    expect(source!.databaseId).toBe('reading-vocab-db-id');
    expect(source!.label).toBe('リーディング語彙');
  });

  it('リーディング語彙の既定出題方向は EN→JA', async () => {
    process.env.NOTION_READING_VOCAB_DB_ID = 'reading-vocab-db-id';
    const { getCardSource } = await loadRegistry();

    expect(getCardSource('reading-vocab')!.defaultDirection).toBe('EN_TO_JA');
  });

  it('ソースごとに Review Log の Item Type と relation が分かれている', async () => {
    process.env.NOTION_READING_VOCAB_DB_ID = 'reading-vocab-db-id';
    const { getCardSource } = await loadRegistry();

    const phrase = getCardSource('phrase')!;
    const vocab = getCardSource('reading-vocab')!;

    expect(phrase.reviewLogItemType).toBe('Phrase');
    expect(vocab.reviewLogItemType).toBe('Reading Vocab');
    expect(phrase.reviewLogRelationProp).not.toBe(vocab.reviewLogRelationProp);
  });

  it('sourceId 省略時は phrase へフォールバックする（旧キューとの後方互換）', async () => {
    const { resolveCardSource, DEFAULT_CARD_SOURCE_ID } = await loadRegistry();

    expect(DEFAULT_CARD_SOURCE_ID).toBe('phrase');
    expect(resolveCardSource(undefined)!.id).toBe('phrase');
    expect(resolveCardSource(null)!.id).toBe('phrase');
  });

  it('未知の sourceId は解決しない', async () => {
    const { resolveCardSource } = await loadRegistry();

    expect(resolveCardSource('unknown-source')).toBeNull();
    expect(resolveCardSource('')).toBeNull();
  });
});
