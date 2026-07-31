/**
 * 学習モード（カードソース）と出題方向の記憶。
 *
 * ZA-04: ホームからワンタップで前回と同じモードを開始できるようにする。
 * localStorage が使えない環境でも既定値で動作する。
 */
import type { CardSourceId, StudyDirection, StudySource } from '@/types';

const MODE_KEY = 'study-source';
const DIRECTION_KEY_PREFIX = 'study-direction:';

export const FALLBACK_SOURCE_ID: CardSourceId = 'phrase';

function readStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ストレージ不可（プライベートモード等）でも学習は継続できる
  }
}

/**
 * 記憶された値を、実際に有効なソース一覧に照らして解決する。
 * 記憶がない・無効になったソースを指している場合は先頭のソースへフォールバックする。
 */
export function resolveStoredSourceId(
  stored: string | null,
  available: readonly StudySource[],
): CardSourceId {
  if (available.length === 0) return FALLBACK_SOURCE_ID;
  const hit = available.find((s) => s.id === stored);
  return hit ? hit.id : available[0].id;
}

export function loadSourceId(available: readonly StudySource[]): CardSourceId {
  return resolveStoredSourceId(readStorage(MODE_KEY), available);
}

export function saveSourceId(sourceId: CardSourceId): void {
  writeStorage(MODE_KEY, sourceId);
}

/** 記憶がなければソース既定の出題方向を使う（リーディング語彙は EN→JA） */
export function resolveStoredDirection(
  stored: string | null,
  defaultDirection: StudyDirection,
): StudyDirection {
  return stored === 'EN_TO_JA' || stored === 'JA_TO_EN' ? stored : defaultDirection;
}

export function loadDirection(
  sourceId: CardSourceId,
  defaultDirection: StudyDirection,
): StudyDirection {
  return resolveStoredDirection(readStorage(DIRECTION_KEY_PREFIX + sourceId), defaultDirection);
}

export function saveDirection(sourceId: CardSourceId, direction: StudyDirection): void {
  writeStorage(DIRECTION_KEY_PREFIX + sourceId, direction);
}
