import { describe, expect, it } from "vite-plus/test";
import {
  PORTABLE_FORMAT,
  buildListDocument,
  buildRankingDocument,
  parsePortable,
} from "./portable";

describe("portable io", () => {
  it("round-trips a list document", () => {
    const doc = buildListDocument("Mine", [
      { id: 1, title: "A", score: 9, status: "completed" },
      { id: 2, title: "B", score: 8, status: "completed" },
    ]);
    const parsed = parsePortable(JSON.parse(JSON.stringify(doc)));
    expect(parsed.kind).toBe("list");
    expect(parsed.format).toBe(PORTABLE_FORMAT);
    expect(parsed.items?.map((i) => i.id)).toEqual([1, 2]);
  });

  it("round-trips a ranking and derives items", () => {
    const doc = buildRankingDocument("Done", [
      {
        id: "a",
        title: "A",
        rank: 1,
        counter: 2,
        coef: 1,
        opponents: ["b"],
      },
      {
        id: "b",
        title: "B",
        rank: 2,
        counter: 0,
        coef: 2,
        opponents: ["a"],
      },
    ]);
    const parsed = parsePortable(JSON.parse(JSON.stringify(doc)));
    expect(parsed.kind).toBe("ranking");
    expect(parsed.ranking?.[0]?.id).toBe("a");
    expect(parsed.items?.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("accepts legacy { meta, items } seed files", () => {
    const parsed = parsePortable({
      meta: { source: "legacy" },
      items: [{ id: 7, title: "X", status: "completed" }],
    });
    expect(parsed.kind).toBe("list");
    expect(parsed.items?.[0]?.id).toBe(7);
    expect(parsed.meta?.source).toBe("legacy");
  });

  it("rejects unknown format", () => {
    expect(() => parsePortable({ format: "nope", version: 1, kind: "list" })).toThrow(
      /Unknown format/,
    );
  });
});
