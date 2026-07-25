import { NextResponse } from 'next/server';
import { fetchDuePhrasesFromNotion } from '@/lib/notion/phrase-db';

// auth() チェックなし — Next.js Middleware で全パス認証済み（書き込みは POST で再検証）
export async function GET() {
  try {
    const cards = await fetchDuePhrasesFromNotion();
    return NextResponse.json({ cards });
  } catch (error) {
    console.error('[sync] Notion fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch cards' }, { status: 500 });
  }
}
