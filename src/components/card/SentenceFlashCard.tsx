'use client';

import { useState, useRef, useCallback } from 'react';
import type { SentenceCard, StudyDirection } from '@/types';
import { ReviewButtons } from './ReviewButtons';

interface SentenceFlashCardProps {
  card: SentenceCard;
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

export function SentenceFlashCard({ card, direction, onReview, isPending = false }: SentenceFlashCardProps) {
  const [flipped, setFlipped] = useState(false);
  const isEnToJa = direction === 'EN_TO_JA';
  const frontText = isEnToJa ? card.sentence : card.meaning;
  const backText = isEnToJa ? card.meaning : card.sentence;
  const frontLabel = isEnToJa ? 'EN' : 'JA';
  const backLabel = isEnToJa ? 'JA' : 'EN';
  const frontSize = isEnToJa ? 22 : 18;
  const backMainSize = isEnToJa ? 18 : 22;
  const backSubSize = isEnToJa ? 14 : 16;
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  function handleFlip() {
    if (!flipped) {
      setFlipped(true);
      speak(card.sentence);
    }
  }

  function handleReview(result: 'remembered' | 'forgotten') {
    setFlipped(false);
    onReview(result);
  }

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!flipped) return;
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
      if (Math.abs(dx) > 60 && Math.abs(dx) > dy) {
        handleReview(dx > 0 ? 'remembered' : 'forgotten');
      }
    },
    [flipped],
  );

  return (
    <div
      className="flex flex-col gap-6 w-full"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
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
          }}
        >
          {!flipped ? (
            <>
              <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
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
              <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
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

        {/* O-1: JA→EN 表面では英語を読み上げると答えが漏れるため非表示 */}
        {(direction !== 'JA_TO_EN' || flipped) && <button
          onClick={(e) => { e.stopPropagation(); speak(card.sentence); }}
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
