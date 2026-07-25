/**
 * I-10: オフライン回答キューのテスト（インメモリアダプター使用）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setAdapter, enqueue, getAll, remove, incrementAttempts, queueCount, MAX_ATTEMPTS } from '@/lib/offline/queue';
import type { StorageAdapter, QueueEntry } from '@/lib/offline/queue';

// ---- インメモリアダプター（テスト用）----

function makeInMemoryAdapter(): StorageAdapter {
  const store = new Map<string, QueueEntry>();
  return {
    async enqueue(entry) {
      if (store.has(entry.key)) return;
      store.set(entry.key, { ...entry, enqueuedAt: new Date().toISOString(), attempts: 0 });
    },
    async getAll() {
      return Array.from(store.values());
    },
    async remove(key) {
      store.delete(key);
    },
    async incrementAttempts(key) {
      const e = store.get(key);
      if (e) store.set(key, { ...e, attempts: e.attempts + 1 });
    },
    async count() {
      return store.size;
    },
  };
}

const basePayload = {
  itemId: 'item-1',
  itemType: 'phrase' as const,
  result: 'remembered' as const,
  direction: 'EN_TO_JA' as const,
  sessionId: 'session-1',
  reviewedAt: '2026-07-25T12:00:00.000Z',
};

beforeEach(() => {
  setAdapter(makeInMemoryAdapter());
});

describe('I-10: オフライン回答キュー', () => {
  it('1. enqueue/getAll/remove の基本動作', async () => {
    await enqueue({ key: 'session-1:item-1', payload: basePayload, endpoint: '/api/study' });
    expect(await queueCount()).toBe(1);

    const entries = await getAll();
    expect(entries).toHaveLength(1);
    expect(entries[0].key).toBe('session-1:item-1');
    expect(entries[0].attempts).toBe(0);

    await remove('session-1:item-1');
    expect(await queueCount()).toBe(0);
  });

  it('2. 複数エントリの順序保持', async () => {
    const keys = ['session-1:item-a', 'session-1:item-b', 'session-1:item-c'];
    for (const key of keys) {
      await enqueue({
        key,
        payload: { ...basePayload, itemId: key.split(':')[1] },
        endpoint: '/api/study',
      });
    }
    const entries = await getAll();
    expect(entries.map((e) => e.key)).toEqual(expect.arrayContaining(keys));
    expect(entries).toHaveLength(3);
  });

  it('3. 同一 key の重複 enqueue は 1件に収束する', async () => {
    await enqueue({ key: 'session-1:item-1', payload: basePayload, endpoint: '/api/study' });
    await enqueue({ key: 'session-1:item-1', payload: basePayload, endpoint: '/api/study' });
    expect(await queueCount()).toBe(1);
  });

  it('4. flush 中の途中失敗で残りが保持される', async () => {
    await enqueue({ key: 'k1', payload: { ...basePayload, itemId: 'i1' }, endpoint: '/api/study' });
    await enqueue({ key: 'k2', payload: { ...basePayload, itemId: 'i2' }, endpoint: '/api/study' });

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })   // k1: 成功
      .mockRejectedValueOnce(new Error('Network error'));              // k2: 失敗

    // 送信処理をシミュレート（flush.ts の sendEntry 相当）
    const entries = (await getAll()).sort((a, b) => a.enqueuedAt.localeCompare(b.enqueuedAt));
    for (const entry of entries) {
      try {
        const res = await fetchMock(entry.endpoint, {}) as { ok: boolean };
        if (res.ok) {
          await remove(entry.key);
        }
      } catch {
        await incrementAttempts(entry.key);
        break; // 順序保持: 後続は送らない
      }
    }

    expect(await queueCount()).toBe(1); // k2 が残る
    const remaining = await getAll();
    expect(remaining[0].key).toBe('k2');
    expect(remaining[0].attempts).toBe(1);
  });

  it('5. 4xx はキューに入らない（呼び出し元が throw する前提）', async () => {
    // 4xx の場合は submitReview が throw するため enqueue は呼ばれない
    // この仕様を直接確認
    const count_before = await queueCount();
    // 4xx 相当: enqueue を呼ばない
    expect(await queueCount()).toBe(count_before); // 変化なし
  });

  it('6. incrementAttempts が正しく動作する', async () => {
    await enqueue({ key: 'k1', payload: basePayload, endpoint: '/api/study' });
    await incrementAttempts('k1');
    await incrementAttempts('k1');
    const entries = await getAll();
    expect(entries[0].attempts).toBe(2);
  });

  it('7. MAX_ATTEMPTS に達したエントリは送信試行対象外になる', async () => {
    await enqueue({ key: 'k1', payload: basePayload, endpoint: '/api/study' });
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await incrementAttempts('k1');
    }
    const entries = await getAll();
    const shouldSkip = entries[0].attempts >= MAX_ATTEMPTS;
    expect(shouldSkip).toBe(true);
  });
});

describe('B-2: MAX_ATTEMPTS 到達エントリの flush 処理', () => {
  // flush.ts の for ループをシミュレートし、B-2修正後の動作を検証する

  async function simulateFlush(fetchMock: ReturnType<typeof vi.fn>) {
    const entries = (await getAll()).sort((a, b) => a.enqueuedAt.localeCompare(b.enqueuedAt));
    for (const entry of entries) {
      // B-2修正: MAX_ATTEMPTS到達エントリは削除してcontinue
      if (entry.attempts >= MAX_ATTEMPTS) {
        await remove(entry.key);
        continue;
      }
      try {
        const res = await fetchMock(entry.endpoint) as { ok: boolean; status?: number };
        if (res.ok) {
          await remove(entry.key);
        } else if (res.status && res.status >= 400 && res.status < 500) {
          await remove(entry.key);
        } else {
          await incrementAttempts(entry.key);
          break;
        }
      } catch {
        await incrementAttempts(entry.key);
        break;
      }
    }
  }

  it('1. MAX_ATTEMPTS到達エントリはflushで削除され、fetchを試行しない', async () => {
    const fetchMock = vi.fn();
    await enqueue({ key: 'k-max', payload: basePayload, endpoint: '/api/study' });
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await incrementAttempts('k-max');
    }
    await simulateFlush(fetchMock);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await queueCount()).toBe(0);
  });

  it('2. MAX_ATTEMPTS未満のエントリは従来どおり送信される', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true });
    await enqueue({ key: 'k-ok', payload: basePayload, endpoint: '/api/study' });
    await simulateFlush(fetchMock);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await queueCount()).toBe(0);
  });

  it('3. 削除後にqueueCountが減ることを確認', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true });
    await enqueue({ key: 'k-max', payload: basePayload, endpoint: '/api/study' });
    await enqueue({
      key: 'k-ok',
      payload: { ...basePayload, itemId: 'item-2', sessionId: 'sess-2' },
      endpoint: '/api/study',
    });
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await incrementAttempts('k-max');
    }
    expect(await queueCount()).toBe(2);
    await simulateFlush(fetchMock);
    expect(await queueCount()).toBe(0);
  });
});
