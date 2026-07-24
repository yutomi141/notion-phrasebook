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
import type { ReviewPayload } from '@/types';

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

  // F-4: /api/sentence-study は sentence のみ許可
  const validation = validateReviewPayload(body?.payload, 'sentence');
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { payload } = body;

  try {
    // 冪等チェック: SRS更新前にログ存在確認
    const alreadyLogged = await hasReviewLog(payload.sessionId, payload.itemId);
    if (alreadyLogged) {
      return NextResponse.json({ ok: true, cached: true });
    }

    const state = await fetchSentenceSrsState(payload.itemId);
    if (!state) {
      return NextResponse.json({ error: 'Sentence not found' }, { status: 404 });
    }

    const previousInterval = state.intervalDays;
    const srs = calculateNextInterval(payload.result, state.intervalDays, state.correctStreak);
    const nextReviewDate = addDaysJST(new Date(), srs.nextIntervalDays);
    // F-5: Last Reviewed も Review Log も同一のサーバー側 ISO タイムスタンプを使用
    const reviewedAt = new Date().toISOString();

    const newReviewCount = state.reviewCount + 1;
    const newForgottenCount =
      payload.result === 'forgotten' ? state.forgottenCount + 1 : state.forgottenCount;

    await updateSentenceAfterReview(
      payload.itemId,
      srs.newStatus,
      srs.nextIntervalDays,
      srs.newStreak,
      nextReviewDate,
      reviewedAt,
      newReviewCount,
      newForgottenCount,
    );

    if (state.scriptId) {
      // F-6: hasUnscheduled を countSentencesForScript から取得して updateScriptAfterReview へ渡す
      const [{ done, total, minNextReview, hasUnscheduled }, currentScriptStatus] =
        await Promise.all([
          countSentencesForScript(state.scriptId),
          fetchScriptStatus(state.scriptId),
        ]);
      await updateScriptAfterReview(
        state.scriptId,
        reviewedAt,
        done,
        total,
        currentScriptStatus,
        payload.result,
        minNextReview,
        hasUnscheduled,
      );
    }

    await writeReviewLog(payload, reviewedAt, previousInterval, srs.nextIntervalDays);

    return NextResponse.json({
      ok: true,
      nextReview: nextReviewDate,
      newStatus: srs.newStatus,
      newInterval: srs.nextIntervalDays,
    });
  } catch (error) {
    console.error('[sentence-study] Notion update error:', error);
    return NextResponse.json({ error: 'Failed to record review' }, { status: 500 });
  }
}
