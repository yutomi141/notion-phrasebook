import type { PhraseCard, StudyDirection } from '@/types';

interface CardFrontProps {
  card: PhraseCard;
  direction: StudyDirection;
}

export function CardFront({ card, direction }: CardFrontProps) {
  const isEnToJa = direction === 'EN_TO_JA';
  const question = isEnToJa ? card.phrase : card.meaning;
  const label = isEnToJa ? 'EN' : 'JA';

  return (
    <>
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: '0.08em',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <p
        className="font-card"
        style={{
          fontSize: isEnToJa ? 28 : 22,
          lineHeight: 1.4,
          color: 'var(--text-primary)',
          margin: 0,
        }}
      >
        {question}
      </p>
      {card.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'auto' }}>
          {card.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 14,
                padding: '2px 8px',
                borderRadius: 99,
                backgroundColor: 'var(--surface-secondary)',
                color: 'var(--text-secondary)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </>
  );
}
