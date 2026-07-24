'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useIngestText, type IngestResult } from '@/hooks/useIngest';

const MAX_CHARS = 8000;

export default function IngestPage() {
  const [text, setText] = useState('');
  const { mutate, isPending, data, error, reset } = useIngestText();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    reset();
    mutate(text.trim());
  }

  const charCount = text.length;
  const isOverLimit = charCount > MAX_CHARS;

  return (
    <main style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link
          href="/"
          style={{ color: 'var(--text-secondary)', fontSize: 14, textDecoration: 'none' }}
          aria-label="ホームへ戻る"
        >
          ← 戻る
        </Link>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
          フレーズを取り込む
        </h1>
      </div>

      <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
        英会話のトランスクリプトを貼り付けると、AIが学習フレーズを抽出してNotionに登録します。
      </p>

      {!data && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="英会話のトランスクリプトをここに貼り付けてください..."
              disabled={isPending}
              rows={12}
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: 12,
                border: `1px solid ${isOverLimit ? 'var(--forgotten-accessible)' : 'var(--border)'}`,
                backgroundColor: 'var(--surface)',
                color: 'var(--text-primary)',
                fontSize: 14,
                lineHeight: 1.6,
                resize: 'vertical',
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
                opacity: isPending ? 0.6 : 1,
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid var(--blue-accessible)';
                e.currentTarget.style.outlineOffset = '2px';
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = 'none';
              }}
              aria-label="トランスクリプト入力"
              aria-invalid={isOverLimit}
            />
            <span
              style={{
                position: 'absolute',
                bottom: 10,
                right: 14,
                fontSize: 14,
                color: isOverLimit ? 'var(--forgotten-accessible)' : 'var(--text-secondary)',
              }}
              aria-live="polite"
            >
              {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </span>
          </div>

          {error && (
            <p
              role="alert"
              style={{
                fontSize: 14,
                color: 'var(--forgotten-accessible)',
                backgroundColor: 'rgba(192,64,64,.08)',
                padding: '10px 14px',
                borderRadius: 8,
                margin: 0,
              }}
            >
              {error instanceof Error ? error.message : '取り込みに失敗しました'}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending || !text.trim() || isOverLimit}
            style={{
              padding: '14px 20px',
              borderRadius: 12,
              border: 'none',
              backgroundColor: 'var(--blue-accessible)',
              color: '#fff',
              fontSize: 16,
              fontWeight: 600,
              cursor: isPending || !text.trim() || isOverLimit ? 'not-allowed' : 'pointer',
              opacity: isPending || !text.trim() || isOverLimit ? 0.5 : 1,
              minHeight: 52,
            }}
          >
            {isPending ? 'AIが抽出中...' : 'フレーズを抽出する'}
          </button>

          {isPending && (
            <p
              style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', margin: 0 }}
              aria-live="polite"
            >
              フレーズを分析しています。しばらくお待ちください...
            </p>
          )}
        </form>
      )}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* サマリー */}
          <div
            style={{
              padding: '16px 20px',
              borderRadius: 12,
              backgroundColor: data.created > 0 ? 'rgba(46,122,86,.08)' : 'var(--surface)',
              border: `1px solid ${data.created > 0 ? 'var(--remembered-accessible)' : 'var(--border)'}`,
            }}
          >
            <p style={{ fontSize: 16, fontWeight: 600, margin: '0 0 4px', color: 'var(--text-primary)' }}>
              {data.extractedCount === 0
                ? 'フレーズが見つかりませんでした'
                : `${data.extractedCount}個のフレーズを抽出`}
            </p>
            {data.extractedCount > 0 && (
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
                {data.created > 0 && (
                  <span style={{ color: 'var(--remembered-accessible)', fontWeight: 600 }}>
                    {data.created}個を新規登録
                  </span>
                )}
                {data.created > 0 && data.skipped > 0 && '　'}
                {data.skipped > 0 && `${data.skipped}個は重複のためスキップ`}
              </p>
            )}
          </div>

          {/* 結果リスト */}
          {data.results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
                抽出結果
              </p>
              {data.results.map((r: IngestResult, i: number) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 16px',
                    borderRadius: 10,
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <span
                    style={{ fontSize: 16, flexShrink: 0 }}
                    aria-label={r.status === 'created' ? '新規登録' : 'スキップ'}
                  >
                    {r.status === 'created' ? '✓' : '–'}
                  </span>
                  <span
                    style={{
                      fontSize: 15,
                      color: r.status === 'created' ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontFamily: 'var(--font-source-serif, "Source Serif 4"), Georgia, serif',
                      flex: 1,
                    }}
                  >
                    {r.phrase}
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: r.status === 'created' ? 'var(--remembered-accessible)' : 'var(--text-secondary)',
                      flexShrink: 0,
                    }}
                  >
                    {r.status === 'created' ? '登録済' : 'スキップ'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* もう一度ボタン */}
          <button
            onClick={() => {
              reset();
              setText('');
            }}
            style={{
              padding: '14px 20px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface)',
              color: 'var(--text-primary)',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              minHeight: 52,
            }}
          >
            別のトランスクリプトを取り込む
          </button>
        </div>
      )}
    </main>
  );
}
