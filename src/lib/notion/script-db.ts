import 'server-only';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { notion } from './client';
import { NOTION_DB, SCRIPT_PROPS } from '@/lib/schema/notion-ids';
import type { ScriptCard } from '@/types';

function extractText(prop: PageObjectResponse['properties'][string]): string {
  if (prop.type === 'title') return prop.title.map((t) => t.plain_text).join('');
  if (prop.type === 'rich_text') return prop.rich_text.map((t) => t.plain_text).join('');
  return '';
}

function extractMultiSelect(prop: PageObjectResponse['properties'][string]): string[] {
  if (prop.type === 'multi_select') return prop.multi_select.map((s) => s.name);
  return [];
}

function extractDate(prop: PageObjectResponse['properties'][string]): string | null {
  if (prop.type === 'date' && prop.date) return prop.date.start;
  return null;
}

function extractNumber(prop: PageObjectResponse['properties'][string]): number | null {
  if (prop.type === 'number' && prop.number !== null) return prop.number;
  return null;
}

function extractScriptStatus(
  prop: PageObjectResponse['properties'][string],
): 'Draft' | 'Memorizing' | 'Perfect' {
  if (prop.type === 'status' && prop.status) {
    const name = prop.status.name;
    if (name === 'Perfect') return 'Perfect';
    if (name === 'Memorizing') return 'Memorizing';
  }
  return 'Draft';
}

export function mapPageToScript(page: PageObjectResponse): ScriptCard {
  const p = page.properties;
  return {
    id: page.id,
    name: extractText(p[SCRIPT_PROPS.NAME]),
    status: extractScriptStatus(p[SCRIPT_PROPS.STATUS]),
    tags: extractMultiSelect(p[SCRIPT_PROPS.TAGS]),
    sentenceCount: extractNumber(p[SCRIPT_PROPS.SENTENCE_COUNT]),
    lastReviewed: extractDate(p[SCRIPT_PROPS.LAST_REVIEWED]),
    nextReview: extractDate(p[SCRIPT_PROPS.NEXT_REVIEW]),
    syncVersion: page.last_edited_time,
  };
}

export async function fetchAllScripts(): Promise<ScriptCard[]> {
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const response = await notion.databases.query({
      database_id: NOTION_DB.SCRIPT_LIBRARY,
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
      start_cursor: cursor,
    });

    for (const page of response.results) {
      if ('properties' in page) pages.push(page as PageObjectResponse);
    }
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  return pages.map(mapPageToScript);
}

export async function fetchScriptStatus(
  scriptId: string,
): Promise<'Draft' | 'Memorizing' | 'Perfect'> {
  try {
    const page = (await notion.pages.retrieve({ page_id: scriptId })) as PageObjectResponse;
    return extractScriptStatus(page.properties[SCRIPT_PROPS.STATUS]);
  } catch {
    return 'Draft';
  }
}

/**
 * スクリプトのステータス・最終復習日・次回復習日・文数を更新する。
 *
 * ステータス遷移ルール：
 * - Draft → 初回レビュー時に Memorizing へ
 * - Perfect → forgottenの文があれば Memorizing へ戻す
 * - Memorizing → 全文 Done になったら Perfect へ
 */
/**
 * スクリプトのステータス・最終復習日・次回復習日・文数を更新する。
 *
 * - minNextReview: 全センテンスの Next Review 最小値（null なら全文未設定 or allDone）
 * - allDone のとき Next Review を明示的に null へクリアする
 */
export async function updateScriptAfterReview(
  scriptId: string,
  reviewedAt: string,
  doneSentences: number,
  totalSentences: number,
  currentStatus: 'Draft' | 'Memorizing' | 'Perfect',
  sentenceResult: 'remembered' | 'forgotten',
  minNextReview: string | null,
): Promise<void> {
  let newStatus: 'Draft' | 'Memorizing' | 'Perfect' = currentStatus;

  if (currentStatus === 'Draft') {
    newStatus = 'Memorizing';
  } else if (currentStatus === 'Perfect' && sentenceResult === 'forgotten') {
    newStatus = 'Memorizing';
  }

  const allDone = totalSentences > 0 && doneSentences >= totalSentences;
  if (allDone) {
    newStatus = 'Perfect';
  }

  // allDone のとき明示的に null をセット（省略すると古い値が残る）
  const nextReviewProp = allDone || !minNextReview
    ? { date: null }
    : { date: { start: minNextReview } };

  await notion.pages.update({
    page_id: scriptId,
    properties: {
      [SCRIPT_PROPS.LAST_REVIEWED]: { date: { start: reviewedAt } },
      [SCRIPT_PROPS.STATUS]: { status: { name: newStatus } },
      [SCRIPT_PROPS.SENTENCE_COUNT]: { number: totalSentences },
      [SCRIPT_PROPS.NEXT_REVIEW]: nextReviewProp,
    },
  });
}

/** 後方互換のため残す（既存呼出し元向け） */
export async function updateScriptLastReviewed(
  scriptId: string,
  reviewedAt: string,
  doneSentences: number,
  totalSentences: number,
): Promise<void> {
  const currentStatus = await fetchScriptStatus(scriptId);
  await updateScriptAfterReview(
    scriptId,
    reviewedAt,
    doneSentences,
    totalSentences,
    currentStatus,
    doneSentences < totalSentences ? 'forgotten' : 'remembered',
    null,
  );
}
