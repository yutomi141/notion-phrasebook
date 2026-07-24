import 'server-only';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { notion } from './client';
import { NOTION_DB, SENTENCE_PROPS, SENTENCE_STATUS } from '@/lib/schema/notion-ids';
import { todayJST } from '@/lib/date';
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

// Done 数・総数・次回復習最小日を返す
export async function countSentencesForScript(
  scriptId: string,
): Promise<{ done: number; total: number; minNextReview: string | null }> {
  let done = 0;
  let total = 0;
  let minNextReview: string | null = null;
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
        total++;
        const p = (page as PageObjectResponse).properties;
        if (extractSentenceStatus(p[SENTENCE_PROPS.STATUS]) === 'Done') done++;
        const nr = extractDate(p[SENTENCE_PROPS.NEXT_REVIEW]);
        if (nr && (minNextReview === null || nr < minNextReview)) minNextReview = nr;
      }
    }
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  return { done, total, minNextReview };
}

export interface SentenceSrsState {
  intervalDays: number;
  correctStreak: number;
  reviewCount: number;
  forgottenCount: number;
  status: 'Not started' | 'In progress' | 'Done';
  scriptId: string;
}

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
      scriptId: extractRelationId(p[SENTENCE_PROPS.SCRIPT]),
    };
  } catch {
    return null;
  }
}

// 照合用正規化: 小文字化・句読点除去・スペース正規化
function normalizeForDedup(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s']/g, '')
    .replace(/\s+/g, ' ');
}

// "英文 (日本語訳)" または "英文 （日本語訳）" 形式を分割する
function parseBlock(text: string): { sentence: string; meaning: string } {
  const lastOpenParen = Math.max(text.lastIndexOf('('), text.lastIndexOf('（'));
  if (lastOpenParen > 0) {
    const enPart = text.slice(0, lastOpenParen).trim();
    const remainder = text.slice(lastOpenParen + 1).trim();
    const jaPart = remainder.replace(/[）)]\s*$/, '').trim();
    if (enPart.length > 0 && jaPart.length > 0) {
      return { sentence: enPart, meaning: jaPart };
    }
  }
  return { sentence: text, meaning: '' };
}

export interface SyncResult {
  created: number;
  unchanged: number;
  total: number;
}

const SKIP_BLOCK_TYPES = new Set([
  'heading_1', 'heading_2', 'heading_3', 'divider', 'image', 'video', 'table_of_contents',
]);

/**
 * Script Library ページのブロック本文を Script Sentences DB へ同期する。
 * "英文 (日本語訳)" 形式を解析して Sentence/Meaning を分離し、
 * 英文を正規化して既存エントリと照合する（学習履歴は保持）。
 */
export async function syncSentencesFromBlocks(scriptId: string): Promise<SyncResult> {
  type RichTextItem = { plain_text: string };
  type Block = {
    type: string;
    paragraph?: { rich_text: RichTextItem[] };
    bulleted_list_item?: { rich_text: RichTextItem[] };
    numbered_list_item?: { rich_text: RichTextItem[] };
    quote?: { rich_text: RichTextItem[] };
  };

  const parsedBlocks: Array<{ sentence: string; meaning: string }> = [];
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

  if (parsedBlocks.length === 0) return { created: 0, unchanged: 0, total: 0 };

  // 既存 Sentence を正規化キーで索引（重複チェック用）
  const existing = await fetchSentencesByScript(scriptId);
  const existingNormalized = new Map<string, true>(
    existing.map((s) => [normalizeForDedup(s.sentence), true]),
  );

  let created = 0;
  let unchanged = 0;
  let order = existing.length;

  for (const { sentence, meaning } of parsedBlocks) {
    const key = normalizeForDedup(sentence);
    if (existingNormalized.has(key)) {
      unchanged++;
      continue;
    }

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

    existingNormalized.set(key, true);
    order++;
    created++;
  }

  return { created, unchanged, total: order };
}

export async function updateSentenceAfterReview(
  sentenceId: string,
  newStatusKey: 'New' | 'Reviewing' | 'Mastered',
  intervalDays: number,
  newStreak: number,
  nextReviewDate: string,
  reviewedAt: string,
  newReviewCount: number,
  newForgottenCount: number,
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
    },
  });
}
