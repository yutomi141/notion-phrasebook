'use client';

import type { ReviewPayload } from '@/types';

const DB_NAME = 'phrasebook-queue';
const STORE_NAME = 'review-queue';
const DB_VERSION = 1;
export const MAX_ATTEMPTS = 20;

export interface QueueEntry {
  key: string;
  payload: ReviewPayload;
  endpoint: '/api/study' | '/api/sentence-study';
  enqueuedAt: string;
  attempts: number;
}

export type StorageAdapter = {
  enqueue(entry: Omit<QueueEntry, 'enqueuedAt' | 'attempts'>): Promise<void>;
  getAll(): Promise<QueueEntry[]>;
  remove(key: string): Promise<void>;
  incrementAttempts(key: string): Promise<void>;
  count(): Promise<number>;
};

// ---- IndexedDB adapter (production) ----

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const idbAdapter: StorageAdapter = {
  async enqueue(entry) {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(entry.key);
      getReq.onsuccess = () => {
        if (getReq.result) { resolve(); return; } // 重複enqueueは無視
        const full: QueueEntry = { ...entry, enqueuedAt: new Date().toISOString(), attempts: 0 };
        store.put(full);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error('IDB transaction aborted'));
      };
      getReq.onerror = () => reject(getReq.error);
    });
  },

  async getAll() {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result as QueueEntry[]);
      req.onerror = () => reject(req.error);
    });
  },

  async remove(key) {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async incrementAttempts(key) {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(key);
      getReq.onsuccess = () => {
        const entry = getReq.result as QueueEntry | undefined;
        if (entry) store.put({ ...entry, attempts: entry.attempts + 1 });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  },

  async count() {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
};

export function isQueueAvailable(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

// ---- 公開 API（プロダクションは idbAdapter を使用）----

let _adapter: StorageAdapter = idbAdapter;

export function setAdapter(adapter: StorageAdapter): void {
  _adapter = adapter;
}

export function enqueue(entry: Omit<QueueEntry, 'enqueuedAt' | 'attempts'>): Promise<void> {
  return _adapter.enqueue(entry);
}

export function getAll(): Promise<QueueEntry[]> {
  return _adapter.getAll();
}

export function remove(key: string): Promise<void> {
  return _adapter.remove(key);
}

export function incrementAttempts(key: string): Promise<void> {
  return _adapter.incrementAttempts(key);
}

export function queueCount(): Promise<number> {
  return _adapter.count();
}
