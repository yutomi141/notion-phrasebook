import 'server-only';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { notion } from './client';
import { resolveCardPropertyMap, type CardPropertyMap } from './card-source-schema';
import { PHRASE_PROPS } from '@/lib/schema/notion-ids';
import type { CardSource } from '@/lib/schema/card-sources';
import { todayJST } from '@/lib/date';
import { dedupeCards } from '@/lib/cards/dedupe';
import type { PhraseCard } from '@/types';

/**
 * Phrase DB / Reading Vocab DB 共通のカード読み書き。
 *
 * 両 DB は同一のデータ契約に従うため、同期・間隔反復・ステータス遷移の実装は
 * このファイルだけに存在する。ソースごとの違いは CardSource 定義に閉じている。
 */

function extractText(prop: PageObjectResponse['properties'][string] | undefined): string {
  if (!prop) return '';
  if (prop.type === 'title') {
    return prop.title.map((t) => t.plain_text).join('');
  }
  if (prop.type === 'rich_text') {
    return prop.rich_text.map((t) => t.plain_text).join('');
  }
  return '';
}

function extractMultiSelect(prop: PageObjectResponse['properties'][string] | undefined): string[] {
  if (prop?.type === 'multi_select') {
    return prop.multi_select.map((s) => s.name);
  }
  return [];
}

function extractDate(prop: PageObjectResponse['properties'][string] | undefined): string | null {
  if (prop?.type === 'date' && prop.date) {
    return prop.date.start;
  }
  return null;
}

function extractNumber(prop: PageObjectResponse['properties'][string] | undefined): number {
  if (prop?.type === 'number' && prop.number !== null) {
    return prop.number;
  }
  return 0;
}

function extractStatus(
  prop: PageObjectResponse['properties'][string] | undefined,
): 'New' | 'Reviewing' | 'Mastered' {
  const name =
    prop?.type === 'status' && prop.status
      ? prop.status.name
      : prop?.type === 'select' && prop.select
        ? prop.select.name
        : null;
  if (name === 'Mastered') return 'Mastered';
  if (name === 'Reviewing') return 'Reviewing';
  return 'New';
}

export function mapPageToCard(page: PageObjectResponse, props: CardPropertyMap): PhraseCard {
  const p = page.properties;
  return {
    id: page.id,
    phrase:         extractText(p[props.PHRASE]),
    meaning:        extractText(p[props.MEANING]),
    example:        extractText(p[props.EXAMPLE]) || null,
    tags:           extractMultiSelect(p[props.TAGS]),
    status:         extractStatus(p[props.STATUS]),
    intervalDays:   extractNumber(p[props.INTERVAL_DAYS]),
    correctStreak:  extractNumber(p[props.CORRECT_STREAK]),
    reviewCount:    extractNumber(p[props.REVIEW_COUNT]),
    forgottenCount: extractNumber(p[props.FORGOTTEN_COUNT]),
    nextReview:     extractDate(p[props.NEXT_REVIEW]),
    lastReviewed:   extractDate(p[props.LAST_REVIEWED]),
    syncVersion:    page.last_edited_time,
  };
}

/** 指定ソースの DB からのみ、今日出題すべきカードを取得する */
export async function fetchDueCards(source: CardSource): Promise<PhraseCard[]> {
  const props = await resolveCardPropertyMap(source.databaseId);
  const todayStr = todayJST();
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const response = await notion.databases.query({
      database_id: source.databaseId,
      filter: {
        or: [
          { property: props.STATUS, status: { equals: 'New' } },
          {
            and: [
              { property: props.STATUS, status: { equals: 'Reviewing' } },
              { property: props.NEXT_REVIEW, date: { is_empty: true } },
            ],
          },
          {
            and: [
              { property: props.STATUS, status: { equals: 'Reviewing' } },
              { property: props.NEXT_REVIEW, date: { on_or_before: todayStr } },
            ],
          },
          {
            and: [
              { property: props.STATUS, status: { equals: 'Mastered' } },
              { property: props.NEXT_REVIEW, date: { on_or_before: todayStr } },
            ],
          },
        ],
      },
      sorts: [{ property: props.NEXT_REVIEW, direction: 'ascending' }],
      start_cursor: cursor,
    });

    for (const page of response.results) {
      if ('properties' in page) {
        pages.push(page as PageObjectResponse);
      }
    }
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  // 同じフレーズの重複行が同一セッションで2回出題されるのを防ぐ
  return dedupeCards(pages.map((page) => mapPageToCard(page, props)));
}

export interface CardSrsState {
  intervalDays: number;
  correctStreak: number;
  reviewCount: number;
  forgottenCount: number;
  status: 'New' | 'Reviewing' | 'Mastered';
  nextReview: string | null;  // F-2: 再送時に保存済み値をそのまま返す
  syncVersion: string;        // I-4: 最後に適用した logEntry（sessionId:itemId）
  stateVersion: string;       // I-5: Notion page.last_edited_time
}

// I-5 注意: last_edited_time は分単位に丸められるため、同一分内の並行更新は競合検出できない
export async function fetchCardSrsState(
  source: CardSource,
  cardId: string,
): Promise<CardSrsState | null> {
  try {
    const page = (await notion.pages.retrieve({ page_id: cardId })) as PageObjectResponse;
    // 親 DB が指定ソースの DB であることを検証（他ソースのカードを取り違えない）
    const parentDbId =
      page.parent?.type === 'database_id' ? page.parent.database_id.replace(/-/g, '') : '';
    if (parentDbId !== source.databaseId.replace(/-/g, '')) return null;

    const props = await resolveCardPropertyMap(source.databaseId);
    const p = page.properties;
    return {
      intervalDays:   extractNumber(p[props.INTERVAL_DAYS]),
      correctStreak:  extractNumber(p[props.CORRECT_STREAK]),
      reviewCount:    extractNumber(p[props.REVIEW_COUNT]),
      forgottenCount: extractNumber(p[props.FORGOTTEN_COUNT]),
      status:         extractStatus(p[props.STATUS]),
      nextReview:     extractDate(p[props.NEXT_REVIEW]),
      syncVersion:    extractText(p[props.SYNC_VERSION]),
      stateVersion:   page.last_edited_time,
    };
  } catch {
    return null;
  }
}

export interface CardReviewUpdate {
  status: 'New' | 'Reviewing' | 'Mastered';
  intervalDays: number;
  correctStreak: number;
  nextReviewDate: string;
  reviewedAt: string;
  reviewCount: number;
  forgottenCount: number;
  syncVersion: string;  // I-4: SRS更新と同一呼び出しで書き込む
}

export async function updateCardAfterReview(
  source: CardSource,
  cardId: string,
  update: CardReviewUpdate,
): Promise<void> {
  const props = await resolveCardPropertyMap(source.databaseId);
  await notion.pages.update({
    page_id: cardId,
    properties: {
      [props.STATUS]:          { status: { name: update.status } },
      [props.INTERVAL_DAYS]:   { number: update.intervalDays },
      [props.CORRECT_STREAK]:  { number: update.correctStreak },
      [props.NEXT_REVIEW]:     { date: { start: update.nextReviewDate } },
      [props.LAST_REVIEWED]:   { date: { start: update.reviewedAt } },
      [props.REVIEW_COUNT]:    { number: update.reviewCount },
      [props.FORGOTTEN_COUNT]: { number: update.forgottenCount },
      [props.SYNC_VERSION]:    { rich_text: [{ text: { content: update.syncVersion } }] },
    },
  });
}

/** 正準プロパティ名（フォールバック用途で参照する） */
export const CANONICAL_CARD_PROPS: CardPropertyMap = { ...PHRASE_PROPS };
