'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useDueSentences, useSubmitSentenceReview, makeSentenceReviewPayload } from '@/hooks/useScript';
import { SentenceFlashCard } from '@/components/card/SentenceFlashCard';
import { generateSessionId } from '@/hooks/useStudyCards';
import type { StudyDirection } from '@/types';

export default function SentenceStudyPage() {
  const { data: sentences, isLoading, isError, error } = useDueSentences();
  const { mutate: submitReview, isPending, isError: submitError } = useSubmitSentenceReview();
  const [cardIndex, setCardIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [direction, setDirection] = useState<StudyDirection>('EN_TO_JA');
  const [syncState, setSyncState] = useState<'idle' | 'pending' | 'done' | 'error'>('idle');
  const sessionId = useRef(generateSessionId());

  if (isLoading) {
    return (
      <div style={{ padding: '32px 24px', color: 'var(--text-secondary)' }}>読み込み中...</div>
    );
  }

  if (isError) {
    return (
      <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ color: 'var(--forgotten-accessible)', margin: 0 }}>
          文の取得に失敗しました: {error instanceof Error ? error.message : '不明なエラー'}
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface)',
              color: 'var(--text-primary)',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            再試行
          </button>
          <Link href="/script" style={{ color: 'var(--blue-accessible)', fontSize: 14, lineHeight: '40px' }}>
            スクリプト一覧へ戻る
          </Link>
        </div>
      </div>
    );
  }

  if (!sentences || sentences.length === 0) {
    return (
      <div style={{ padding: '32px 24px' }}>
        <p style={{ color: 'var(--text-secondary)' }}>本日の復習文はありません。</p>
        <Link href="/script" style={{ color: 'var(--blue)' }}>
          スクリプト一覧へ戻る
        </Link>
      </div>
    );
  }

  const sentence = sentences[cardIndex];
  const total = sentences.length;
  const remaining = total - cardIndex;

  function handleReview(result: 'remembered' | 'forgotten') {
    setSyncState('pending');
    const payload = makeSentenceReviewPayload(sentence, result, direction, sessionId.current);
    submitReview(
      { payload },
      {
        onSuccess: () => {
          if (cardIndex >= total - 1) {
            setFinished(true);
          } else {
            setCardIndex((i) => i + 1);
            setSyncState('idle');
          }
        },
        onError: () => setSyncState('error'),
      },
    );
  }

  if (finished) {
    return (
      <main style={{ padding: '32px 24px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>セッション完了</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>{total}文を復習しました。</p>
        <Link
          href="/script"
          style={{
            display: 'block',
            marginTop: 32,
            padding: '14px 24px',
            borderRadius: 8,
            backgroundColor: 'var(--blue)',
            color: '#fff',
            textAlign: 'center',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          スクリプト一覧へ戻る
        </Link>
      </main>
    );
  }

  return (
    <main style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link
          href="/script"
          style={{ color: 'var(--text-secondary)', fontSize: 14, textDecoration: 'none' }}
          aria-label="スクリプト一覧へ戻る"
        >
          ← 戻る
        </Link>
        <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          {cardIndex + 1} / {total}
        </span>
        <span
          style={{
            fontSize: 14,
            color:
              syncState === 'pending'
                ? 'var(--attention-accessible)'
                : syncState === 'error' || submitError
                ? 'var(--forgotten-accessible)'
                : syncState === 'done'
                ? 'var(--remembered-accessible)'
                : 'var(--text-secondary)',
          }}
          aria-live="polite"
        >
          {syncState === 'pending'
            ? '同期中...'
            : syncState === 'error' || submitError
            ? '同期エラー'
            : syncState === 'done'
            ? '同期済み'
            : `残り${remaining}文`}
        </span>
      </div>

      {/* プログレスバー */}
      <div
        role="progressbar"
        aria-valuenow={cardIndex}
        aria-valuemin={0}
        aria-valuemax={total}
        style={{ height: 4, borderRadius: 2, backgroundColor: 'var(--border)', overflow: 'hidden' }}
      >
        <div
          style={{
            height: '100%',
            width: `${(cardIndex / total) * 100}%`,
            backgroundColor: 'var(--blue)',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* 方向切替 */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: 4,
          backgroundColor: 'var(--surface)',
          borderRadius: 8,
          border: '1px solid var(--border)',
        }}
      >
        {(['EN_TO_JA', 'JA_TO_EN'] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDirection(d)}
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: 6,
              border: 'none',
              backgroundColor: direction === d ? 'var(--canvas)' : 'transparent',
              color: direction === d ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: direction === d ? 600 : 400,
              fontSize: 14,
              cursor: 'pointer',
              boxShadow: direction === d ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
            }}
          >
            {d === 'EN_TO_JA' ? 'EN → JA' : 'JA → EN'}
          </button>
        ))}
      </div>

      {/* カード */}
      <SentenceFlashCard
        key={sentence.id + direction}
        card={sentence}
        direction={direction}
        onReview={handleReview}
        isPending={isPending}
      />
    </main>
  );
}
