import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { notion } from '@/lib/notion/client';
import { NOTION_DB, PHRASE_PROPS } from '@/lib/schema/notion-ids';
import { normalizePhrase } from '@/lib/notion/ingest';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

export async function POST() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let updated = 0;
  let skipped = 0;
  let cursor: string | undefined;

  do {
    const response = await notion.databases.query({
      database_id: NOTION_DB.PHRASE,
      start_cursor: cursor,
    });

    for (const page of response.results) {
      if (!('properties' in page)) continue;
      const p = (page as PageObjectResponse).properties;
      const normalizedProp = p[PHRASE_PROPS.NORMALIZED_PHRASE];

      const existing =
        normalizedProp?.type === 'rich_text'
          ? normalizedProp.rich_text.map((t) => t.plain_text).join('')
          : '';

      if (existing.trim().length > 0) {
        skipped++;
        continue;
      }

      const phraseProp = p[PHRASE_PROPS.PHRASE];
      const phraseText =
        phraseProp?.type === 'title' ? phraseProp.title.map((t) => t.plain_text).join('') : '';

      if (!phraseText.trim()) {
        skipped++;
        continue;
      }

      const normalized = normalizePhrase(phraseText);
      await notion.pages.update({
        page_id: page.id,
        properties: {
          [PHRASE_PROPS.NORMALIZED_PHRASE]: {
            rich_text: [{ text: { content: normalized } }],
          },
        },
      });
      updated++;
    }

    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  return NextResponse.json({ updated, skipped });
}
