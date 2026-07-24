'use client';

import Link from 'next/link';
import { useScripts } from '@/hooks/useScript';
import type { ScriptCard } from '@/types';

function statusLabel(status: ScriptCard['status']): string {
  if (status === 'Perfect') return '完了';
  if (status === 'Memorizing') return '学習中';
  return 'Draft';
}

function statusColor(status: ScriptCard['status']): string {
  if (status === 'Perfect') return 'var(--remembered)';
  if (status === 'Memorizing') return 'var(--attention)';
  return 'var(--text-secondary)';
}

export default function ScriptListPage() {
  const { data: scripts, isLoading, isError, error } = useScripts();

  return (
    <main style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link
          href="/"
          style={{ color: 'var(--text-secondary)', fontSize: 14, textDecoration: 'none' }}
          aria-label="ホームへ戻る"
        >
          ← 戻る
        </Link>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
          スクリプト
        </h1>
      </div>

      <Link
        href="/script/sentence"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          padding: '18px 20px',
          borderRadius: 12,
          backgroundColor: 'var(--blue-accessible)',
          textDecoration: 'none',
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>1文ずつ学習する</span>
        <span style={{ fontSize: 14, color: 'rgba(255,255,255,.75)' }}>
          本日の復習文をフラッシュカードで学習
        </span>
      </Link>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
          スクリプト一覧（全文表示）
        </p>

        {isLoading && (
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', padding: '16px 0' }}>
            読み込み中...
          </p>
        )}

        {isError && (
          <p style={{ fontSize: 14, color: 'var(--forgotten)' }}>
            {error instanceof Error ? error.message : '取得に失敗しました'}
          </p>
        )}

        {scripts?.map((script) => (
          <Link
            key={script.id}
            href={`/script/${script.id}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderRadius: 12,
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              textDecoration: 'none',
              gap: 12,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {script.name}
              </p>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                {script.sentenceCount != null ? `${script.sentenceCount}文` : ''}
                {script.lastReviewed
                  ? ` · 最終: ${script.lastReviewed.slice(0, 10).replace(/-/g, '/')}`
                  : ''}
              </p>
            </div>
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: statusColor(script.status),
                flexShrink: 0,
              }}
            >
              {statusLabel(script.status)}
            </span>
          </Link>
        ))}

        {scripts?.length === 0 && (
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', padding: '16px 0' }}>
            スクリプトがありません。
          </p>
        )}
      </div>
    </main>
  );
}
