export type { Contender, ContenderId, Pair, RankedContender, EloRankedContender } from "./types";
export { idsEqual } from "./types";

export {
  createTournament,
  selectTopCompleted,
  type Tournament,
  type TournamentOptions,
  type TournamentProgress,
} from "./tournament";

export {
  DEFAULT_ELO_K,
  DEFAULT_ELO_RATING,
  expectedScore,
  eloUpdate,
  createEloTracker,
  rankByEloDuels,
  findContender,
  type EloUpdateResult,
  type EloTracker,
  type EloTrackerOptions,
} from "./elo";
