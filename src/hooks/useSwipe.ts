'use client';

import { useEffect, useRef } from 'react';

/** スワイプ成立に必要な水平移動量(px) */
const SWIPE_THRESHOLD = 60;
/** 縦横どちらのジェスチャーかを確定させる移動量(px) */
const DIRECTION_LOCK = 10;

/**
 * 水平スワイプを検出するフック。
 * React の onTouchMove は passive リスナーとして登録されるため preventDefault が効かない。
 * ここでは ref 経由でネイティブリスナーを passive:false で張り、
 * 水平方向と判定した時点でブラウザの縦スクロール／バウンスを止める。
 */
export function useSwipe<T extends HTMLElement>(
  onSwipe: (direction: 'left' | 'right') => void,
  enabled: boolean,
) {
  const ref = useRef<T>(null);
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    let startX = 0;
    let startY = 0;
    let axis: 'none' | 'x' | 'y' = 'none';

    const handleStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      axis = 'none';
    };

    const handleMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      if (axis === 'none') {
        if (Math.abs(dx) < DIRECTION_LOCK && Math.abs(dy) < DIRECTION_LOCK) return;
        axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
      // 水平スワイプ中は画面が上下に動かないようにする
      if (axis === 'x' && e.cancelable) e.preventDefault();
    };

    const handleEnd = (e: TouchEvent) => {
      if (axis !== 'x') return;
      const dx = e.changedTouches[0].clientX - startX;
      axis = 'none';
      if (Math.abs(dx) > SWIPE_THRESHOLD) {
        onSwipeRef.current(dx > 0 ? 'right' : 'left');
      }
    };

    el.addEventListener('touchstart', handleStart, { passive: true });
    el.addEventListener('touchmove', handleMove, { passive: false });
    el.addEventListener('touchend', handleEnd, { passive: true });
    el.addEventListener('touchcancel', handleEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleStart);
      el.removeEventListener('touchmove', handleMove);
      el.removeEventListener('touchend', handleEnd);
      el.removeEventListener('touchcancel', handleEnd);
    };
  }, [enabled]);

  return ref;
}
