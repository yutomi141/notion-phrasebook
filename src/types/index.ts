export type StudyDirection = 'EN_TO_JA' | 'JA_TO_EN';
export type ReviewResult = 'remembered' | 'forgotten';
export type ItemType = 'phrase' | 'sentence';

export interface PhraseCard {
  id: string;
  phrase: string;
  meaning: string;
  example: string | null;
  tags: string[];
  status: 'New' | 'Reviewing' | 'Mastered';
  intervalDays: number;
  correctStreak: number;
  reviewCount: number;
  forgottenCount: number;
  nextReview: string | null;
  lastReviewed: string | null;
  syncVersion: string;
}

export interface ReviewPayload {
  itemId: string;
  itemType: ItemType;
  result: ReviewResult;
  direction: StudyDirection;
  sessionId: string;
  reviewedAt: string;
}

export interface SRSResult {
  nextIntervalDays: number;
  newStreak: number;
  newStatus: 'New' | 'Reviewing' | 'Mastered';
}

export interface ScriptCard {
  id: string;
  name: string;
  status: 'Draft' | 'Memorizing' | 'Perfect';
  tags: string[];
  sentenceCount: number | null;
  lastReviewed: string | null;
  nextReview: string | null;
  syncVersion: string;
}

export interface SentenceCard {
  id: string;
  sentence: string;
  meaning: string;
  scriptId: string;
  order: number;
  status: 'Not started' | 'In progress' | 'Done';
  intervalDays: number;
  correctStreak: number;
  reviewCount: number;
  forgottenCount: number;
  nextReview: string | null;
  lastReviewed: string | null;
}
