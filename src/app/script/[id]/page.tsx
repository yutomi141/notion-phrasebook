'use client';

import { useState } from 'react';
import Link from 'next/link';
import { use } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useScriptSentences, useScripts } from '@/hooks/useScript';

type DisplayMode = 'en' | 'ja' | 'both';

export default function ScriptFullPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [mode, setMode] = useState<DisplayMode>('en');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const qc = useQueryClient();

  const { data: sentences, isLoading, isError } = useScriptSentences(id);
  const { data: scripts } = useScripts();

  const script = scripts?.find((s) => s.id === id);
  const scriptName = script?.name ?? 'スクリプト';

  async function handleSync() {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await fetch(`/api/scripts/${id}/sync`, { method: 'POST' });
      const data = (await res.json()) as { created?: number; total?: number; error?: string };
      if (!res.ok) {
        setSyncMsg(`エラー: ${data.error ?? '同期失敗'}`);
      } else {
        setSyncMsg(`${data.created ?? 0}文を追加（合計 ${data.total ?? 0}文）`);
        await qc.invalidateQueries({ queryKey: ['script-sentences', id] });
        await qc.invalidateQueries({ queryKey: ['scripts'] });
      }
    } catch {
      setSyncMsg('同期中にエラーが発生しました');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <main style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link
          href="/script"
          style={{ color: 'var(--text-secondary)', fontSize: 14, textDecoration: 'none' }}
          aria-label="スクリプト一覧へ戻る"
        >
          ← 戻る
        </Link>
        <h1
          style={{
            fontSize: 16,
            fontWeight: 700,
            margin: 0,
            color: 'var(--text-primary)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {scriptName}
        </h1>
        <button
          onClick={handleSync}
          disabled={syncing}
          aria-label="Notionから文を同期"
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            backgroundColor: 'var(--surface)',
            color: 'var(--text-secondary)',
            fontSize: 14,
            cursor: syncing ? 'wait' : 'pointer',
            opacity: syncing ? 0.6 : 1,
            flexShrink: 0,
          }}
        >
          {syncing ? '同期中...' : '同期'}
        </button>
      </div>

      {syncMsg && (
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>{syncMsg}</p>
      )}

      {/* 表示切替 */}
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
        {(['en', 'ja', 'both'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: 6,
              border: 'none',
              backgroundColor: mode === m ? 'var(--canvas)' : 'transparent',
              color: mode === m ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: mode === m ? 600 : 400,
              fontSize: 14,
              cursor: 'pointer',
              boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
            }}
          >
            {m === 'en' ? 'EN' : m === 'ja' ? 'JA' : '対訳'}
          </button>
        ))}
      </div>

      {/* 本文 */}
      {isLoading && (
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', padding: '16px 0' }}>
          読み込み中...
        </p>
      )}

      {isError && (
        <div style={{ padding: '16px 0' }}>
          <p style={{ fontSize: 14, color: 'var(--forgotten)', margin: '0 0 12px' }}>
            文の取得に失敗しました
          </p>
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ['script-sentences', id] })}
            style={{
              padding: '8px 16px',
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
        </div>
      )}

      {sentences?.length === 0 && !isLoading && (
        <div style={{ padding: '16px 0' }}>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
            このスクリプトに文が登録されていません。「同期」ボタンでNotionから取り込めます。
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sentences?.map((s, i) => (
          <div
            key={s.id}
            style={{
              padding: '16px 20px',
              borderRadius: 12,
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 600 }}>
              {i + 1}
            </span>
            {(mode === 'en' || mode === 'both') && (
              <p
                className="font-card"
                style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--text-primary)', margin: 0 }}
              >
                {s.sentence}
              </p>
            )}
            {(mode === 'ja' || mode === 'both') && s.meaning && (
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: mode === 'both' ? 'var(--text-secondary)' : 'var(--text-primary)',
                  margin: 0,
                }}
              >
                {s.meaning}
              </p>
            )}
            {(mode === 'ja' || mode === 'both') && !s.meaning && (
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>（訳なし）</p>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
