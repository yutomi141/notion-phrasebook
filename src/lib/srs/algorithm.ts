import { SRS } from './config';
import type { ReviewResult, SRSResult } from '@/types';

export function calculateNextInterval(
  result: ReviewResult,
  currentIntervalDays: number,
  currentStreak: number,
): SRSResult {
  if (result === 'forgotten') {
    return {
      nextIntervalDays: SRS.INITIAL_INTERVAL,
      newStreak: 0,
      newStatus: 'Reviewing',
    };
  }

  const newStreak = currentStreak + 1;
  let nextInterval: number;

  if (currentIntervalDays === 0) {
    nextInterval = SRS.INITIAL_INTERVAL;
  } else if (currentIntervalDays < SRS.SECOND_INTERVAL) {
    nextInterval = SRS.SECOND_INTERVAL;
  } else {
    nextInterval = Math.round(currentIntervalDays * SRS.EASE_FACTOR);
  }

  nextInterval = Math.min(nextInterval, SRS.MAX_INTERVAL);

  const isMastered =
    newStreak >= SRS.MASTERED_STREAK && nextInterval >= SRS.MASTERED_INTERVAL;

  return {
    nextIntervalDays: nextInterval,
    newStreak,
    newStatus: isMastered ? 'Mastered' : 'Reviewing',
  };
}

export function addDays(baseDate: Date, days: number): Date {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + days);
  return d;
}
