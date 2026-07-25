'use client';

import { useEffect, useState } from 'react';
import { setupOnlineFlush } from '@/lib/offline/flush';
import { useQueueCount } from '@/hooks/useStudyCards';

export function OfflineQueueBadge() {
  const { data: count = 0 } = useQueueCount();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const cleanup = setupOnlineFlush();
    return cleanup;
  }, []);

  if (!mounted || count === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--color-attention)',
        color: '#fff',
        borderRadius: '9999px',
        padding: '4px 14px',
        fontSize: '14px',
        fontFamily: 'var(--font-inter)',
        zIndex: 50,
        pointerEvents: 'none',
        opacity: 0.92,
      }}
    >
      未送信の回答 {count}件
    </div>
  );
}
