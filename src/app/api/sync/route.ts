import { NextResponse } from 'next/server';
import { fetchDuePhrasesFromNotion } from '@/lib/notion/phrase-db';

export async function GET() {
  try {
    const cards = await fetchDuePhrasesFromNotion();
    return NextResponse.json({ cards });
  } catch (error) {
    console.error('[sync] Notion fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch cards' }, { status: 500 });
  }
}
