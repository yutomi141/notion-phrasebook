/**
 * ZA-01: プロパティ名の自動検出テスト。
 * 固定文字列に依存せず、リネーム・順序違い・欠落に耐えることを検証する。
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/notion/client', () => ({ notion: {} }));

import { buildPropertyMap } from '@/lib/notion/card-source-schema';

/** Reading Vocab DB の実スキーマ */
const READING_VOCAB_SCHEMA: Record<string, string> = {
  'Phrase': 'title',
  'Meaning': 'rich_text',
  'Example': 'rich_text',
  'Tags': 'multi_select',
  'ステータス': 'status',
  'Source Type': 'select',
  'Source Reference': 'rich_text',
  'Normalized Phrase': 'rich_text',
  'Last Reviewed': 'date',
  'Next Review': 'date',
  'Interval Days': 'number',
  'Correct Streak': 'number',
  'Review Count': 'number',
  'Forgotten Count': 'number',
  'Sync Version': 'rich_text',
  '登録日': 'created_time',
};

describe('カードソースのプロパティ自動検出', () => {
  it('Reading Vocab DB の実スキーマを正しく解決する', () => {
    const map = buildPropertyMap(READING_VOCAB_SCHEMA);

    expect(map.PHRASE).toBe('Phrase');
    expect(map.MEANING).toBe('Meaning');
    expect(map.EXAMPLE).toBe('Example');
    expect(map.TAGS).toBe('Tags');
    expect(map.STATUS).toBe('ステータス');
    expect(map.NEXT_REVIEW).toBe('Next Review');
    expect(map.LAST_REVIEWED).toBe('Last Reviewed');
    expect(map.INTERVAL_DAYS).toBe('Interval Days');
    expect(map.CORRECT_STREAK).toBe('Correct Streak');
    expect(map.REVIEW_COUNT).toBe('Review Count');
    expect(map.FORGOTTEN_COUNT).toBe('Forgotten Count');
    expect(map.SYNC_VERSION).toBe('Sync Version');
    expect(map.SOURCE_REFERENCE).toBe('Source Reference');
    expect(map.NORMALIZED_PHRASE).toBe('Normalized Phrase');
  });

  it('大文字小文字・区切り記号の違いを吸収する', () => {
    const map = buildPropertyMap({
      'phrase': 'title',
      'MEANING': 'rich_text',
      'next_review': 'date',
      'INTERVAL-DAYS': 'number',
      'correct streak': 'number',
    });

    expect(map.PHRASE).toBe('phrase');
    expect(map.MEANING).toBe('MEANING');
    expect(map.NEXT_REVIEW).toBe('next_review');
    expect(map.INTERVAL_DAYS).toBe('INTERVAL-DAYS');
    expect(map.CORRECT_STREAK).toBe('correct streak');
  });

  it('別名でリネームされたプロパティを検出する', () => {
    const map = buildPropertyMap({
      'Word': 'title',
      'Japanese': 'rich_text',
      'Context': 'rich_text',
      'Category': 'multi_select',
      'Status': 'status',
      'Due': 'date',
      'Interval': 'number',
      'Streak': 'number',
    });

    expect(map.PHRASE).toBe('Word');
    expect(map.MEANING).toBe('Japanese');
    expect(map.EXAMPLE).toBe('Context');
    expect(map.TAGS).toBe('Category');
    expect(map.STATUS).toBe('Status');
    expect(map.NEXT_REVIEW).toBe('Due');
    expect(map.INTERVAL_DAYS).toBe('Interval');
    expect(map.CORRECT_STREAK).toBe('Streak');
  });

  it('名前が未知でも、型が一意なら title / status / multi_select を推定する', () => {
    const map = buildPropertyMap({
      '見出し': 'title',
      '進捗': 'status',
      '分類': 'multi_select',
    });

    expect(map.PHRASE).toBe('見出し');
    expect(map.STATUS).toBe('進捗');
    expect(map.TAGS).toBe('分類');
  });

  it('検出できないフィールドは正準名へフォールバックする', () => {
    const map = buildPropertyMap({ 'Phrase': 'title' });

    expect(map.PHRASE).toBe('Phrase');
    expect(map.NEXT_REVIEW).toBe('Next Review');
    expect(map.STATUS).toBe('ステータス');
    expect(map.SYNC_VERSION).toBe('Sync Version');
  });

  it('空スキーマでも全フィールドが埋まる', () => {
    const map = buildPropertyMap({});

    for (const value of Object.values(map)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('同じプロパティを2つのフィールドへ割り当てない', () => {
    const map = buildPropertyMap(READING_VOCAB_SCHEMA);
    const detected = Object.entries(map)
      .filter(([, name]) => name in READING_VOCAB_SCHEMA)
      .map(([, name]) => name);

    expect(new Set(detected).size).toBe(detected.length);
  });
});
