/**
 * ReviewPayload の検証ロジック — 純粋関数、テスト可能
 */
import type { ReviewPayload } from '@/types';

const VALID_RESULTS = new Set<string>(['remembered', 'forgotten']);
const VALID_DIRECTIONS = new Set<string>(['EN_TO_JA', 'JA_TO_EN']);
const MAX_ID_LEN = 256;
const MAX_SESSION_ID_LEN = 128;

export interface PayloadValidationResult {
  ok: boolean;
  error?: string;
}

/**
 * ReviewPayload を検証する。
 * expectedItemType で呼び出し元APIごとに許可する itemType を固定する。
 */
export function validateReviewPayload(
  payload: unknown,
  expectedItemType: 'phrase' | 'sentence',
): PayloadValidationResult {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'Missing payload' };
  }
  const p = payload as Partial<ReviewPayload>;

  if (
    !p.itemId ||
    typeof p.itemId !== 'string' ||
    !p.itemId.trim() ||
    p.itemId.length > MAX_ID_LEN
  ) {
    return { ok: false, error: 'Missing or invalid required fields' };
  }
  if (
    !p.sessionId ||
    typeof p.sessionId !== 'string' ||
    !p.sessionId.trim() ||
    p.sessionId.length > MAX_SESSION_ID_LEN
  ) {
    return { ok: false, error: 'Missing or invalid required fields' };
  }
  if (!VALID_RESULTS.has(p.result ?? '')) {
    return { ok: false, error: 'Invalid result value' };
  }
  if (!VALID_DIRECTIONS.has(p.direction ?? '')) {
    return { ok: false, error: 'Invalid direction value' };
  }
  if (p.itemType !== expectedItemType) {
    return { ok: false, error: 'Invalid itemType value' };
  }
  return { ok: true };
}
