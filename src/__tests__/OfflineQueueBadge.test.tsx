import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OfflineQueueBadge } from '@/components/ui/OfflineQueueBadge';

// キュー件数をモック
vi.mock('@/hooks/useStudyCards', () => ({
  useQueueCount: vi.fn(() => ({ data: 0 })),
}));

vi.mock('@/lib/offline/flush', () => ({
  setupOnlineFlush: vi.fn(() => vi.fn()), // returns cleanup fn
}));

import { useQueueCount } from '@/hooks/useStudyCards';
import { setupOnlineFlush } from '@/lib/offline/flush';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OfflineQueueBadge', () => {
  it('1. キュー件数が0のとき何もレンダリングしない', () => {
    vi.mocked(useQueueCount).mockReturnValue({ data: 0 } as ReturnType<typeof useQueueCount>);
    const { container } = render(<OfflineQueueBadge />, { wrapper });
    expect(container.firstChild).toBeNull();
  });

  it('2. 件数が1以上のとき「未送信の回答 N件」を表示する', async () => {
    vi.mocked(useQueueCount).mockReturnValue({ data: 3 } as ReturnType<typeof useQueueCount>);
    await act(async () => {
      render(<OfflineQueueBadge />, { wrapper });
    });
    expect(screen.getByText('未送信の回答 3件')).toBeDefined();
  });

  it('3. マウント時に online イベントリスナーが登録され、アンマウントで解除される', async () => {
    const mockCleanup = vi.fn();
    vi.mocked(setupOnlineFlush).mockReturnValue(mockCleanup);
    vi.mocked(useQueueCount).mockReturnValue({ data: 1 } as ReturnType<typeof useQueueCount>);

    let unmount!: () => void;
    await act(async () => {
      ({ unmount } = render(<OfflineQueueBadge />, { wrapper }));
    });

    expect(setupOnlineFlush).toHaveBeenCalledTimes(1);

    unmount();
    expect(mockCleanup).toHaveBeenCalledTimes(1);
  });
});
