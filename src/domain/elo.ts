import { type Contender, type ContenderId, type EloRankedContender, idsEqual } from "./types";

export const DEFAULT_ELO_K = 24;
export const DEFAULT_ELO_RATING = 1500;

export interface EloUpdateResult {
  winnerRating: number;
  loserRating: number;
  winnerDelta: number;
  loserDelta: number;
}

export interface EloTracker {
  /** Apply one duel; both ids must belong to the tracker. */
  recordDuel(winnerId: ContenderId, loserId: ContenderId): EloUpdateResult;
  getRanking(): EloRankedContender[];
  getRating(id: ContenderId): number;
}

/** Classic Elo expected score for player A vs B. */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

/**
 * Elo rating update for a decisive duel (winner / loser).
 * K defaults to 24 for readable movement on short tournaments.
 */
export function eloUpdate(
  winnerRating: number,
  loserRating: number,
  k: number = DEFAULT_ELO_K,
): EloUpdateResult {
  const expWinner = expectedScore(winnerRating, loserRating);
  const expLoser = expectedScore(loserRating, winnerRating);
  const winnerDelta = k * (1 - expWinner);
  const loserDelta = k * (0 - expLoser);
  return {
    winnerRating: winnerRating + winnerDelta,
    loserRating: loserRating + loserDelta,
    winnerDelta,
    loserDelta,
  };
}

export interface EloTrackerOptions {
  k?: number;
  initialRating?: number;
}

/** Stateful Elo helper for side-by-side comparison with the Swiss tournament. */
export function createEloTracker(items: Contender[], options: EloTrackerOptions = {}): EloTracker {
  const k = options.k ?? DEFAULT_ELO_K;
  const initial = options.initialRating ?? DEFAULT_ELO_RATING;

  const contenders = new Map<string, Contender>();
  const ratings = new Map<string, number>();
  const wins = new Map<string, number>();
  const losses = new Map<string, number>();

  for (const item of items) {
    const key = String(item.id);
    if (contenders.has(key)) continue;
    contenders.set(key, item);
    ratings.set(key, initial);
    wins.set(key, 0);
    losses.set(key, 0);
  }

  const resolveKey = (id: ContenderId): string => {
    const key = String(id);
    if (!contenders.has(key)) {
      throw new Error(`Unknown contender id: ${String(id)}`);
    }
    return key;
  };

  return {
    recordDuel(winnerId, loserId) {
      const wKey = resolveKey(winnerId);
      const lKey = resolveKey(loserId);
      if (wKey === lKey) {
        throw new Error("Winner and loser must be different");
      }
      const result = eloUpdate(ratings.get(wKey)!, ratings.get(lKey)!, k);
      ratings.set(wKey, result.winnerRating);
      ratings.set(lKey, result.loserRating);
      wins.set(wKey, (wins.get(wKey) ?? 0) + 1);
      losses.set(lKey, (losses.get(lKey) ?? 0) + 1);
      return result;
    },

    getRating(id) {
      return ratings.get(resolveKey(id))!;
    },

    getRanking() {
      const ranked = [...contenders.entries()]
        .map(([key, contender]) => ({
          ...contender,
          rating: ratings.get(key)!,
          wins: wins.get(key)!,
          losses: losses.get(key)!,
        }))
        .sort((a, b) => {
          if (b.rating !== a.rating) return b.rating - a.rating;
          if (b.wins !== a.wins) return b.wins - a.wins;
          return String(a.id).localeCompare(String(b.id));
        })
        .map((row, index) => ({ ...row, rank: index + 1 }));
      return ranked;
    },
  };
}

/** Convenience: replay a list of duels onto a fresh Elo table. */
export function rankByEloDuels(
  items: Contender[],
  duels: ReadonlyArray<{ winnerId: ContenderId; loserId: ContenderId }>,
  options?: EloTrackerOptions,
): EloRankedContender[] {
  const tracker = createEloTracker(items, options);
  for (const duel of duels) {
    tracker.recordDuel(duel.winnerId, duel.loserId);
  }
  return tracker.getRanking();
}

export function findContender(
  items: ReadonlyArray<Contender>,
  id: ContenderId,
): Contender | undefined {
  return items.find((c) => idsEqual(c.id, id));
}
