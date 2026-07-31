import 'server-only';
import { notion } from './client';
import { PHRASE_PROPS } from '@/lib/schema/notion-ids';

/**
 * ZA-01：DB のプロパティ名を固定文字列に依存せず自動検出する。
 *
 * Notion 上でプロパティ名が変更されても、型と別名候補から論理フィールドを解決する。
 * 検出できなかったフィールドは正準名（PHRASE_PROPS）へフォールバックするため、
 * スキーマ取得に失敗しても従来どおり動作する。
 */

export type CardField = keyof typeof PHRASE_PROPS;

/** 論理フィールド → 実際のプロパティ名 */
export type CardPropertyMap = Record<CardField, string>;

/** 各フィールドの検出ルール。名前の別名候補と、許容する Notion プロパティ型 */
interface FieldRule {
  aliases: readonly string[];
  types: readonly string[];
  /** 名前が一致しなくても、この型のプロパティが 1 つだけなら採用する */
  uniqueByType?: boolean;
}

const RULES: Record<CardField, FieldRule> = {
  PHRASE:            { aliases: ['phrase', 'word', 'vocab', 'vocabulary', 'expression', '表現', '単語'], types: ['title'], uniqueByType: true },
  MEANING:           { aliases: ['meaning', 'japanese', '意味', '訳'], types: ['rich_text'] },
  EXAMPLE:           { aliases: ['example', 'sentence', 'context', '例文'], types: ['rich_text'] },
  TAGS:              { aliases: ['tags', 'tag', 'category', 'タグ'], types: ['multi_select'], uniqueByType: true },
  STATUS:            { aliases: ['ステータス', 'status', '状態'], types: ['status', 'select'], uniqueByType: true },
  ACTIVITY_LOG:      { aliases: ['english activity log', 'activity log'], types: ['relation'] },
  DATE:              { aliases: ['日付', 'date', '登録日'], types: ['date', 'created_time'] },
  NORMALIZED_PHRASE: { aliases: ['normalized phrase', 'normalized', '正規化'], types: ['rich_text'] },
  SOURCE_TYPE:       { aliases: ['source type', 'source'], types: ['select'] },
  SOURCE_REFERENCE:  { aliases: ['source reference', 'reference', '出典'], types: ['rich_text', 'url'] },
  LAST_REVIEWED:     { aliases: ['last reviewed', 'last review', '最終復習日'], types: ['date'] },
  NEXT_REVIEW:       { aliases: ['next review', 'due', '次回復習日'], types: ['date'] },
  INTERVAL_DAYS:     { aliases: ['interval days', 'interval', '復習間隔'], types: ['number'] },
  CORRECT_STREAK:    { aliases: ['correct streak', 'streak', '連続正解'], types: ['number'] },
  REVIEW_COUNT:      { aliases: ['review count', '復習回数'], types: ['number'] },
  FORGOTTEN_COUNT:   { aliases: ['forgotten count', '忘却回数'], types: ['number'] },
  SYNC_VERSION:      { aliases: ['sync version', 'version'], types: ['rich_text', 'number'] },
};

const FIELDS = Object.keys(RULES) as CardField[];

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[\s_-]+/g, ' ').trim();
}

/** プロパティ名 → 型 のマップから論理フィールドを解決する（純粋関数・テスト対象） */
export function buildPropertyMap(properties: Record<string, string>): CardPropertyMap {
  const entries = Object.entries(properties).map(([name, type]) => ({
    name,
    type,
    normalized: normalizeName(name),
  }));

  const map = {} as CardPropertyMap;
  const claimed = new Set<string>();

  // 1st pass: 別名との完全一致（型も一致するものを優先）
  for (const field of FIELDS) {
    const { aliases, types } = RULES[field];
    const hit =
      entries.find(
        (e) => !claimed.has(e.name) && types.includes(e.type) && aliases.includes(e.normalized),
      ) ??
      entries.find((e) => !claimed.has(e.name) && aliases.includes(e.normalized));
    if (hit) {
      map[field] = hit.name;
      claimed.add(hit.name);
    }
  }

  // 2nd pass: 型が一意に定まるフィールドを、残ったプロパティから拾う（リネーム耐性）
  for (const field of FIELDS) {
    if (map[field]) continue;
    const { types, uniqueByType } = RULES[field];
    if (!uniqueByType) continue;
    const candidates = entries.filter((e) => !claimed.has(e.name) && types.includes(e.type));
    if (candidates.length === 1) {
      map[field] = candidates[0].name;
      claimed.add(candidates[0].name);
    }
  }

  // 3rd pass: 未解決は正準名へフォールバック
  for (const field of FIELDS) {
    if (!map[field]) map[field] = PHRASE_PROPS[field];
  }

  return map;
}

/** DB ID → 解決済みプロパティマップ。プロセス内で使い回す */
const cache = new Map<string, CardPropertyMap>();

/** テスト用にキャッシュを破棄する */
export function clearPropertyMapCache(): void {
  cache.clear();
}

/**
 * DB のスキーマからプロパティマップを解決する。
 * 取得に失敗した場合は正準名のマップを返し、同期を止めない。
 */
export async function resolveCardPropertyMap(databaseId: string): Promise<CardPropertyMap> {
  const cached = cache.get(databaseId);
  if (cached) return cached;

  let map: CardPropertyMap;
  try {
    const db = await notion.databases.retrieve({ database_id: databaseId });
    const properties = Object.fromEntries(
      Object.entries(db.properties ?? {}).map(([name, prop]) => [
        name,
        (prop as { type: string }).type,
      ]),
    );
    map = buildPropertyMap(properties);
  } catch {
    // スキーマ取得できない場合でも正準名で動作させる
    map = { ...PHRASE_PROPS };
  }

  cache.set(databaseId, map);
  return map;
}
