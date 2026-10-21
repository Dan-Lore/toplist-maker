import { describe, expect, it } from "vite-plus/test";
import { createTournament, selectTopCompleted } from "./tournament";
import type { Contender } from "./types";

function c(id: number | string, title: string, score = 0, status = "completed"): Contender {
  return { id, title, score, status };
}

/** Always pick the first side of the pair (deterministic). */
function playAllPreferA(tournament: ReturnType<typeof createTournament>): void {
  while (!tournament.isComplete()) {
    const pair = tournament.nextPair();
    expect(pair).not.toBeNull();
    tournament.recordWinner(pair!.a.id);
  }
}

describe("createTournament", () => {
  it("completes immediately on empty input", () => {
    const t = createTournament([]);
    expect(t.isComplete()).toBe(true);
    expect(t.nextPair()).toBeNull();
    expect(t.getRanking()).toEqual([]);
    expect(t.getProgress().totalRounds).toBe(0);
  });

  it("completes immediately on a single contender", () => {
    const t = createTournament([c(1, "Solo", 10)]);
    expect(t.isComplete()).toBe(true);
    expect(t.nextPair()).toBeNull();
    const ranking = t.getRanking();
    expect(ranking).toHaveLength(1);
    expect(ranking[0]).toMatchObject({
      id: 1,
      title: "Solo",
      rank: 1,
      counter: 0,
      coef: 0,
    });
  });

  it("pairs two contenders and ranks the winner first", () => {
    const t = createTournament([c(1, "A", 5), c(2, "B", 8)], {
      seedBy: "score",
    });
    expect(t.isComplete()).toBe(false);
    const pair = t.nextPair();
    expect(pair).not.toBeNull();
    // Seeded by score desc → B (8) then A (5)
    expect(pair!.a.id).toBe(2);
    expect(pair!.b.id).toBe(1);

    t.recordWinner(1);
    expect(t.isComplete()).toBe(true);
    expect(t.nextPair()).toBeNull();

    const ranking = t.getRanking();
    expect(ranking.map((r) => r.id)).toEqual([1, 2]);
    expect(ranking[0]!.counter).toBe(1);
    expect(ranking[1]!.counter).toBe(0);
    expect(ranking[0]!.coef).toBe(0); // opponent has 0 wins
    expect(ranking[1]!.coef).toBe(1); // faced the winner
  });

  it("handles odd counts with a bye (+1 counter, no opponent)", () => {
    const t = createTournament([c(1, "A", 3), c(2, "B", 2), c(3, "C", 1)], {
      seedBy: "order",
      rounds: 1,
    });

    const first = t.nextPair();
    // With order seed: win=[1,2,3] → pair 1vs2, bye 3
    expect(first).toEqual({ a: c(1, "A", 3), b: c(2, "B", 2) });

    t.recordWinner(2);
    expect(t.isComplete()).toBe(true);

    const ranking = t.getRanking();
    const byId = Object.fromEntries(ranking.map((r) => [String(r.id), r]));
    expect(byId["3"]!.counter).toBe(1); // bye
    expect(byId["3"]!.opponents).toEqual([]);
    expect(byId["2"]!.counter).toBe(1);
    expect(byId["1"]!.counter).toBe(0);
    // Both bye-holder and match-winner have counter 1; coef breaks ties
    expect(ranking[0]!.counter).toBe(1);
    expect(ranking[1]!.counter).toBe(1);
  });

  it("produces known ranking order after scripted wins", () => {
    // 4 players, 2 rounds (ceil(log2(4))=2)
    const items = [c("a", "A", 4), c("b", "B", 3), c("c", "C", 2), c("d", "D", 1)];
    const t = createTournament(items, { seedBy: "order" });

    // Round 1 winners bracket: a vs b, c vs d
    expect(t.nextPair()).toEqual({
      a: items[0],
      b: items[1],
    });
    t.recordWinner("a"); // a beats b

    expect(t.nextPair()).toEqual({
      a: items[2],
      b: items[3],
    });
    t.recordWinner("c"); // c beats d

    // Round 2: win bracket sorted by counter: a,c (both 1) → a vs c
    // lose bracket: b,d (both 0) → b vs d
    const r2a = t.nextPair()!;
    expect([r2a.a.id, r2a.b.id].sort((x, y) => String(x).localeCompare(String(y)))).toEqual([
      "a",
      "c",
    ]);
    t.recordWinner("a"); // a beats c → a has 2

    const r2b = t.nextPair()!;
    expect([r2b.a.id, r2b.b.id].sort((x, y) => String(x).localeCompare(String(y)))).toEqual([
      "b",
      "d",
    ]);
    t.recordWinner("b"); // b beats d

    expect(t.isComplete()).toBe(true);

    const ranking = t.getRanking();
    expect(ranking.map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
    expect(ranking.map((r) => r.counter)).toEqual([2, 1, 1, 0]);
    // a beat b(1) and c(1) → coef 2
    expect(ranking[0]!.coef).toBe(2);
  });

  it("accepts N items and runs ceil(log2(N)) rounds by default", () => {
    const items = Array.from({ length: 8 }, (_, i) => c(i + 1, `P${i + 1}`, 10 - i));
    const t = createTournament(items, { seedBy: "order" });
    expect(t.getProgress().totalRounds).toBe(3); // log2(8)
    playAllPreferA(t);
    expect(t.isComplete()).toBe(true);
    expect(t.getRanking()).toHaveLength(8);
    // Preferring side A each time with order seed → id 1 should be on top
    expect(t.getRanking()[0]!.id).toBe(1);
    expect(t.getRanking()[0]!.counter).toBe(3);
  });

  it("throws when recording a winner not in the current pair", () => {
    const t = createTournament([c(1, "A"), c(2, "B"), c(3, "C")], {
      seedBy: "order",
      rounds: 1,
    });
    // First pair is 1 vs 2; 3 has a bye and is not in the pair
    expect(() => t.recordWinner(3)).toThrow(/not in the current pair/);
  });
});

describe("selectTopCompleted", () => {
  it("filters completed and keeps top N by score", () => {
    const pool = [
      c(1, "Low", 5, "completed"),
      c(2, "Watching", 10, "watching"),
      c(3, "High", 9, "completed"),
      c(4, "Mid", 7, "completed"),
      c(5, "Dropped", 10, "dropped"),
    ];
    const top = selectTopCompleted(pool, 2);
    expect(top.map((x) => x.id)).toEqual([3, 4]);
  });
});
