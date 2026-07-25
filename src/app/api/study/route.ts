import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { fetchPhraseSrsState, updatePhraseAfterReview } from '@/lib/notion/phrase-db';
import { hasReviewLog, writeReviewLog } from '@/lib/notion/review-log';
import { calculateNextInterval } from '@/lib/srs/algorithm';
import { addDaysJST } from '@/lib/date';
import { validateReviewPayload } from '@/lib/validation/review-payload';
import { resolveReviewedAt } from '@/lib/validation/reviewed-at';
import type { ReviewPayload, SRSResult } from '@/types';

interface RequestBody {
  payload: ReviewPayload;
}

async function applySrsWithOptimisticLock(
  phraseId: string,
  result: 'remembered' | 'forgotten',
  logEntry: string,
  reviewedAt: string,
): Promise<{ srs: SRSResult; nextReviewDate: string } | { conflict: true } | { notFound: true }> {
  const state = await fetchPhraseSrsState(phraseId);
  if (!state) return { notFound: true };

  const srs = calculateNextInterval(result, state.intervalDays, state.correctStreak);
  const nextReviewDate = addDaysJST(new Date(), srs.nextIntervalDays);
  const newReviewCount = state.reviewCount + 1;
  const newForgottenCount = result === 'forgotten' ? state.forgottenCount + 1 : state.forgottenCount;

  // I-5: 楽観ロック — 更新直前に last_edited_time を再確認
  const fresh = await fetchPhraseSrsState(phraseId);
  if (!fresh) return { notFound: true };

  if (fresh.stateVersion !== state.stateVersion) {
    // 競合: 再計算して1回だけ再試行
    const retrySrs = calculateNextInterval(result, fresh.intervalDays, fresh.correctStreak);
    const retryNextReview = addDaysJST(new Date(), retrySrs.nextIntervalDays);

    const retryFresh = await fetchPhraseSrsState(phraseId);
    if (!retryFresh || retryFresh.stateVersion !== fresh.stateVersion) {
      return { conflict: true };
    }

    await updatePhraseAfterReview(
      phraseId, retrySrs.newStatus, retrySrs.nextIntervalDays, retrySrs.newStreak,
      retryNextReview, reviewedAt,
      fresh.reviewCount + 1,
      result === 'forgotten' ? fresh.forgottenCount + 1 : fresh.forgottenCount,
      logEntry,
    );
    return { srs: retrySrs, nextReviewDate: retryNextReview };
  }

  await updatePhraseAfterReview(
    phraseId, srs.newStatus, srs.nextIntervalDays, srs.newStreak,
    nextReviewDate, reviewedAt, newReviewCount, newForgottenCount, logEntry,
  );
  return { srs, nextReviewDate };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const validation = validateReviewPayload(body?.payload, 'phrase');
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { payload } = body;
  const logEntry = `${payload.sessionId}:${payload.itemId}`;

  try {
    // Step 1: ログ存在確認 — 全完了後の再送
    const alreadyLogged = await hasReviewLog(payload.sessionId, payload.itemId);
    if (alreadyLogged) {
      return NextResponse.json({ ok: true, cached: true });
    }

    // Step 2: I-4 syncVersion チェック — SRS更新済みか確認
    const state = await fetchPhraseSrsState(payload.itemId);
    if (!state) {
      return NextResponse.json({ error: 'Phrase not found' }, { status: 404 });
    }

    const reviewedAt = resolveReviewedAt(payload.reviewedAt);
    const previousInterval = state.intervalDays;
    let finalSrs: SRSResult | null = null;
    let finalNextReview: string | null = null;

    if (state.syncVersion === logEntry) {
      // SRS更新は適用済み — ログだけ追記
      finalSrs = calculateNextInterval(payload.result, state.intervalDays, state.correctStreak);
      finalNextReview = addDaysJST(new Date(), finalSrs.nextIntervalDays);
    } else {
      // Step 3: SRS更新 + I-5 楽観ロック
      const result = await applySrsWithOptimisticLock(
        payload.itemId, payload.result, logEntry, reviewedAt,
      );
      if ('notFound' in result) {
        return NextResponse.json({ error: 'Phrase not found' }, { status: 404 });
      }
      if ('conflict' in result) {
        return NextResponse.json(
          { error: 'Conflict: updated by another session' },
          { status: 409 },
        );
      }
      finalSrs = result.srs;
      finalNextReview = result.nextReviewDate;
    }

    // Step 4: Review Log 作成（既存の冪等チェック維持）
    await writeReviewLog(payload, reviewedAt, previousInterval, finalSrs.nextIntervalDays);

    return NextResponse.json({
      ok: true,
      nextReview: finalNextReview,
      newStatus: finalSrs.newStatus,
      newInterval: finalSrs.nextIntervalDays,
    });
  } catch (error) {
    console.error('[study] Notion update error:', error);
    return NextResponse.json({ error: 'Failed to record review' }, { status: 500 });
  }
}
