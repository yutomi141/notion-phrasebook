'use client';

import { useState } from 'react';
import type { SentenceCard, StudyDirection } from '@/types';
import { ReviewButtons } from './ReviewButtons';

interface SentenceFlashCardProps {
  card: SentenceCard;
  direction: StudyDirection;
  onReview: (result: 'remembered' | 'forgotten') => void;
  isPending: boolean;
}

export function SentenceFlashCard({ card, direction, onReview, isPending }: SentenceFlashCardProps) {
  const [flipped, setFlipped] = useState(false);
  const isEnToJa = direction === 'EN_TO_JA';
  const frontText = isEnToJa ? card.sentence : card.meaning;
  const backText = isEnToJa ? card.meaning : card.sentence;
  const frontLabel = isEnToJa ? 'EN' : 'JA';
  const backLabel = isEnToJa ? 'JA' : 'EN';
  const frontSize = isEnToJa ? 22 : 18;
  const backMainSize = isEnToJa ? 18 : 22;
  const backSubSize = isEnToJa ? 14 : 16;

  function handleFlip() {
    if (!flipped) setFlipped(true);
  }

  function handleReview(result: 'remembered' | 'forgotten') {
    setFlipped(false);
    onReview(result);
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <button
        onClick={handleFlip}
        disabled={flipped}
        aria-label={flipped ? undefined : 'カードをめくる'}
        style={{
          minHeight: 240,
          borderRadius: 12,
          border: '1px solid var(--border)',
          backgroundColor: 'var(--surface)',
          padding: '32px 24px',
          cursor: flipped ? 'default' : 'pointer',
          textAlign: 'left',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {!flipped ? (
          <>
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: '0.08em',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
              }}
            >
              {frontLabel}
            </span>
            <p
              className={isEnToJa ? 'font-card' : undefined}
              style={{ fontSize: frontSize, lineHeight: 1.6, color: 'var(--text-primary)', margin: 0 }}
            >
              {frontText || '（テキストなし）'}
            </p>
          </>
        ) : (
          <>
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: '0.08em',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
              }}
            >
              {backLabel}
            </span>
            <p
              className={!isEnToJa ? 'font-card' : undefined}
              style={{ fontSize: backMainSize, lineHeight: 1.6, color: 'var(--text-primary)', margin: 0 }}
            >
              {backText || '（テキストなし）'}
            </p>
            <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <p
                className={isEnToJa ? undefined : 'font-card'}
                style={{ fontSize: backSubSize, lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0 }}
              >
                {frontText}
              </p>
            </div>
          </>
        )}
      </button>

      {flipped && <ReviewButtons onReview={handleReview} isPending={isPending} />}

      {!flipped && (
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center' }}>
          タップしてめくる
        </p>
      )}
    </div>
  );
}
