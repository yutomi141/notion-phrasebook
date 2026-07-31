import 'server-only';
import { notion } from './client';
import { NOTION_DB, REVIEW_LOG_PROPS } from '@/lib/schema/notion-ids';
import { resolveCardSource } from '@/lib/schema/card-sources';
import type { ReviewPayload } from '@/types';

/** 同一 sessionId:itemId のログが既に存在するか確認する */
export async function hasReviewLog(sessionId: string, itemId: string): Promise<boolean> {
  const logEntry = `${sessionId}:${itemId}`;
  const existing = await notion.databases.query({
    database_id: NOTION_DB.REVIEW_LOG,
    filter: {
      property: REVIEW_LOG_PROPS.LOG_ENTRY,
      title: { equals: logEntry },
    },
    page_size: 1,
  });
  return existing.results.length > 0;
}

export async function writeReviewLog(
  payload: ReviewPayload,
  reviewedAt: string,
  previousInterval?: number,
  nextInterval?: number,
): Promise<void> {
  const logEntry = `${payload.sessionId}:${payload.itemId}`;

  // 冪等チェック（二重送信に対する安全網）
  const existing = await notion.databases.query({
    database_id: NOTION_DB.REVIEW_LOG,
    filter: {
      property: REVIEW_LOG_PROPS.LOG_ENTRY,
      title: { equals: logEntry },
    },
    page_size: 1,
  });
  if (existing.results.length > 0) return;

  // カード系はソース定義から Item Type / relation を引く（Phrase・Reading Vocab をログ上で区別する）
  const source = payload.itemType === 'phrase' ? resolveCardSource(payload.sourceId) : null;
  const itemTypeName =
    payload.itemType === 'phrase' ? source?.reviewLogItemType ?? 'Phrase' : 'Script Sentence';

  const properties: Record<string, unknown> = {
    [REVIEW_LOG_PROPS.LOG_ENTRY]: { title: [{ text: { content: logEntry } }] },
    [REVIEW_LOG_PROPS.REVIEWED_AT]: { date: { start: reviewedAt } },
    [REVIEW_LOG_PROPS.ITEM_TYPE]: { select: { name: itemTypeName } },
    [REVIEW_LOG_PROPS.RESULT]: {
      select: { name: payload.result === 'remembered' ? 'Remembered' : 'Forgotten' },
    },
    [REVIEW_LOG_PROPS.DIRECTION]: {
      select: { name: payload.direction === 'EN_TO_JA' ? 'EN→JA' : 'JA→EN' },
    },
    [REVIEW_LOG_PROPS.SESSION_ID]: { rich_text: [{ text: { content: payload.sessionId } }] },
  };

  if (previousInterval !== undefined) {
    properties[REVIEW_LOG_PROPS.PREVIOUS_INTERVAL] = { number: previousInterval };
  }
  if (nextInterval !== undefined) {
    properties[REVIEW_LOG_PROPS.NEXT_INTERVAL] = { number: nextInterval };
  }

  if (payload.itemType === 'phrase') {
    const relationProp = source?.reviewLogRelationProp ?? REVIEW_LOG_PROPS.PHRASE;
    properties[relationProp] = { relation: [{ id: payload.itemId }] };
  } else {
    properties[REVIEW_LOG_PROPS.SCRIPT_SENTENCE] = { relation: [{ id: payload.itemId }] };
  }

  await notion.pages.create({
    parent: { database_id: NOTION_DB.REVIEW_LOG },
    properties: properties as never,
  });
}
