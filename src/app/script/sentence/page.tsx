'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useDueSentences, useSubmitSentenceReview, makeSentenceReviewPayload } from '@/hooks/useScript';
import { SentenceFlashCard } from '@/components/card/SentenceFlashCard';
import { generateSessionId } from '@/hooks/useStudyCards';
import type { StudyDirection } from '@/types';

export default function SentenceStudyPage() {
  const { data: sentences, isLoading, isError, error } = useDueSentences();
  const { mutate: submitReview } = useSubmitSentenceReview();
  const [cardIndex, setCardIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [direction, setDirection] = useState<StudyDirection>('EN_TO_JA');
  const [sessionStats, setSessionStats] = useState({ remembered: 0, forgotten: 0 });
  // M-2: 保存失敗カウンタ
  const [failedCount, setFailedCount] = useState(0);
  // M-4: 2周目は練習モード（Notion に書き込まない）
  const [practiceMode, setPracticeMode] = useState(false);
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
              padding: '10px 20px', borderRadius: 8,
              border: '1px solid var(--border)', backgroundColor: 'var(--surface)',
              color: 'var(--text-primary)', fontSize: 14, cursor: 'pointer',
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
        <Link href="/script" style={{ color: 'var(--blue-accessible)' }}>
          スクリプト一覧へ戻る
        </Link>
      </div>
    );
  }

  const total = sentences.length;

  function handleReview(result: 'remembered' | 'forgotten') {
    const sentence = sentences![cardIndex];
    const payload = makeSentenceReviewPayload(sentence, result, direction, sessionId.current);
    setSessionStats((s) => ({
      remembered: s.remembered + (result === 'remembered' ? 1 : 0),
      forgotten: s.forgotten + (result === 'forgotten' ? 1 : 0),
    }));
    // 即座に次のカードへ（楽観的更新）
    if (cardIndex >= total - 1) {
      setFinished(true);
    } else {
      setCardIndex((i) => i + 1);
    }
    // M-4: 練習モード中は Notion に書き込まない
    if (!practiceMode) {
      submitReview(
        { payload },
        // M-2: 保存失敗を静かに集計する（カード進行は止めない）
        { onError: () => setFailedCount((n) => n + 1) },
      );
    }
  }

  if (finished) {
    function restartSession() {
      setCardIndex(0);
      setFinished(false);
      setSessionStats({ remembered: 0, forgotten: 0 });
      setFailedCount(0);
      setPracticeMode(true);
      sessionId.current = generateSessionId();
    }

    return (
      <main style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>セッション完了</h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{total}文を復習しました。</p>

        {/* M-2: 保存失敗通知 */}
        {failedCount > 0 && (
          <p style={{ margin: 0, color: 'var(--forgotten-accessible)', fontSize: 14 }}>
            ⚠ {failedCount}件の回答が保存できませんでした
          </p>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { label: '覚えた', count: sessionStats.remembered, color: 'var(--remembered-accessible)' },
            { label: '忘れた', count: sessionStats.forgotten, color: 'var(--forgotten-accessible)' },
          ].map(({ label, count, color }) => (
            <div key={label} style={{
              flex: 1, padding: '16px', textAlign: 'center',
              backgroundColor: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)',
            }}>
              <p style={{ margin: 0, fontSize: 32, fontWeight: 700, color }}>{count}</p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>{label}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={restartSession}
            style={{
              padding: '14px 24px', borderRadius: 8,
              border: '1px solid var(--border)', backgroundColor: 'var(--surface)',
              color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}
          >
            もう一度練習する（記録なし）
          </button>
          <Link
            href="/script"
            style={{
              display: 'block', padding: '14px 24px', borderRadius: 8,
              backgroundColor: 'var(--blue-accessible)', color: '#fff',
              textAlign: 'center', fontWeight: 600, textDecoration: 'none',
            }}
          >
            スクリプト一覧へ戻る
          </Link>
        </div>
      </main>
    );
  }

  const sentence = sentences[cardIndex];
  const remaining = total - cardIndex;

  return (
    <main style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/script" style={{ color: 'var(--text-secondary)', fontSize: 14, textDecoration: 'none' }} aria-label="スクリプト一覧へ戻る">
          ← 戻る
        </Link>
        <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{cardIndex + 1} / {total}</span>
        {practiceMode ? (
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', backgroundColor: 'var(--secondary-surface)', borderRadius: 4, padding: '2px 6px' }}>
            練習モード
          </span>
        ) : failedCount > 0 ? (
          <span style={{ fontSize: 13, color: 'var(--forgotten-accessible)' }}>
            ⚠ {failedCount}件失敗
          </span>
        ) : (
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>残り{remaining}文</span>
        )}
      </div>

      <div role="progressbar" aria-valuenow={cardIndex} aria-valuemin={0} aria-valuemax={total}
        style={{ height: 4, borderRadius: 2, backgroundColor: 'var(--border)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${(cardIndex / total) * 100}%`,
          backgroundColor: 'var(--blue-accessible)', transition: 'width 0.3s ease',
        }} />
      </div>

      <div style={{ display: 'flex', gap: 8, padding: 4, backgroundColor: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
        {(['EN_TO_JA', 'JA_TO_EN'] as const).map((d) => (
          <button key={d} onClick={() => setDirection(d)} style={{
            flex: 1, padding: '8px 0', borderRadius: 6, border: 'none',
            backgroundColor: direction === d ? 'var(--canvas)' : 'transparent',
            color: direction === d ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: direction === d ? 600 : 400, fontSize: 14, cursor: 'pointer',
            boxShadow: direction === d ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
          }}>
            {d === 'EN_TO_JA' ? 'EN → JA' : 'JA → EN'}
          </button>
        ))}
      </div>

      <SentenceFlashCard
        key={sentence.id + direction}
        card={sentence}
        direction={direction}
        onReview={handleReview}
      />
    </main>
  );
}
