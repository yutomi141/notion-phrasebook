import 'server-only';
import { REVIEW_LOG_PROPS } from './notion-ids';
import type { CardSourceId, StudyDirection } from '@/types';

/**
 * カードソース定義。
 *
 * Phrase DB と Reading Vocab DB は同一のデータ契約に従うため、同期・重複判定・
 * 間隔反復・ステータス遷移はすべてこの定義を受け取る 1 実装（lib/notion/card-db.ts）で処理する。
 *
 * 新しいソースを追加する手順は、この配列へ 1 行足して対応する環境変数を設定するだけ。
 * 環境変数が未設定のソースは自動的に無効化され、モード選択にも同期対象にも現れない。
 */
export interface CardSourceDefinition {
  id: CardSourceId;
  /** UI に表示するモード名 */
  label: string;
  /** DB ID を持つ環境変数名 */
  envKey: string;
  /** 既定の出題方向（ユーザーが未選択のとき使う） */
  defaultDirection: StudyDirection;
  /** Review Log DB の Item Type に書き込む選択肢名 */
  reviewLogItemType: string;
  /** Review Log DB で該当ページを指す relation プロパティ名 */
  reviewLogRelationProp: string;
}

const DEFINITIONS: readonly CardSourceDefinition[] = [
  {
    id: 'phrase',
    label: 'フレーズ',
    envKey: 'NOTION_PHRASE_DB_ID',
    defaultDirection: 'EN_TO_JA',
    reviewLogItemType: 'Phrase',
    reviewLogRelationProp: REVIEW_LOG_PROPS.PHRASE,
  },
  {
    id: 'reading-vocab',
    label: 'リーディング語彙',
    envKey: 'NOTION_READING_VOCAB_DB_ID',
    defaultDirection: 'EN_TO_JA',
    reviewLogItemType: 'Reading Vocab',
    reviewLogRelationProp: REVIEW_LOG_PROPS.READING_VOCAB,
  },
] as const;

/** 解決済みのカードソース（DB ID が確定している） */
export interface CardSource extends CardSourceDefinition {
  databaseId: string;
}

function resolve(def: CardSourceDefinition): CardSource | null {
  const databaseId = process.env[def.envKey];
  if (!databaseId) return null;
  return { ...def, databaseId };
}

/** 環境変数に DB ID が設定されているソースだけを返す */
export function listCardSources(): CardSource[] {
  return DEFINITIONS.map(resolve).filter((s): s is CardSource => s !== null);
}

/** id からソースを解決する。未定義・未設定なら null */
export function getCardSource(id: string | null | undefined): CardSource | null {
  const def = DEFINITIONS.find((d) => d.id === id);
  return def ? resolve(def) : null;
}

/** sourceId 省略時のフォールバック。既存データ・旧オフラインキューとの後方互換のため phrase 固定 */
export const DEFAULT_CARD_SOURCE_ID: CardSourceId = 'phrase';

/** sourceId を解決する。省略時は既定ソース */
export function resolveCardSource(id: string | null | undefined): CardSource | null {
  return getCardSource(id ?? DEFAULT_CARD_SOURCE_ID);
}
