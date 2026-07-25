import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex flex-col min-h-dvh pt-12 px-6 pb-8">
      <header className="mb-12">
        <h1 className="text-[22px] font-bold text-[var(--text-primary)] m-0">
          English Phrasebook
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          自分専用の英語フラッシュカード
        </p>
      </header>

      <section className="flex flex-col gap-3 flex-1">
        {/* メイン CTA */}
        <Link
          href="/phrase"
          className="flex flex-col gap-1 py-6 px-5 rounded-xl bg-[var(--blue-accessible)] no-underline min-h-[88px]"
        >
          <span className="text-[17px] font-bold text-white">
            今日の学習を始める
          </span>
          <span className="text-sm text-white/80">
            フレーズ復習カードを表示します
          </span>
        </Link>

        <Link
          href="/script"
          className="flex flex-col gap-1 p-5 rounded-xl bg-[var(--surface)] border border-[var(--border)] no-underline min-h-[80px]"
        >
          <span className="text-base font-semibold text-[var(--text-primary)]">
            スクリプトを学習する
          </span>
          <span className="text-sm text-[var(--text-secondary)]">
            全文表示・1文ずつ復習
          </span>
        </Link>
      </section>
    </main>
  );
}
