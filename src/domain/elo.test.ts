import { describe, expect, it } from "vite-plus/test";
import { createEloTracker, eloUpdate, expectedScore } from "./elo";
import type { Contender } from "./types";

const c = (id: number, title: string): Contender => ({ id, title });

describe("eloUpdate", () => {
  it("raises winner and lowers loser", () => {
    const result = eloUpdate(1500, 1500, 24);
    expect(result.winnerRating).toBeGreaterThan(1500);
    expect(result.loserRating).toBeLessThan(1500);
    expect(result.winnerDelta).toBeCloseTo(-result.loserDelta, 8);
  });

  it("expectedScore is 0.5 for equal ratings", () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5);
  });
});

describe("createEloTracker", () => {
  it("ranks consistent winners higher", () => {
    const tracker = createEloTracker([c(1, "A"), c(2, "B"), c(3, "C")]);
    tracker.recordDuel(1, 2);
    tracker.recordDuel(1, 3);
    tracker.recordDuel(2, 3);
    const ranking = tracker.getRanking();
    expect(ranking[0]?.id).toBe(1);
    expect(ranking[2]?.id).toBe(3);
  });
});
