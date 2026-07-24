import Link from 'next/link';

export default function Home() {
  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '48px 24px 32px',
        minHeight: '100dvh',
      }}
    >
      <header style={{ marginBottom: 48 }}>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          English Phrasebook
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
          自分専用の英語フラッシュカード
        </p>
      </header>

      <section
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          flex: 1,
        }}
      >
        {/* メイン CTA */}
        <Link
          href="/phrase"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            padding: '24px 20px',
            borderRadius: 12,
            backgroundColor: 'var(--blue-accessible)',
            textDecoration: 'none',
            minHeight: 88,
          }}
        >
          <span
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: '#ffffff',
            }}
          >
            今日の学習を始める
          </span>
          <span style={{ fontSize: 14, color: 'rgba(255,255,255,.8)' }}>
            フレーズ復習カードを表示します
          </span>
        </Link>

        <Link
          href="/script"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            padding: '20px 20px',
            borderRadius: 12,
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            textDecoration: 'none',
            minHeight: 80,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
            スクリプトを学習する
          </span>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            全文表示・1文ずつ復習
          </span>
        </Link>
      </section>
    </main>
  );
}
