'use client';

interface ReviewButtonsProps {
  onReview: (result: 'remembered' | 'forgotten') => void;
  isPending: boolean;
}

export function ReviewButtons({ onReview, isPending }: ReviewButtonsProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
      }}
    >
      <button
        onClick={() => onReview('forgotten')}
        disabled={isPending}
        aria-label="忘れた"
        style={{
          minHeight: 56,
          borderRadius: 8,
          border: `1px solid var(--forgotten-accessible)`,
          backgroundColor: 'transparent',
          color: 'var(--forgotten-accessible)',
          fontSize: 16,
          fontWeight: 600,
          cursor: isPending ? 'wait' : 'pointer',
          opacity: isPending ? 0.6 : 1,
        }}
      >
        忘れた
      </button>
      <button
        onClick={() => onReview('remembered')}
        disabled={isPending}
        aria-label="覚えた"
        style={{
          minHeight: 56,
          borderRadius: 8,
          border: 'none',
          backgroundColor: 'var(--remembered-accessible)',
          color: '#ffffff',
          fontSize: 16,
          fontWeight: 600,
          cursor: isPending ? 'wait' : 'pointer',
          opacity: isPending ? 0.6 : 1,
        }}
      >
        覚えた
      </button>
    </div>
  );
}
