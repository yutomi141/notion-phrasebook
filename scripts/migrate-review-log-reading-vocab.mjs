#!/usr/bin/env node
/**
 * Review Log DB に Reading Vocab 用の記録先を追加する移行スクリプト。
 *
 *   適用:       node scripts/migrate-review-log-reading-vocab.mjs
 *   ロールバック: node scripts/migrate-review-log-reading-vocab.mjs --rollback
 *
 * 追加のみの非破壊変更で、既存行のデータは一切書き換えない。
 *   1. `Reading Vocab` relation プロパティ（→ Reading Vocab DB）
 *   2. `Item Type` select への `Reading Vocab` 選択肢
 *
 * 冪等：すでに適用済みなら何もしない。
 * ロールバックは 1 のプロパティを削除する（既存の Phrase / Script Sentence ログには影響しない）。
 * `Item Type` の選択肢は、削除すると既存行の値が失われる可能性があるため残す。
 */
import { readFileSync } from 'node:fs';
import { Client } from '@notionhq/client';

const RELATION_PROP = 'Reading Vocab';
const ITEM_TYPE_PROP = 'Item Type';
const ITEM_TYPE_OPTION = 'Reading Vocab';

/** .env.local を process.env へ読み込む（値はログへ出さない） */
function loadEnv() {
  let raw;
  try {
    raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  } catch {
    return; // CI 等では実環境変数が設定済みの想定
  }
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

function requireEnv(key) {
  const value = process.env[key];
  if (!value) {
    console.error(`環境変数 ${key} が設定されていません。`);
    process.exit(1);
  }
  return value;
}

async function apply(notion, reviewLogDbId, readingVocabDbId) {
  const db = await notion.databases.retrieve({ database_id: reviewLogDbId });

  const hasRelation = Object.prototype.hasOwnProperty.call(db.properties, RELATION_PROP);
  const itemType = db.properties[ITEM_TYPE_PROP];
  if (!itemType || itemType.type !== 'select') {
    console.error(`Review Log DB に select プロパティ「${ITEM_TYPE_PROP}」が見つかりません。中断します。`);
    process.exit(1);
  }
  const hasOption = itemType.select.options.some((o) => o.name === ITEM_TYPE_OPTION);

  if (hasRelation && hasOption) {
    console.log('適用済みです（変更なし）。');
    return;
  }

  const properties = {};
  if (!hasRelation) {
    properties[RELATION_PROP] = {
      relation: { database_id: readingVocabDbId, single_property: {} },
    };
  }
  if (!hasOption) {
    // 既存の選択肢をすべて維持したうえで追加する
    properties[ITEM_TYPE_PROP] = {
      select: {
        options: [
          ...itemType.select.options.map((o) => ({ id: o.id })),
          { name: ITEM_TYPE_OPTION, color: 'orange' },
        ],
      },
    };
  }

  await notion.databases.update({ database_id: reviewLogDbId, properties });

  if (!hasRelation) console.log(`追加: relation プロパティ「${RELATION_PROP}」`);
  if (!hasOption) console.log(`追加: ${ITEM_TYPE_PROP} の選択肢「${ITEM_TYPE_OPTION}」`);
  console.log('移行が完了しました。');
}

async function rollback(notion, reviewLogDbId) {
  const db = await notion.databases.retrieve({ database_id: reviewLogDbId });
  if (!Object.prototype.hasOwnProperty.call(db.properties, RELATION_PROP)) {
    console.log(`relation プロパティ「${RELATION_PROP}」は存在しません（変更なし）。`);
    return;
  }

  await notion.databases.update({
    database_id: reviewLogDbId,
    properties: { [RELATION_PROP]: null },
  });
  console.log(`削除: relation プロパティ「${RELATION_PROP}」`);
  console.log(
    `注意: ${ITEM_TYPE_PROP} の選択肢「${ITEM_TYPE_OPTION}」は既存行の値を保護するため残しています。`,
  );
}

async function main() {
  loadEnv();
  const notion = new Client({ auth: requireEnv('NOTION_TOKEN'), timeoutMs: 30_000 });
  const reviewLogDbId = requireEnv('NOTION_REVIEW_LOG_DB_ID');

  if (process.argv.includes('--rollback')) {
    await rollback(notion, reviewLogDbId);
  } else {
    await apply(notion, reviewLogDbId, requireEnv('NOTION_READING_VOCAB_DB_ID'));
  }
}

main().catch((error) => {
  console.error('移行に失敗しました:', error.code ?? '', error.message);
  process.exit(1);
});
