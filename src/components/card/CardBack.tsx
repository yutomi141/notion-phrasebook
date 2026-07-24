import type { PhraseCard, StudyDirection } from '@/types';

interface CardBackProps {
  card: PhraseCard;
  direction: StudyDirection;
}

export function CardBack({ card, direction }: CardBackProps) {
  const isEnToJa = direction === 'EN_TO_JA';

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
        {isEnToJa ? 'EN' : 'JA'}
      </span>
      <p
        className={isEnToJa ? 'font-card' : undefined}
        style={{
          fontSize: isEnToJa ? 28 : 22,
          lineHeight: 1.4,
          color: 'var(--text-primary)',
          margin: 0,
        }}
      >
        {isEnToJa ? card.phrase : card.meaning}
      </p>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '4px 0' }} />

      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: '0.08em',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
        }}
      >
        {isEnToJa ? 'JA' : 'EN'}
      </span>
      <p
        className={!isEnToJa ? 'font-card' : undefined}
        style={{
          fontSize: !isEnToJa ? 28 : 18,
          lineHeight: 1.5,
          color: 'var(--text-primary)',
          margin: 0,
        }}
      >
        {isEnToJa ? card.meaning : card.phrase}
      </p>

      {card.example && (
        <>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '4px 0' }} />
          <p
            className="font-card"
            style={{
              fontSize: 15,
              lineHeight: 1.6,
              color: 'var(--text-secondary)',
              margin: 0,
            }}
          >
            {card.example}
          </p>
        </>
      )}
    </>
  );
}
