'use client';

import { useState } from 'react';
import type { PhraseCard, StudyDirection } from '@/types';
import { CardFront } from './CardFront';
import { CardBack } from './CardBack';
import { ReviewButtons } from './ReviewButtons';

interface FlashCardProps {
  card: PhraseCard;
  direction: StudyDirection;
  onReview: (result: 'remembered' | 'forgotten') => void;
  isPending: boolean;
}

export function FlashCard({ card, direction, onReview, isPending }: FlashCardProps) {
  const [flipped, setFlipped] = useState(false);

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
          border: `1px solid var(--border)`,
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
          <CardFront card={card} direction={direction} />
        ) : (
          <CardBack card={card} direction={direction} />
        )}
      </button>

      {flipped && (
        <ReviewButtons onReview={handleReview} isPending={isPending} />
      )}

      {!flipped && (
        <p
          style={{
            fontSize: 14,
            color: 'var(--text-secondary)',
            textAlign: 'center',
          }}
        >
          タップしてめくる
        </p>
      )}
    </div>
  );
}
