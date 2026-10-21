import {
  type Contender,
  type ContenderId,
  type Pair,
  type RankedContender,
  idsEqual,
} from "./types";

export interface TournamentOptions {
  /**
   * Number of Swiss-ish rounds. Default: `ceil(log2(n))` (same as the
   * classic ToplistMaker script), minimum 1 when n >= 2.
   */
  rounds?: number;
  /**
   * How to seed the initial winners bracket.
   * - `score` (default): higher `score` first, then stable by id
   * - `order`: keep input order
   */
  seedBy?: "score" | "order";
}

export interface TournamentProgress {
  round: number;
  totalRounds: number;
  pairsPlayed: number;
  pairsTotal: number;
  pendingInRound: number;
}

export interface Tournament {
  nextPair(): Pair | null;
  recordWinner(id: ContenderId): void;
  isComplete(): boolean;
  getRanking(): RankedContender[];
  getProgress(): TournamentProgress;
}

interface Entry {
  contender: Contender;
  counter: number;
  opponents: ContenderId[];
}

interface PendingDuel {
  aId: ContenderId;
  bId: ContenderId;
}

function ceilLog2(n: number): number {
  if (n <= 1) return 0;
  return Math.ceil(Math.log2(n));
}

function compareIds(a: ContenderId, b: ContenderId): number {
  const as = String(a);
  const bs = String(b);
  if (as < bs) return -1;
  if (as > bs) return 1;
  return 0;
}

function seedWinBracket(items: Contender[], seedBy: "score" | "order"): ContenderId[] {
  if (seedBy === "order") {
    return items.map((c) => c.id);
  }
  return [...items]
    .sort((a, b) => {
      const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      return compareIds(a.id, b.id);
    })
    .map((c) => c.id);
}

function sortBracket(ids: ContenderId[], byId: Map<ContenderId, Entry>): ContenderId[] {
  return [...ids].sort((a, b) => {
    const ea = byId.get(a)!;
    const eb = byId.get(b)!;
    if (eb.counter !== ea.counter) return eb.counter - ea.counter;
    return compareIds(a, b);
  });
}

function estimatePairsTotal(n: number, totalRounds: number): number {
  if (n < 2 || totalRounds <= 0) return 0;
  // Each round: every active contestant plays or gets a bye; ~floor(n/2) duels.
  return totalRounds * Math.floor(n / 2);
}

/**
 * Pairwise Swiss-ish tournament inspired by the classic Python ToplistMaker:
 * winners / losers brackets, bye on odd counts, then rank by (counter, coef).
 */
export function createTournament(items: Contender[], options: TournamentOptions = {}): Tournament {
  const unique = dedupeById(items);
  const byId = new Map<ContenderId, Entry>();
  for (const contender of unique) {
    byId.set(contender.id, { contender, counter: 0, opponents: [] });
  }

  const n = unique.length;
  const totalRounds = options.rounds ?? (n < 2 ? 0 : Math.max(1, ceilLog2(n)));
  const seedBy = options.seedBy ?? "score";

  let win: ContenderId[] = seedWinBracket(unique, seedBy);
  let lose: ContenderId[] = [];
  let round = 0;
  let pairsPlayed = 0;
  const pairsTotal = estimatePairsTotal(n, totalRounds);

  let pending: PendingDuel[] = [];
  let current: PendingDuel | null = null;
  let tmpWin: ContenderId[] = [];
  let tmpLose: ContenderId[] = [];
  let finished = n < 2 || totalRounds === 0;

  const resolveId = (id: ContenderId): ContenderId => {
    for (const key of byId.keys()) {
      if (idsEqual(key, id)) return key;
    }
    throw new Error(`Unknown contender id: ${String(id)}`);
  };

  const applyBye = (id: ContenderId): void => {
    byId.get(id)!.counter += 1;
    tmpWin.push(id);
  };

  const enqueueBracket = (bracket: ContenderId[]): void => {
    let i = 0;
    while (i + 1 < bracket.length) {
      pending.push({ aId: bracket[i]!, bId: bracket[i + 1]! });
      i += 2;
    }
    if (i < bracket.length) {
      // Odd count → bye: free +1 and into winners side of the next bracket split.
      applyBye(bracket[i]!);
    }
  };

  const startRound = (): void => {
    if (finished || round >= totalRounds) {
      finished = true;
      pending = [];
      current = null;
      return;
    }
    round += 1;
    tmpWin = [];
    tmpLose = [];
    pending = [];
    current = null;
    enqueueBracket(win);
    enqueueBracket(lose);
    advanceCurrent();
  };

  const finishRoundIfNeeded = (): void => {
    if (current !== null || pending.length > 0) return;
    win = sortBracket(tmpWin, byId);
    lose = sortBracket(tmpLose, byId);
    if (round >= totalRounds) {
      finished = true;
      return;
    }
    startRound();
  };

  const advanceCurrent = (): void => {
    current = pending.shift() ?? null;
    if (current === null) {
      finishRoundIfNeeded();
    }
  };

  if (!finished) {
    startRound();
  }

  return {
    nextPair(): Pair | null {
      if (finished || current === null) return null;
      const a = byId.get(current.aId)!.contender;
      const b = byId.get(current.bId)!.contender;
      return { a, b };
    },

    recordWinner(id: ContenderId): void {
      if (finished || current === null) {
        throw new Error("No active pair to record a winner for");
      }
      const winnerId = resolveId(id);
      const { aId, bId } = current;
      if (!idsEqual(winnerId, aId) && !idsEqual(winnerId, bId)) {
        throw new Error(`Winner ${String(id)} is not in the current pair`);
      }
      const loserId = idsEqual(winnerId, aId) ? bId : aId;
      const winner = byId.get(winnerId)!;
      const loser = byId.get(loserId)!;
      winner.opponents.push(loserId);
      loser.opponents.push(winnerId);
      winner.counter += 1;
      tmpWin.push(winnerId);
      tmpLose.push(loserId);
      pairsPlayed += 1;
      current = null;
      advanceCurrent();
    },

    isComplete(): boolean {
      return finished && current === null && pending.length === 0;
    },

    getRanking(): RankedContender[] {
      const order =
        finished || round > 0
          ? [...win, ...lose, ...tmpWin, ...tmpLose].filter(
              (id, index, arr) => arr.indexOf(id) === index,
            )
          : [...byId.keys()];

      // Prefer active brackets; if mid-round, include everyone once.
      const allIds = unique.map((c) => c.id);
      const rankedIds =
        order.length === allIds.length
          ? order
          : [...order, ...allIds.filter((id) => !order.some((o) => idsEqual(o, id)))];

      const withCoef = rankedIds.map((id) => {
        const entry = byId.get(id)!;
        const coef = entry.opponents.reduce<number>((sum, oppId) => {
          const opp = byId.get(oppId);
          return sum + (opp?.counter ?? 0);
        }, 0);
        return { entry, coef };
      });

      withCoef.sort((a, b) => {
        if (b.entry.counter !== a.entry.counter) {
          return b.entry.counter - a.entry.counter;
        }
        if (b.coef !== a.coef) return b.coef - a.coef;
        return compareIds(a.entry.contender.id, b.entry.contender.id);
      });

      return withCoef.map(({ entry, coef }, index) => ({
        ...entry.contender,
        rank: index + 1,
        counter: entry.counter,
        coef,
        opponents: [...entry.opponents],
      }));
    },

    getProgress(): TournamentProgress {
      return {
        round: finished && n < 2 ? 0 : round,
        totalRounds,
        pairsPlayed,
        pairsTotal,
        pendingInRound: pending.length + (current ? 1 : 0),
      };
    },
  };
}

function dedupeById(items: Contender[]): Contender[] {
  const seen = new Set<string>();
  const out: Contender[] = [];
  for (const item of items) {
    const key = String(item.id);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Pick completed items with the highest score (MVP shortlist).
 * Stable tie-break by id. Does not mutate input.
 */
export function selectTopCompleted(
  items: ReadonlyArray<Contender & { status?: string; score?: number }>,
  limit = 32,
): Contender[] {
  return items
    .filter((item) => item.status === "completed")
    .sort((a, b) => {
      const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      return compareIds(a.id, b.id);
    })
    .slice(0, Math.max(0, limit))
    .map(({ id, title, titleRu, score, status, imageUrl, source, shikiId, malId }) => ({
      id,
      title,
      titleRu,
      score,
      status,
      imageUrl,
      source,
      shikiId,
      malId,
    }));
}
