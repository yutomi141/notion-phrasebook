'use client';

import { useEffect } from 'react';

export function SwRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[SW] Registration failed:', err);
    });
  }, []);
  return null;
}
