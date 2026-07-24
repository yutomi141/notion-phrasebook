import { NextRequest, NextResponse } from 'next/server';
import { fetchSentencesByScript } from '@/lib/notion/sentences-db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const sentences = await fetchSentencesByScript(id);
    return NextResponse.json({ sentences });
  } catch (error) {
    console.error('[scripts/sentences] Notion fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch sentences' }, { status: 500 });
  }
}
