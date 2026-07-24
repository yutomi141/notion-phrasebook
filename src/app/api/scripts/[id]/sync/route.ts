import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { syncSentencesFromBlocks } from '@/lib/notion/sentences-db';
import { notion } from '@/lib/notion/client';
import { NOTION_DB, SCRIPT_PROPS } from '@/lib/schema/notion-ids';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Script Library DB への所属確認
    const page = (await notion.pages.retrieve({ page_id: id })) as PageObjectResponse;
    const parentDbId =
      page.parent?.type === 'database_id' ? page.parent.database_id.replace(/-/g, '') : '';
    const expectedDbId = NOTION_DB.SCRIPT_LIBRARY.replace(/-/g, '');
    if (parentDbId !== expectedDbId) {
      return NextResponse.json({ error: 'Script not found' }, { status: 404 });
    }

    const result = await syncSentencesFromBlocks(id);

    // Sentence Count を更新
    if (result.total > 0) {
      await notion.pages.update({
        page_id: id,
        properties: {
          [SCRIPT_PROPS.SENTENCE_COUNT]: { number: result.total },
        },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[scripts/sync] error:', error);
    return NextResponse.json({ error: 'Failed to sync sentences' }, { status: 500 });
  }
}
