import { NextResponse } from 'next/server';
import { listCardSources } from '@/lib/schema/card-sources';
import type { StudySource } from '@/types';

// auth() チェックなし — Next.js Middleware で全パス認証済み（読み取りのみ）
export async function GET() {
  // DB ID はクライアントへ返さない
  const sources: StudySource[] = listCardSources().map((s) => ({
    id: s.id,
    label: s.label,
    defaultDirection: s.defaultDirection,
  }));
  return NextResponse.json({ sources });
}
