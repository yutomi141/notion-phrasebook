'use client';

import { useState } from 'react';
import type { PhraseCard, StudyDirection } from '@/types';
import { useSwipe } from '@/hooks/useSwipe';
import { CardFront } from './CardFront';
import { CardBack } from './CardBack';
import { ReviewButtons } from './ReviewButtons';

interface FlashCardProps {
  card: PhraseCard;
  direction: StudyDirection;
  onReview: (result: 'remembered' | 'forgotten') => void;
  isPending?: boolean;
}

function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = 0.85;
  window.speechSynthesis.speak(u);
}

export function FlashCard({ card, direction, onReview, isPending = false }: FlashCardProps) {
  const [flipped, setFlipped] = useState(false);
  // フリップアニメーション: 'idle' → 'out'（縮小）→ 'in'（拡大）→ 'idle'
  const [flipPhase, setFlipPhase] = useState<'idle' | 'out' | 'in'>('idle');

  function handleFlip() {
    if (flipped || flipPhase !== 'idle') return;
    setFlipPhase('out');
    setTimeout(() => {
      setFlipped(true);
      speak(card.phrase);
      setFlipPhase('in');
      setTimeout(() => setFlipPhase('idle'), 160);
    }, 140);
  }

  function handleReview(result: 'remembered' | 'forgotten') {
    setFlipped(false);
    setFlipPhase('idle');
    onReview(result);
  }

  const swipeRef = useSwipe<HTMLDivElement>(
    (dir) => handleReview(dir === 'right' ? 'remembered' : 'forgotten'),
    flipped,
  );

  const cardTransform = flipPhase === 'out' ? 'scaleX(0)' : 'scaleX(1)';
  const cardTransition =
    flipPhase === 'out'
      ? 'transform 0.14s ease-in'
      : flipPhase === 'in'
        ? 'transform 0.16s ease-out'
        : 'none';

  return (
    <div
      ref={swipeRef}
      className="flex flex-col gap-6 w-full"
      // 回答待ちの間は水平スワイプをブラウザに渡さない（縦スクロールは許可）
      style={{ touchAction: flipped ? 'pan-y' : 'auto' }}
    >
      <div style={{ position: 'relative' }}>
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
            transform: cardTransform,
            transition: cardTransition,
            willChange: 'transform',
          }}
        >
          {!flipped ? (
            <CardFront card={card} direction={direction} />
          ) : (
            <CardBack card={card} direction={direction} />
          )}
        </button>

        {/* O-1: JA→EN 表面では英語を読み上げると答えが漏れるため非表示 */}
        {(direction !== 'JA_TO_EN' || flipped) && <button
          onClick={(e) => { e.stopPropagation(); speak(card.phrase); }}
          aria-label="英語を読み上げる"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 18,
            color: 'var(--text-secondary)',
            padding: '4px 6px',
            borderRadius: 6,
            lineHeight: 1,
            opacity: 0.7,
          }}
        >
          🔊
        </button>}
      </div>

      {flipped && (
        <>
          <ReviewButtons onReview={handleReview} isPending={isPending} />
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', margin: 0 }}>
            スワイプでも回答できます（右: 覚えた / 左: 忘れた）
          </p>
        </>
      )}

      {!flipped && (
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center' }}>
          タップしてめくる
        </p>
      )}
    </div>
  );
}
