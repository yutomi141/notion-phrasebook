import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  fetchDueSentences,
  fetchSentenceSrsState,
  updateSentenceAfterReview,
  countSentencesForScript,
} from '@/lib/notion/sentences-db';
import { fetchScriptStatus, updateScriptAfterReview } from '@/lib/notion/script-db';
import { hasReviewLog, writeReviewLog } from '@/lib/notion/review-log';
import { calculateNextInterval } from '@/lib/srs/algorithm';
import { addDaysJST } from '@/lib/date';
import { validateReviewPayload } from '@/lib/validation/review-payload';
import { resolveReviewedAt } from '@/lib/validation/reviewed-at';
import type { ReviewPayload, SRSResult } from '@/types';

// auth() チェックなし — Next.js Middleware で全パス認証済み（書き込みは POST で再検証）
export async function GET() {
  try {
    const sentences = await fetchDueSentences();
    return NextResponse.json({ sentences });
  } catch (error) {
    console.error('[sentence-study] Notion fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch sentences' }, { status: 500 });
  }
}

interface RequestBody {
  payload: ReviewPayload;
}

async function applySentenceSrsWithOptimisticLock(
  sentenceId: string,
  result: 'remembered' | 'forgotten',
  logEntry: string,
  reviewedAt: string,
): Promise<
  { srs: SRSResult; nextReviewDate: string; scriptId: string } | { conflict: true } | { notFound: true }
> {
  const state = await fetchSentenceSrsState(sentenceId);
  if (!state) return { notFound: true };

  const srs = calculateNextInterval(result, state.intervalDays, state.correctStreak);
  const nextReviewDate = addDaysJST(new Date(), srs.nextIntervalDays);
  const newReviewCount = state.reviewCount + 1;
  const newForgottenCount = result === 'forgotten' ? state.forgottenCount + 1 : state.forgottenCount;

  // I-5: 楽観ロック — 更新直前に last_edited_time を再確認
  const fresh = await fetchSentenceSrsState(sentenceId);
  if (!fresh) return { notFound: true };

  if (fresh.stateVersion !== state.stateVersion) {
    const retrySrs = calculateNextInterval(result, fresh.intervalDays, fresh.correctStreak);
    const retryNextReview = addDaysJST(new Date(), retrySrs.nextIntervalDays);

    const retryFresh = await fetchSentenceSrsState(sentenceId);
    if (!retryFresh || retryFresh.stateVersion !== fresh.stateVersion) {
      return { conflict: true };
    }

    await updateSentenceAfterReview(
      sentenceId, retrySrs.newStatus, retrySrs.nextIntervalDays, retrySrs.newStreak,
      retryNextReview, reviewedAt,
      fresh.reviewCount + 1,
      result === 'forgotten' ? fresh.forgottenCount + 1 : fresh.forgottenCount,
      logEntry,
    );
    return { srs: retrySrs, nextReviewDate: retryNextReview, scriptId: fresh.scriptId };
  }

  await updateSentenceAfterReview(
    sentenceId, srs.newStatus, srs.nextIntervalDays, srs.newStreak,
    nextReviewDate, reviewedAt, newReviewCount, newForgottenCount, logEntry,
  );
  return { srs, nextReviewDate, scriptId: state.scriptId };
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

  const validation = validateReviewPayload(body?.payload, 'sentence');
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { payload } = body;
  const logEntry = `${payload.sessionId}:${payload.itemId}`;

  try {
    // Step 1: ログ存在確認
    const alreadyLogged = await hasReviewLog(payload.sessionId, payload.itemId);
    if (alreadyLogged) {
      return NextResponse.json({ ok: true, cached: true });
    }

    // Step 2: I-4 syncVersion チェック
    const state = await fetchSentenceSrsState(payload.itemId);
    if (!state) {
      return NextResponse.json({ error: 'Sentence not found' }, { status: 404 });
    }

    const reviewedAt = resolveReviewedAt(payload.reviewedAt);

    // F-2: SRS適用済みの再送分岐 — 保存済み値をそのまま使い、再計算しない
    if (state.syncVersion === logEntry) {
      const srsStatus =
        state.status === 'Done' ? 'Mastered' : state.status === 'In progress' ? 'Reviewing' : 'New';
      await writeReviewLog(payload, reviewedAt, undefined, state.intervalDays);
      return NextResponse.json({
        ok: true,
        replayed: true,
        nextReview: state.nextReview,
        newStatus: srsStatus,
        newInterval: state.intervalDays,
      });
    }

    const previousInterval = state.intervalDays;

    // Step 3: SRS更新 + I-5 楽観ロック
    const result = await applySentenceSrsWithOptimisticLock(
      payload.itemId, payload.result, logEntry, reviewedAt,
    );
    if ('notFound' in result) {
      return NextResponse.json({ error: 'Sentence not found' }, { status: 404 });
    }
    if ('conflict' in result) {
      return NextResponse.json(
        { error: 'Conflict: updated by another session' },
        { status: 409 },
      );
    }

    // Step 4: Script 集計更新（冪等）
    if (result.scriptId) {
      const [{ done, total, minNextReview, hasUnscheduled }, currentScriptStatus] =
        await Promise.all([
          countSentencesForScript(result.scriptId),
          fetchScriptStatus(result.scriptId),
        ]);
      await updateScriptAfterReview(
        result.scriptId, reviewedAt, done, total, currentScriptStatus,
        payload.result, minNextReview, hasUnscheduled,
      );
    }

    // Step 5: Review Log 作成
    await writeReviewLog(payload, reviewedAt, previousInterval, result.srs.nextIntervalDays);

    return NextResponse.json({
      ok: true,
      nextReview: result.nextReviewDate,
      newStatus: result.srs.newStatus,
      newInterval: result.srs.nextIntervalDays,
    });
  } catch (error) {
    console.error('[sentence-study] Notion update error:', error);
    return NextResponse.json({ error: 'Failed to record review' }, { status: 500 });
  }
}
