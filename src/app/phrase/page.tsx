'use client';

import { Suspense, useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  useStudyCards,
  useStudySources,
  useSubmitReview,
  generateSessionId,
  makeReviewPayload,
} from '@/hooks/useStudyCards';
import {
  FALLBACK_SOURCE_ID,
  loadDirection,
  loadSourceId,
  resolveStoredSourceId,
  saveDirection,
  saveSourceId,
} from '@/lib/study-mode';
import { FlashCard } from '@/components/card/FlashCard';
import type { CardSourceId, PhraseCard, StudyDirection, StudySource } from '@/types';
import Link from 'next/link';

const COUNT_OPTIONS = [10, 30, 50, 'all'] as const;
type CountOption = (typeof COUNT_OPTIONS)[number];

function loadSavedCount(): CountOption {
  if (typeof window === 'undefined') return 'all';
  const saved = localStorage.getItem('study-count');
  if (saved === 'all') return 'all';
  const n = parseInt(saved ?? '');
  return ([10, 30, 50] as number[]).includes(n) ? (n as CountOption) : 'all';
}

function btnStyle(selected: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '10px 0',
    borderRadius: 8,
    border: `1px solid ${selected ? 'var(--blue-accessible)' : 'var(--border)'}`,
    backgroundColor: selected ? 'var(--blue-accessible)' : 'transparent',
    color: selected ? '#fff' : 'var(--text-secondary)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  };
}

/** 静かなセグメント切替（出題方向・モード共通） */
function segmentStyle(selected: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '8px 0',
    borderRadius: 6,
    border: 'none',
    backgroundColor: selected ? 'var(--canvas)' : 'transparent',
    color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
    fontWeight: selected ? 600 : 400,
    fontSize: 14,
    cursor: 'pointer',
    boxShadow: selected ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
  };
}

const SEGMENT_GROUP_STYLE: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  padding: 4,
  backgroundColor: 'var(--surface)',
  borderRadius: 8,
  border: '1px solid var(--border)',
};

function PhrasePageInner() {
  const searchParams = useSearchParams();
  const { data: sources } = useStudySources();

  // M-3: hydration mismatch 防止 — 初期値は固定、useEffect でローカルストレージから読む
  const [sourceId, setSourceId] = useState<CardSourceId>(FALLBACK_SOURCE_ID);
  const [sourceReady, setSourceReady] = useState(false);

  const { data: cards, isLoading, isError, error, refetch } = useStudyCards(sourceId);
  const { mutate: submitReview } = useSubmitReview();

  const [sessionCards, setSessionCards] = useState<PhraseCard[] | null>(null);
  const [selectedCount, setSelectedCount] = useState<CountOption>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const [cardIndex, setCardIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [direction, setDirection] = useState<StudyDirection>('EN_TO_JA');
  const [sessionStats, setSessionStats] = useState({ remembered: 0, forgotten: 0 });
  // M-2: 保存失敗カウンタ
  const [failedCount, setFailedCount] = useState(0);
  // M-4: 2周目は練習モード（Notion に書き込まない）
  const [practiceMode, setPracticeMode] = useState(false);
  const sessionId = useRef(generateSessionId());

  // M-3: クライアントサイドでのみ localStorage を読む
  useEffect(() => {
    setSelectedCount(loadSavedCount());
  }, []);

  // ZA-04: URL の source を優先し、なければ前回モードを復元する
  useEffect(() => {
    if (!sources || sourceReady) return;
    const fromUrl = searchParams.get('source');
    const resolved = fromUrl
      ? resolveStoredSourceId(fromUrl, sources)
      : loadSourceId(sources);
    setSourceId(resolved);
    setSourceReady(true);
  }, [sources, sourceReady, searchParams]);

  const activeSource: StudySource | undefined = sources?.find((s) => s.id === sourceId);

  // 出題方向はソースごとに記憶する（未記憶ならソース既定 — リーディング語彙は EN→JA）
  useEffect(() => {
    if (!activeSource) return;
    setDirection(loadDirection(activeSource.id, activeSource.defaultDirection));
  }, [activeSource]);

  function changeSource(next: CardSourceId) {
    if (next === sourceId) return;
    // 進行中のセッションは持ち越さない（両DBのカードを混在させない）
    setSourceId(next);
    saveSourceId(next);
    setSessionCards(null);
    setSelectedTags([]);
    setCardIndex(0);
    setFinished(false);
    setSessionStats({ remembered: 0, forgotten: 0 });
    setFailedCount(0);
    setPracticeMode(false);
    sessionId.current = generateSessionId();
  }

  function changeDirection(next: StudyDirection) {
    setDirection(next);
    saveDirection(sourceId, next);
  }

  const showModeSwitch = !!sources && sources.length > 1;

  function ModeSwitch() {
    if (!showModeSwitch) return null;
    return (
      <div role="group" aria-label="学習モード" style={SEGMENT_GROUP_STYLE}>
        {sources!.map((s) => (
          <button
            key={s.id}
            onClick={() => changeSource(s.id)}
            aria-pressed={s.id === sourceId}
            style={segmentStyle(s.id === sourceId)}
          >
            {s.label}
          </button>
        ))}
      </div>
    );
  }

  function PageHeader({ title }: { title: string }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ color: 'var(--text-secondary)', fontSize: 14, textDecoration: 'none' }}>
          ← 戻る
        </Link>
        <h1 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
          {title}
        </h1>
        <span style={{ width: 44 }} />
      </div>
    );
  }

  /* ---------- 学習中は他の状態より優先して表示する ---------- */

  if (sessionCards && !finished) {
    const card = sessionCards[cardIndex];
    const total = sessionCards.length;
    const remaining = total - cardIndex;

    function handleReview(result: 'remembered' | 'forgotten') {
      const payload = makeReviewPayload(card, result, direction, sessionId.current, sourceId);
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

    return (
      <main style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ color: 'var(--text-secondary)', fontSize: 14, textDecoration: 'none' }} aria-label="ホームへ戻る">
            ← 戻る
          </Link>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{cardIndex + 1} / {total}</span>
          {/* M-4: 練習モード表示 / M-2: 保存失敗表示 */}
          {practiceMode ? (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', backgroundColor: 'var(--secondary-surface)', borderRadius: 4, padding: '2px 6px' }}>
              練習モード
            </span>
          ) : failedCount > 0 ? (
            <span style={{ fontSize: 13, color: 'var(--forgotten-accessible)' }}>
              ⚠ {failedCount}件失敗
            </span>
          ) : (
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>残り{remaining}枚</span>
          )}
        </div>

        <div role="progressbar" aria-valuenow={cardIndex} aria-valuemin={0} aria-valuemax={total}
          style={{ height: 4, borderRadius: 2, backgroundColor: 'var(--border)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${(cardIndex / total) * 100}%`,
            backgroundColor: 'var(--blue-accessible)', transition: 'width 0.3s ease',
          }} />
        </div>

        <div role="group" aria-label="出題方向" style={SEGMENT_GROUP_STYLE}>
          {(['EN_TO_JA', 'JA_TO_EN'] as const).map((d) => (
            <button
              key={d}
              onClick={() => changeDirection(d)}
              aria-pressed={direction === d}
              style={segmentStyle(direction === d)}
            >
              {d === 'EN_TO_JA' ? 'EN → JA' : 'JA → EN'}
            </button>
          ))}
        </div>

        <FlashCard
          key={card.id + direction}
          card={card}
          direction={direction}
          onReview={handleReview}
        />
      </main>
    );
  }

  /* ---------- 完了画面 ---------- */

  if (sessionCards && finished) {
    const total = sessionCards.length;

    function restartSession() {
      setCardIndex(0);
      setFinished(false);
      setSessionStats({ remembered: 0, forgotten: 0 });
      setFailedCount(0);
      setPracticeMode(true);
      sessionId.current = generateSessionId();
      // M-4 案A: sessionCards はそのまま（同じカードで練習モード再開）
    }

    return (
      <main style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>セッション完了</h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
          {activeSource ? `${activeSource.label}を` : ''}{total}枚を復習しました。
        </p>

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
          {/* M-4: 2周目は練習モード */}
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
          <button
            onClick={() => {
              setSessionCards(null);
              setCardIndex(0);
              setFinished(false);
              setSessionStats({ remembered: 0, forgotten: 0 });
              setFailedCount(0);
              setPracticeMode(false);
              sessionId.current = generateSessionId();
            }}
            style={{
              padding: '14px 24px', borderRadius: 8,
              border: '1px solid var(--border)', backgroundColor: 'var(--surface)',
              color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}
          >
            設定を変えて学習する
          </button>
          <Link
            href="/"
            style={{
              display: 'block', padding: '14px 24px', borderRadius: 8,
              backgroundColor: 'var(--blue-accessible)', color: '#fff',
              textAlign: 'center', fontWeight: 600, textDecoration: 'none',
            }}
          >
            ホームへ戻る
          </Link>
        </div>
      </main>
    );
  }

  /* ---------- loading / error ---------- */

  if (isLoading || !sourceReady) {
    return <div style={{ padding: '32px 24px', color: 'var(--text-secondary)' }}>読み込み中...</div>;
  }

  if (isError) {
    return (
      <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ color: 'var(--forgotten-accessible)', margin: 0 }}>
          カードの取得に失敗しました: {error instanceof Error ? error.message : '不明なエラー'}
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => refetch()}
            style={{
              padding: '10px 20px', borderRadius: 8,
              border: '1px solid var(--border)', backgroundColor: 'var(--surface)',
              color: 'var(--text-primary)', fontSize: 14, cursor: 'pointer',
            }}
          >
            再試行
          </button>
          <Link href="/" style={{ color: 'var(--blue-accessible)', fontSize: 14, lineHeight: '40px' }}>
            ホームへ戻る
          </Link>
        </div>
      </div>
    );
  }

  /* ---------- 開始前の設定画面 ---------- */

  const availableCards = cards ?? [];
  const allTags = Array.from(new Set(availableCards.flatMap((c) => c.tags))).sort();

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function buildFilteredCards(): PhraseCard[] {
    let filtered = availableCards;
    if (selectedTags.length > 0) {
      filtered = filtered.filter((c) => c.tags.some((t) => selectedTags.includes(t)));
    }
    if (selectedCount !== 'all') {
      filtered = filtered.slice(0, selectedCount as number);
    }
    return filtered;
  }

  function startSession() {
    const filtered = buildFilteredCards();
    if (filtered.length === 0) return;
    localStorage.setItem('study-count', String(selectedCount));
    saveSourceId(sourceId);
    sessionId.current = generateSessionId();
    setSessionCards(filtered);
  }

  const previewCount = buildFilteredCards().length;

  return (
    <main style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader title="今日の学習" />

      <ModeSwitch />

      <div style={{
        backgroundColor: 'var(--surface)', borderRadius: 12,
        border: '1px solid var(--border)', padding: '16px 20px',
      }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>今日の復習</p>
        <p style={{ margin: 0, fontSize: 36, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
          {availableCards.length}
          <span style={{ fontSize: 16, fontWeight: 400, marginLeft: 4, color: 'var(--text-secondary)' }}>件</span>
        </p>
      </div>

      {availableCards.length === 0 ? (
        <p style={{ margin: 0, fontSize: 15, color: 'var(--text-secondary)' }}>
          このモードの復習カードはありません。
          {showModeSwitch ? '別のモードを選ぶか、時間をおいて開いてください。' : ''}
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>問題数</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {COUNT_OPTIONS.map((n) => (
                <button key={String(n)} onClick={() => setSelectedCount(n)} style={btnStyle(selectedCount === n)}>
                  {n === 'all' ? '全て' : `${n}問`}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>出題方向</p>
            <div role="group" aria-label="出題方向" style={SEGMENT_GROUP_STYLE}>
              {(['EN_TO_JA', 'JA_TO_EN'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => changeDirection(d)}
                  aria-pressed={direction === d}
                  style={segmentStyle(direction === d)}
                >
                  {d === 'EN_TO_JA' ? 'EN → JA' : 'JA → EN'}
                </button>
              ))}
            </div>
          </div>

          {allTags.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                カテゴリ{' '}
                <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>
                  （任意・複数選択可）
                </span>
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    aria-pressed={selectedTags.includes(tag)}
                    style={{
                      padding: '6px 14px', borderRadius: 99,
                      border: `1px solid ${selectedTags.includes(tag) ? 'var(--blue-accessible)' : 'var(--border)'}`,
                      backgroundColor: selectedTags.includes(tag) ? 'var(--blue-accessible)' : 'transparent',
                      color: selectedTags.includes(tag) ? '#fff' : 'var(--text-secondary)',
                      fontSize: 14, cursor: 'pointer',
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={startSession}
            disabled={previewCount === 0}
            style={{
              marginTop: 4, padding: '16px', borderRadius: 12, border: 'none',
              backgroundColor: previewCount === 0 ? 'var(--border)' : 'var(--blue-accessible)',
              color: previewCount === 0 ? 'var(--text-secondary)' : '#fff',
              fontSize: 16, fontWeight: 700,
              cursor: previewCount === 0 ? 'default' : 'pointer',
            }}
          >
            {previewCount === 0
              ? '該当するカードがありません'
              : `学習を開始する（${previewCount}問）`}
          </button>
        </>
      )}
    </main>
  );
}

export default function PhrasePage() {
  return (
    <Suspense
      fallback={<div style={{ padding: '32px 24px', color: 'var(--text-secondary)' }}>読み込み中...</div>}
    >
      <PhrasePageInner />
    </Suspense>
  );
}
