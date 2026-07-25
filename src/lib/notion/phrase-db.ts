import 'server-only';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { notion } from './client';
import { NOTION_DB, PHRASE_PROPS } from '@/lib/schema/notion-ids';
import { todayJST } from '@/lib/date';
import type { PhraseCard } from '@/types';

function extractText(prop: PageObjectResponse['properties'][string]): string {
  if (prop.type === 'title') {
    return prop.title.map((t) => t.plain_text).join('');
  }
  if (prop.type === 'rich_text') {
    return prop.rich_text.map((t) => t.plain_text).join('');
  }
  return '';
}

function extractMultiSelect(prop: PageObjectResponse['properties'][string]): string[] {
  if (prop.type === 'multi_select') {
    return prop.multi_select.map((s) => s.name);
  }
  return [];
}

function extractDate(prop: PageObjectResponse['properties'][string]): string | null {
  if (prop.type === 'date' && prop.date) {
    return prop.date.start;
  }
  return null;
}

function extractNumber(prop: PageObjectResponse['properties'][string]): number {
  if (prop.type === 'number' && prop.number !== null) {
    return prop.number;
  }
  return 0;
}

function extractStatus(prop: PageObjectResponse['properties'][string]): 'New' | 'Reviewing' | 'Mastered' {
  if (prop.type === 'status' && prop.status) {
    const name = prop.status.name;
    if (name === 'Mastered') return 'Mastered';
    if (name === 'Reviewing') return 'Reviewing';
  }
  return 'New';
}

export function mapPageToPhrase(page: PageObjectResponse): PhraseCard {
  const p = page.properties;
  return {
    id: page.id,
    phrase:        extractText(p[PHRASE_PROPS.PHRASE]),
    meaning:       extractText(p[PHRASE_PROPS.MEANING]),
    example:       extractText(p[PHRASE_PROPS.EXAMPLE]) || null,
    tags:          extractMultiSelect(p[PHRASE_PROPS.TAGS]),
    status:        extractStatus(p[PHRASE_PROPS.STATUS]),
    intervalDays:  extractNumber(p[PHRASE_PROPS.INTERVAL_DAYS]),
    correctStreak: extractNumber(p[PHRASE_PROPS.CORRECT_STREAK]),
    reviewCount:   extractNumber(p[PHRASE_PROPS.REVIEW_COUNT]),
    forgottenCount:extractNumber(p[PHRASE_PROPS.FORGOTTEN_COUNT]),
    nextReview:    extractDate(p[PHRASE_PROPS.NEXT_REVIEW]),
    lastReviewed:  extractDate(p[PHRASE_PROPS.LAST_REVIEWED]),
    syncVersion:   page.last_edited_time,
  };
}

export async function fetchDuePhrasesFromNotion(): Promise<PhraseCard[]> {
  const todayStr = todayJST();
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const response = await notion.databases.query({
      database_id: NOTION_DB.PHRASE,
      filter: {
        or: [
          { property: PHRASE_PROPS.STATUS, status: { equals: 'New' } },
          {
            and: [
              { property: PHRASE_PROPS.STATUS, status: { equals: 'Reviewing' } },
              { property: PHRASE_PROPS.NEXT_REVIEW, date: { is_empty: true } },
            ],
          },
          {
            and: [
              { property: PHRASE_PROPS.STATUS, status: { equals: 'Reviewing' } },
              { property: PHRASE_PROPS.NEXT_REVIEW, date: { on_or_before: todayStr } },
            ],
          },
          {
            and: [
              { property: PHRASE_PROPS.STATUS, status: { equals: 'Mastered' } },
              { property: PHRASE_PROPS.NEXT_REVIEW, date: { on_or_before: todayStr } },
            ],
          },
        ],
      },
      sorts: [{ property: PHRASE_PROPS.NEXT_REVIEW, direction: 'ascending' }],
      start_cursor: cursor,
    });

    for (const page of response.results) {
      if ('properties' in page) {
        pages.push(page as PageObjectResponse);
      }
    }
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  return pages.map(mapPageToPhrase);
}

export interface PhraseSrsState {
  intervalDays: number;
  correctStreak: number;
  reviewCount: number;
  forgottenCount: number;
  status: 'New' | 'Reviewing' | 'Mastered';
  syncVersion: string;   // I-4: 最後に適用した logEntry（sessionId:itemId）
  stateVersion: string;  // I-5: Notion page.last_edited_time
}

export async function fetchPhraseSrsState(phraseId: string): Promise<PhraseSrsState | null> {
  try {
    const page = (await notion.pages.retrieve({ page_id: phraseId })) as PageObjectResponse;
    // 親 DB が Phrase DB であることを検証
    const parentDbId =
      page.parent?.type === 'database_id' ? page.parent.database_id.replace(/-/g, '') : '';
    if (parentDbId !== NOTION_DB.PHRASE.replace(/-/g, '')) return null;
    const p = page.properties;
    return {
      intervalDays: extractNumber(p[PHRASE_PROPS.INTERVAL_DAYS]),
      correctStreak: extractNumber(p[PHRASE_PROPS.CORRECT_STREAK]),
      reviewCount: extractNumber(p[PHRASE_PROPS.REVIEW_COUNT]),
      forgottenCount: extractNumber(p[PHRASE_PROPS.FORGOTTEN_COUNT]),
      status: extractStatus(p[PHRASE_PROPS.STATUS]),
      syncVersion: extractText(p[PHRASE_PROPS.SYNC_VERSION]),
      stateVersion: page.last_edited_time,
    };
  } catch {
    return null;
  }
}

export async function updatePhraseAfterReview(
  phraseId: string,
  status: 'New' | 'Reviewing' | 'Mastered',
  intervalDays: number,
  newStreak: number,
  nextReviewDate: string,
  reviewedAt: string,
  newReviewCount: number,
  newForgottenCount: number,
  syncVersion: string,  // I-4: SRS更新と同一呼び出しで書き込む
): Promise<void> {
  await notion.pages.update({
    page_id: phraseId,
    properties: {
      [PHRASE_PROPS.STATUS]: { status: { name: status } },
      [PHRASE_PROPS.INTERVAL_DAYS]: { number: intervalDays },
      [PHRASE_PROPS.CORRECT_STREAK]: { number: newStreak },
      [PHRASE_PROPS.NEXT_REVIEW]: { date: { start: nextReviewDate } },
      [PHRASE_PROPS.LAST_REVIEWED]: { date: { start: reviewedAt } },
      [PHRASE_PROPS.REVIEW_COUNT]: { number: newReviewCount },
      [PHRASE_PROPS.FORGOTTEN_COUNT]: { number: newForgottenCount },
      [PHRASE_PROPS.SYNC_VERSION]: { rich_text: [{ text: { content: syncVersion } }] },
    },
  });
}
