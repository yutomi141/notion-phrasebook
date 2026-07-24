import { NextResponse } from 'next/server';
import { fetchAllScripts } from '@/lib/notion/script-db';

export async function GET() {
  try {
    const scripts = await fetchAllScripts();
    return NextResponse.json({ scripts });
  } catch (error) {
    console.error('[scripts] Notion fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch scripts' }, { status: 500 });
  }
}
