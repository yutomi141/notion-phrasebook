'use client';

import {
  getAll,
  remove,
  incrementAttempts,
  MAX_ATTEMPTS,
  isQueueAvailable,
} from './queue';
import type { QueueEntry } from './queue';

async function sendEntry(
  entry: QueueEntry,
): Promise<'success' | 'client-error' | 'server-error' | 'network-error'> {
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
    // fetch自体が失敗（オフライン・DNS未解決等）
    console.warn('[offline-queue] network error for:', entry.key, entry.endpoint);
    return 'network-error';
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
      if (entry.attempts >= MAX_ATTEMPTS) {
        console.warn(
          '[offline-queue] dropping entry after max attempts:',
          entry.key, entry.endpoint,
        );
        await remove(entry.key);
        continue;
      }

      const result = await sendEntry(entry);

      if (result === 'success' || result === 'client-error') {
        if (result === 'client-error') {
          console.warn('[offline-queue] discarding entry due to 4xx:', entry.key, entry.endpoint);
        }
        await remove(entry.key);
      } else {
        // サーバーエラー / ネットワークエラー: 試行回数を増やして中断（順序保持のため後続は送らない）
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
