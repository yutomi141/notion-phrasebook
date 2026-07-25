'use client';

import {
  getAll,
  remove,
  incrementAttempts,
  MAX_ATTEMPTS,
  isQueueAvailable,
} from './queue';
import type { QueueEntry } from './queue';

async function sendEntry(entry: QueueEntry): Promise<'success' | 'client-error' | 'server-error'> {
  try {
    const res = await fetch(entry.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: entry.payload }),
    });
    if (res.ok) return 'success';
    // 4xx: 送信不可（バリデーションエラー・競合等）→ キューから除去
    if (res.status >= 400 && res.status < 500) return 'client-error';
    return 'server-error';
  } catch {
    return 'server-error';
  }
}

let isFlushing = false;

export async function flush(): Promise<void> {
  if (!isQueueAvailable() || isFlushing) return;
  isFlushing = true;
  try {
    const entries = await getAll();
    // enqueueAt 昇順で古い順に送信（順序保持）
    entries.sort((a, b) => a.enqueuedAt.localeCompare(b.enqueuedAt));

    for (const entry of entries) {
      if (entry.attempts >= MAX_ATTEMPTS) continue;

      const result = await sendEntry(entry);

      if (result === 'success' || result === 'client-error') {
        await remove(entry.key);
      } else {
        // サーバーエラー: 試行回数を増やして中断（順序保持のため後続は送らない）
        await incrementAttempts(entry.key);
        break;
      }
    }
  } finally {
    isFlushing = false;
  }
}

export function setupOnlineFlush(): () => void {
  const handler = () => { flush().catch(() => undefined); };
  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}
