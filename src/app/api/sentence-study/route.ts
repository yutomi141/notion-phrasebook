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
import { addDaysJST, todayJST } from '@/lib/date';
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

const VALID_RESULTS = new Set(['remembered', 'forgotten']);
const VALID_DIRECTIONS = new Set(['EN_TO_JA', 'JA_TO_EN']);
const VALID_ITEM_TYPES = new Set(['phrase', 'sentence']);
const MAX_SESSION_ID_LEN = 128;

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

  const { payload } = body;

  // 厳格なペイロード検証
  if (
    !payload?.itemId ||
    typeof payload.itemId !== 'string' ||
    !payload.sessionId ||
    typeof payload.sessionId !== 'string' ||
    payload.sessionId.length > MAX_SESSION_ID_LEN
  ) {
    return NextResponse.json({ error: 'Missing or invalid required fields' }, { status: 400 });
  }
  if (!VALID_RESULTS.has(payload.result)) {
    return NextResponse.json({ error: 'Invalid result value' }, { status: 400 });
  }
  if (!VALID_DIRECTIONS.has(payload.direction)) {
    return NextResponse.json({ error: 'Invalid direction value' }, { status: 400 });
  }
  if (!VALID_ITEM_TYPES.has(payload.itemType)) {
    return NextResponse.json({ error: 'Invalid itemType value' }, { status: 400 });
  }

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
    const reviewedAt = new Date().toISOString();
    const reviewedAtDate = todayJST();

    const newReviewCount = state.reviewCount + 1;
    const newForgottenCount =
      payload.result === 'forgotten' ? state.forgottenCount + 1 : state.forgottenCount;

    await updateSentenceAfterReview(
      payload.itemId,
      srs.newStatus,
      srs.nextIntervalDays,
      srs.newStreak,
      nextReviewDate,
      reviewedAtDate,
      newReviewCount,
      newForgottenCount,
    );

    if (state.scriptId) {
      const [{ done, total, minNextReview }, currentScriptStatus] = await Promise.all([
        countSentencesForScript(state.scriptId),
        fetchScriptStatus(state.scriptId),
      ]);
      await updateScriptAfterReview(
        state.scriptId,
        reviewedAtDate,
        done,
        total,
        currentScriptStatus,
        payload.result,
        minNextReview,
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
