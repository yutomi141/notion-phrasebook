import 'server-only';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { notion } from './client';
import { NOTION_DB, SENTENCE_PROPS, SENTENCE_STATUS } from '@/lib/schema/notion-ids';
import { todayJST } from '@/lib/date';
import { parseBlock, normalizeForDedup, planSync } from './script-parser';
import type { ParsedEntry, DBEntry } from './script-parser';
import { aggregateSentences } from './sentence-agg';
import type { SentenceAggInput } from './sentence-agg';
import type { SentenceCard } from '@/types';

function extractText(prop: PageObjectResponse['properties'][string]): string {
  if (prop.type === 'title') return prop.title.map((t) => t.plain_text).join('');
  if (prop.type === 'rich_text') return prop.rich_text.map((t) => t.plain_text).join('');
  return '';
}

function extractDate(prop: PageObjectResponse['properties'][string]): string | null {
  if (prop.type === 'date' && prop.date) return prop.date.start;
  return null;
}

function extractNumber(prop: PageObjectResponse['properties'][string]): number {
  if (prop.type === 'number' && prop.number !== null) return prop.number;
  return 0;
}

function extractSentenceStatus(
  prop: PageObjectResponse['properties'][string],
): 'Not started' | 'In progress' | 'Done' {
  if (prop.type === 'status' && prop.status) {
    const name = prop.status.name;
    if (name === 'Done') return 'Done';
    if (name === 'In progress') return 'In progress';
  }
  return 'Not started';
}

function extractRelationId(prop: PageObjectResponse['properties'][string]): string {
  if (prop.type === 'relation' && prop.relation.length > 0) return prop.relation[0].id;
  return '';
}

export function mapPageToSentence(page: PageObjectResponse): SentenceCard {
  const p = page.properties;
  return {
    id: page.id,
    sentence: extractText(p[SENTENCE_PROPS.SENTENCE]),
    meaning: extractText(p[SENTENCE_PROPS.MEANING]),
    scriptId: extractRelationId(p[SENTENCE_PROPS.SCRIPT]),
    order: extractNumber(p[SENTENCE_PROPS.ORDER]),
    status: extractSentenceStatus(p[SENTENCE_PROPS.STATUS]),
    intervalDays: extractNumber(p[SENTENCE_PROPS.INTERVAL_DAYS]),
    correctStreak: extractNumber(p[SENTENCE_PROPS.CORRECT_STREAK]),
    reviewCount: extractNumber(p[SENTENCE_PROPS.REVIEW_COUNT]),
    forgottenCount: extractNumber(p[SENTENCE_PROPS.FORGOTTEN_COUNT]),
    nextReview: extractDate(p[SENTENCE_PROPS.NEXT_REVIEW]),
    lastReviewed: extractDate(p[SENTENCE_PROPS.LAST_REVIEWED]),
  };
}

export async function fetchDueSentences(): Promise<SentenceCard[]> {
  const todayStr = todayJST();
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const response = await notion.databases.query({
      database_id: NOTION_DB.SCRIPT_SENTENCES,
      filter: {
        or: [
          { property: SENTENCE_PROPS.STATUS, status: { equals: 'Not started' } },
          {
            and: [
              { property: SENTENCE_PROPS.STATUS, status: { equals: 'In progress' } },
              { property: SENTENCE_PROPS.NEXT_REVIEW, date: { is_empty: true } },
            ],
          },
          {
            and: [
              { property: SENTENCE_PROPS.STATUS, status: { equals: 'In progress' } },
              { property: SENTENCE_PROPS.NEXT_REVIEW, date: { on_or_before: todayStr } },
            ],
          },
          {
            and: [
              { property: SENTENCE_PROPS.STATUS, status: { equals: 'Done' } },
              { property: SENTENCE_PROPS.NEXT_REVIEW, date: { on_or_before: todayStr } },
            ],
          },
        ],
      },
      sorts: [{ property: SENTENCE_PROPS.ORDER, direction: 'ascending' }],
      start_cursor: cursor,
    });

    for (const page of response.results) {
      if ('properties' in page) pages.push(page as PageObjectResponse);
    }
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  return pages.map(mapPageToSentence);
}

export async function fetchSentencesByScript(scriptId: string): Promise<SentenceCard[]> {
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const response = await notion.databases.query({
      database_id: NOTION_DB.SCRIPT_SENTENCES,
      filter: {
        property: SENTENCE_PROPS.SCRIPT,
        relation: { contains: scriptId },
      },
      sorts: [{ property: SENTENCE_PROPS.ORDER, direction: 'ascending' }],
      start_cursor: cursor,
    });

    for (const page of response.results) {
      if ('properties' in page) pages.push(page as PageObjectResponse);
    }
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  return pages.map(mapPageToSentence);
}

// Done 数・総数・次回復習最小日・未学習文の有無を返す（Done 文の Next Review も集計対象）
export async function countSentencesForScript(
  scriptId: string,
): Promise<{ done: number; total: number; minNextReview: string | null; hasUnscheduled: boolean }> {
  const inputs: SentenceAggInput[] = [];
  let cursor: string | undefined;

  do {
    const response = await notion.databases.query({
      database_id: NOTION_DB.SCRIPT_SENTENCES,
      filter: {
        property: SENTENCE_PROPS.SCRIPT,
        relation: { contains: scriptId },
      },
      start_cursor: cursor,
    });

    for (const page of response.results) {
      if ('properties' in page) {
        const p = (page as PageObjectResponse).properties;
        inputs.push({
          status: extractSentenceStatus(p[SENTENCE_PROPS.STATUS]),
          nextReview: extractDate(p[SENTENCE_PROPS.NEXT_REVIEW]),
        });
      }
    }
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  return aggregateSentences(inputs);
}

export interface SentenceSrsState {
  intervalDays: number;
  correctStreak: number;
  reviewCount: number;
  forgottenCount: number;
  status: 'Not started' | 'In progress' | 'Done';
  nextReview: string | null;  // F-2: 再送時に保存済み値をそのまま返す
  scriptId: string;
  syncVersion: string;        // I-4: 最後に適用した logEntry（sessionId:itemId）
  stateVersion: string;       // I-5: Notion page.last_edited_time
}

// I-5 注意: last_edited_time は分単位に丸められるため、同一分内の並行更新は競合検出できない
export async function fetchSentenceSrsState(sentenceId: string): Promise<SentenceSrsState | null> {
  try {
    const page = (await notion.pages.retrieve({ page_id: sentenceId })) as PageObjectResponse;
    // 親 DB が Script Sentences DB であることを検証
    const parentDbId =
      page.parent?.type === 'database_id' ? page.parent.database_id.replace(/-/g, '') : '';
    if (parentDbId !== NOTION_DB.SCRIPT_SENTENCES.replace(/-/g, '')) return null;
    const p = page.properties;
    return {
      intervalDays: extractNumber(p[SENTENCE_PROPS.INTERVAL_DAYS]),
      correctStreak: extractNumber(p[SENTENCE_PROPS.CORRECT_STREAK]),
      reviewCount: extractNumber(p[SENTENCE_PROPS.REVIEW_COUNT]),
      forgottenCount: extractNumber(p[SENTENCE_PROPS.FORGOTTEN_COUNT]),
      status: extractSentenceStatus(p[SENTENCE_PROPS.STATUS]),
      nextReview: extractDate(p[SENTENCE_PROPS.NEXT_REVIEW]),
      scriptId: extractRelationId(p[SENTENCE_PROPS.SCRIPT]),
      syncVersion: p[SENTENCE_PROPS.SYNC_VERSION] ? extractText(p[SENTENCE_PROPS.SYNC_VERSION]) : '',
      stateVersion: page.last_edited_time,
    };
  } catch {
    return null;
  }
}


export interface SyncResult {
  created: number;
  updated: number;
  archived: number;
  reordered: number;
  unchanged: number;
  total: number;
}

const SKIP_BLOCK_TYPES = new Set([
  'heading_1', 'heading_2', 'heading_3', 'divider', 'image', 'video', 'table_of_contents',
]);

/**
 * Script Library ページのブロック本文を Script Sentences DB へ同期する。
 * 追加・Meaning更新・アーカイブ・並べ替えに対応する差分同期。
 * force=true の場合のみ 30% 超のアーカイブを許可する。
 */
export async function syncSentencesFromBlocks(
  scriptId: string,
  force = false,
): Promise<SyncResult | { tooManyArchives: true; archiveRatio: number; wouldArchive: Array<{ id: string; sentence: string }> }> {
  type RichTextItem = { plain_text: string };
  type Block = {
    type: string;
    paragraph?: { rich_text: RichTextItem[] };
    bulleted_list_item?: { rich_text: RichTextItem[] };
    numbered_list_item?: { rich_text: RichTextItem[] };
    quote?: { rich_text: RichTextItem[] };
  };

  const parsedBlocks: ParsedEntry[] = [];
  let blockCursor: string | undefined;

  do {
    const res = await notion.blocks.children.list({
      block_id: scriptId,
      start_cursor: blockCursor,
    });

    for (const block of res.results as Block[]) {
      if (SKIP_BLOCK_TYPES.has(block.type)) continue;

      const richText =
        block.paragraph?.rich_text ??
        block.bulleted_list_item?.rich_text ??
        block.numbered_list_item?.rich_text ??
        block.quote?.rich_text ??
        null;

      if (!richText) continue;
      const fullText = richText.map((t) => t.plain_text).join('').trim();
      if (fullText.length === 0) continue;

      const parsed = parseBlock(fullText);
      if (parsed.sentence.length > 0) parsedBlocks.push(parsed);
    }

    blockCursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (blockCursor);

  if (parsedBlocks.length === 0) {
    return { created: 0, updated: 0, archived: 0, reordered: 0, unchanged: 0, total: 0 };
  }

  const existingSentences = await fetchSentencesByScript(scriptId);
  const existing: DBEntry[] = existingSentences.map((s) => ({
    id: s.id,
    sentence: s.sentence,
    meaning: s.meaning,
    order: s.order,
  }));

  const { plan, tooManyArchives, archiveRatio } = planSync(parsedBlocks, existing);

  if (tooManyArchives && !force) {
    return { tooManyArchives: true, archiveRatio, wouldArchive: plan.toArchive };
  }

  // 作成（本文内の位置 parsedIndex+1 を Order として割り当て、初回同期で収束させる）
  for (const { sentence, meaning, order } of plan.toCreate) {
    await notion.pages.create({
      parent: { database_id: NOTION_DB.SCRIPT_SENTENCES },
      properties: {
        [SENTENCE_PROPS.SENTENCE]: { title: [{ text: { content: sentence } }] },
        [SENTENCE_PROPS.MEANING]: { rich_text: [{ text: { content: meaning } }] },
        [SENTENCE_PROPS.SCRIPT]: { relation: [{ id: scriptId }] },
        [SENTENCE_PROPS.ORDER]: { number: order },
        [SENTENCE_PROPS.STATUS]: { status: { name: SENTENCE_STATUS.NEW } },
        [SENTENCE_PROPS.INTERVAL_DAYS]: { number: 0 },
        [SENTENCE_PROPS.CORRECT_STREAK]: { number: 0 },
        [SENTENCE_PROPS.REVIEW_COUNT]: { number: 0 },
        [SENTENCE_PROPS.FORGOTTEN_COUNT]: { number: 0 },
      },
    });
  }

  // Meaning 更新（SRS履歴は保持）
  for (const { id, meaning } of plan.toUpdate) {
    await notion.pages.update({
      page_id: id,
      properties: {
        [SENTENCE_PROPS.MEANING]: { rich_text: [{ text: { content: meaning } }] },
      },
    });
  }

  // アーカイブ（削除ではなく可逆な非公開化）
  for (const { id } of plan.toArchive) {
    await notion.pages.update({ page_id: id, archived: true });
  }

  // Order 並べ替え
  for (const { id, newOrder } of plan.toReorder) {
    await notion.pages.update({
      page_id: id,
      properties: { [SENTENCE_PROPS.ORDER]: { number: newOrder } },
    });
  }

  const activeTotal = existing.length + plan.toCreate.length - plan.toArchive.length;
  return {
    created: plan.toCreate.length,
    updated: plan.toUpdate.length,
    archived: plan.toArchive.length,
    reordered: plan.toReorder.length,
    unchanged: plan.unchanged,
    total: activeTotal,
  };
}

// normalizeForDedup は script-parser から re-export が必要な箇所向け
export { normalizeForDedup };

export async function updateSentenceAfterReview(
  sentenceId: string,
  newStatusKey: 'New' | 'Reviewing' | 'Mastered',
  intervalDays: number,
  newStreak: number,
  nextReviewDate: string,
  reviewedAt: string,
  newReviewCount: number,
  newForgottenCount: number,
  syncVersion: string,  // I-4: SRS更新と同一呼び出しで書き込む
): Promise<void> {
  const notionStatus =
    newStatusKey === 'Mastered' ? SENTENCE_STATUS.MASTERED : SENTENCE_STATUS.REVIEWING;

  await notion.pages.update({
    page_id: sentenceId,
    properties: {
      [SENTENCE_PROPS.STATUS]: { status: { name: notionStatus } },
      [SENTENCE_PROPS.INTERVAL_DAYS]: { number: intervalDays },
      [SENTENCE_PROPS.CORRECT_STREAK]: { number: newStreak },
      [SENTENCE_PROPS.NEXT_REVIEW]: { date: { start: nextReviewDate } },
      [SENTENCE_PROPS.LAST_REVIEWED]: { date: { start: reviewedAt } },
      [SENTENCE_PROPS.REVIEW_COUNT]: { number: newReviewCount },
      [SENTENCE_PROPS.FORGOTTEN_COUNT]: { number: newForgottenCount },
      [SENTENCE_PROPS.SYNC_VERSION]: { rich_text: [{ text: { content: syncVersion } }] },
    },
  });
}
