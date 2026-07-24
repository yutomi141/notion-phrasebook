'use client';

import { useMutation } from '@tanstack/react-query';

export interface IngestResult {
  phrase: string;
  status: 'created' | 'skipped';
}

export interface IngestResponse {
  results: IngestResult[];
  extractedCount: number;
  created: number;
  skipped: number;
}

async function postIngest(text: string): Promise<IngestResponse> {
  const res = await fetch('/api/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? '取り込みに失敗しました');
  }
  return res.json() as Promise<IngestResponse>;
}

export function useIngestText() {
  return useMutation({
    mutationFn: (text: string) => postIngest(text),
  });
}
