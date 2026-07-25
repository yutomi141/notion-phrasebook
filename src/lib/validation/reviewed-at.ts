const MAX_PAST_MS = 30 * 24 * 60 * 60 * 1000; // 30日

/**
 * クライアントから受け取った reviewedAt を検証し、有効なら使用する。
 * 未来時刻・30日超過去・不正形式の場合はサーバー現在時刻にフォールバック。
 */
export function resolveReviewedAt(clientReviewedAt?: string | null): string {
  if (!clientReviewedAt) return new Date().toISOString();

  const t = new Date(clientReviewedAt);
  if (isNaN(t.getTime())) return new Date().toISOString();

  const now = Date.now();
  if (t.getTime() > now) return new Date().toISOString();
  if (now - t.getTime() > MAX_PAST_MS) return new Date().toISOString();

  return t.toISOString();
}
