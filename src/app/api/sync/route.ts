import { NextRequest, NextResponse } from 'next/server';
import { fetchDueCards } from '@/lib/notion/card-db';
import { resolveCardSource } from '@/lib/schema/card-sources';

// auth() チェックなし — Next.js Middleware で全パス認証済み（書き込みは POST で再検証）
export async function GET(req: NextRequest) {
  // source 未指定は phrase（既存クライアントとの後方互換）
  const sourceId = req.nextUrl.searchParams.get('source');
  const source = resolveCardSource(sourceId);
  if (!source) {
    return NextResponse.json({ error: 'Unknown source' }, { status: 400 });
  }

  try {
    const cards = await fetchDueCards(source);
    return NextResponse.json({ source: source.id, cards });
  } catch (error) {
    console.error('[sync] Notion fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch cards' }, { status: 500 });
  }
}
