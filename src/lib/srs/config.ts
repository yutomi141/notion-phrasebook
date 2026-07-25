export const SRS = {
  INITIAL_INTERVAL:   parseInt(process.env.SRS_INITIAL_INTERVAL_DAYS ?? '1'),
  SECOND_INTERVAL:    parseInt(process.env.SRS_SECOND_INTERVAL_DAYS ?? '3'),
  EASE_FACTOR:        parseFloat(process.env.SRS_EASE_FACTOR ?? '2.5'),
  MAX_INTERVAL:       parseInt(process.env.SRS_MAX_INTERVAL_DAYS ?? '365'),
  MASTERED_STREAK:    parseInt(process.env.SRS_MASTERED_STREAK ?? '3'),
  MASTERED_INTERVAL:  parseInt(process.env.SRS_MASTERED_INTERVAL_DAYS ?? '7'),
} as const;
