import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { auth } from '@/auth';
import { extractPhrasesFromText } from '@/lib/ai/extract';
import { ingestPhrases } from '@/lib/notion/ingest';

const MAX_CHARS = 8000;

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { text?: unknown };

    if (!body.text || typeof body.text !== 'string' || body.text.trim().length === 0) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    const text = body.text.trim();
    if (text.length > MAX_CHARS) {
      return NextResponse.json(
        { error: `テキストは${MAX_CHARS}文字以内にしてください` },
        { status: 400 },
      );
    }

    const sourceReference = createHash('sha256').update(text).digest('hex').slice(0, 16);

    const extracted = await extractPhrasesFromText(text);
    if (extracted.length === 0) {
      return NextResponse.json({ results: [], extractedCount: 0, created: 0, skipped: 0 });
    }

    const results = await ingestPhrases(extracted, sourceReference);
    const created = results.filter((r) => r.status === 'created').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;

    return NextResponse.json({ results, extractedCount: extracted.length, created, skipped });
  } catch (err) {
    console.error('[/api/ingest] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
