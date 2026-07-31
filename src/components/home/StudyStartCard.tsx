'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useStudySources } from '@/hooks/useStudyCards';
import { loadSourceId } from '@/lib/study-mode';

/**
 * ZA-04: 前回のモードでワンタップ開始する主操作。
 *
 * 遷移先は常に /phrase。モードの復元は /phrase 側でも行うため、
 * この表示はどのモードで始まるかを静かに示すだけに留める。
 */
export function StudyStartCard() {
  const { data: sources } = useStudySources();
  const [label, setLabel] = useState<string | null>(null);

  // M-3: hydration mismatch 防止 — localStorage はクライアントでのみ読む
  useEffect(() => {
    if (!sources || sources.length < 2) return;
    const id = loadSourceId(sources);
    setLabel(sources.find((s) => s.id === id)?.label ?? null);
  }, [sources]);

  return (
    <Link
      href="/phrase"
      className="flex flex-col gap-1 py-6 px-5 rounded-xl bg-[var(--blue-accessible)] no-underline min-h-[88px]"
    >
      <span className="text-[17px] font-bold text-white">今日の学習を始める</span>
      <span className="text-sm text-white/80">
        {label ? `前回のモード：${label}` : 'フレーズ復習カードを表示します'}
      </span>
    </Link>
  );
}
