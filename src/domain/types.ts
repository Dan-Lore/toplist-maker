/** Contender identity used throughout the ranking domain. */
export type ContenderId = string | number;

/**
 * A single item that can enter a tournament / Elo ranking.
 * Extra fields (e.g. Shikimori metadata) are allowed and preserved.
 */
export interface Contender {
  id: ContenderId;
  title: string;
  titleRu?: string;
  score?: number;
  status?: string;
  imageUrl?: string;
}

/** One pairwise duel awaiting a winner. */
export interface Pair {
  a: Contender;
  b: Contender;
}

/** Contender with tournament stats after (or during) play. */
export interface RankedContender extends Contender {
  rank: number;
  /** Wins (including byes). */
  counter: number;
  /** Sum of opponents' counters (Buchholz-style strength of schedule). */
  coef: number;
  opponents: ContenderId[];
}

/** Contender with Elo rating. */
export interface EloRankedContender extends Contender {
  rank: number;
  rating: number;
  wins: number;
  losses: number;
}

export function idsEqual(a: ContenderId, b: ContenderId): boolean {
  return a === b || String(a) === String(b);
}
