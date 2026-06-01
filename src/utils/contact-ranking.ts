const TITLE_RANKS: { pattern: RegExp; score: number }[] = [
  { pattern: /\bfounder\b/i, score: 100 },
  { pattern: /\bco-?founder\b/i, score: 99 },
  { pattern: /\bceo\b/i, score: 95 },
  { pattern: /\bcto\b/i, score: 90 },
  { pattern: /\bcio\b/i, score: 88 },
  { pattern: /\bchief\b/i, score: 85 },
  { pattern: /\bvp\b|\bvice president\b/i, score: 80 },
  { pattern: /\bdirector\b/i, score: 70 },
  { pattern: /\bhead of\b|\bhead,\b/i, score: 65 },
  { pattern: /\bmanager\b/i, score: 55 },
  { pattern: /\blead\b/i, score: 50 },
  { pattern: /\bsenior engineer\b/i, score: 40 },
  { pattern: /\bengineer\b/i, score: 30 },
];

export function scorePosition(position: string | null | undefined): number {
  if (!position) return 0;
  let max = 0;
  for (const { pattern, score } of TITLE_RANKS) {
    if (pattern.test(position)) {
      max = Math.max(max, score);
    }
  }
  return max;
}
