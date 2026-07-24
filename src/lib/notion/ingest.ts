import 'server-only';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { notion } from './client';
import { NOTION_DB, PHRASE_PROPS, PHRASE_STATUS } from '@/lib/schema/notion-ids';
import type { ExtractedPhrase } from '@/lib/ai/extract';

export function normalizePhrase(phrase: string): string {
  return phrase
    .toLowerCase()
    .trim()
    .replace(/[^\w\s']/g, '')
    .replace(/\s+/g, ' ');
}

interface ExistingMatch {
  id: string;
  sourceReference: string;
}

async function findByNormalizedPhrase(normalized: string): Promise<ExistingMatch | null> {
  const response = await notion.databases.query({
    database_id: NOTION_DB.PHRASE,
    filter: {
      property: PHRASE_PROPS.NORMALIZED_PHRASE,
      rich_text: { equals: normalized },
    },
    page_size: 1,
  });

  if (response.results.length === 0) return null;

  const page = response.results[0] as PageObjectResponse;
  const srcProp = page.properties[PHRASE_PROPS.SOURCE_REFERENCE];
  const existing =
    srcProp?.type === 'rich_text' ? srcProp.rich_text.map((t) => t.plain_text).join('') : '';

  return { id: page.id, sourceReference: existing };
}

async function appendSourceReference(pageId: string, oldRef: string, newRef: string): Promise<void> {
  if (oldRef.includes(newRef)) return;
  const updated = oldRef ? `${oldRef}, ${newRef}` : newRef;
  await notion.pages.update({
    page_id: pageId,
    properties: {
      [PHRASE_PROPS.SOURCE_REFERENCE]: {
        rich_text: [{ text: { content: updated.slice(0, 2000) } }],
      },
    },
  });
}

export interface IngestResult {
  phrase: string;
  status: 'created' | 'skipped';
}

export async function ingestPhrases(
  phrases: ExtractedPhrase[],
  sourceReference: string,
): Promise<IngestResult[]> {
  const results: IngestResult[] = [];

  for (const p of phrases) {
    const normalized = normalizePhrase(p.phrase);
    const existing = await findByNormalizedPhrase(normalized);

    if (existing) {
      await appendSourceReference(existing.id, existing.sourceReference, sourceReference);
      results.push({ phrase: p.phrase, status: 'skipped' });
      continue;
    }

    await notion.pages.create({
      parent: { database_id: NOTION_DB.PHRASE },
      properties: {
        [PHRASE_PROPS.PHRASE]: {
          title: [{ text: { content: p.phrase } }],
        },
        [PHRASE_PROPS.MEANING]: {
          rich_text: [{ text: { content: p.meaning } }],
        },
        ...(p.example
          ? { [PHRASE_PROPS.EXAMPLE]: { rich_text: [{ text: { content: p.example } }] } }
          : {}),
        ...(p.tags.length > 0
          ? { [PHRASE_PROPS.TAGS]: { multi_select: p.tags.map((name) => ({ name })) } }
          : {}),
        [PHRASE_PROPS.NORMALIZED_PHRASE]: {
          rich_text: [{ text: { content: normalized } }],
        },
        [PHRASE_PROPS.SOURCE_TYPE]: {
          select: { name: 'Pasted Transcript' },
        },
        [PHRASE_PROPS.SOURCE_REFERENCE]: {
          rich_text: [{ text: { content: sourceReference } }],
        },
        [PHRASE_PROPS.STATUS]: { status: { name: PHRASE_STATUS.NEW } },
        [PHRASE_PROPS.INTERVAL_DAYS]: { number: 0 },
        [PHRASE_PROPS.CORRECT_STREAK]: { number: 0 },
        [PHRASE_PROPS.REVIEW_COUNT]: { number: 0 },
        [PHRASE_PROPS.FORGOTTEN_COUNT]: { number: 0 },
      },
    });

    results.push({ phrase: p.phrase, status: 'created' });
  }

  return results;
}
