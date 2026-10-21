import { describe, expect, it } from "vite-plus/test";
import { parsePortable } from "./portable";
import { isShikiUserRatesExport, shikiUserRatesToPortable } from "./shikiUserRates";

const sampleRows = [
  {
    target_title: "Tokyo Ravens",
    target_title_ru: "Токийские вороны",
    target_id: 16011,
    target_type: "Anime",
    score: 7,
    status: "completed",
    rewatches: 0,
    episodes: 24,
    text: null,
  },
  {
    target_title: "Some Manga",
    target_title_ru: "",
    target_id: 99,
    target_type: "Manga",
    score: 8,
    status: "planned",
    rewatches: 0,
    episodes: 0,
    text: null,
  },
];

describe("shiki user-rates import", () => {
  it("detects the export shape", () => {
    expect(isShikiUserRatesExport(sampleRows)).toBe(true);
    expect(isShikiUserRatesExport([{ id: 1, title: "x" }])).toBe(false);
  });

  it("maps anime rows and skips manga by default", () => {
    const doc = shikiUserRatesToPortable(sampleRows);
    expect(doc.kind).toBe("list");
    expect(doc.items).toHaveLength(1);
    const item = doc.items![0]!;
    expect(item.id).toBe(16011);
    expect(item.title).toBe("Tokyo Ravens");
    expect(item.titleRu).toBe("Токийские вороны");
    expect(item.source).toBe("shiki");
    expect(item.shikiId).toBe(16011);
    expect(item.imageUrl).toContain("shikimori.io");
    expect(item.imageUrl).toContain("/16011.jpg");
    expect(doc.meta?.source).toBe("shikimori-user-rates");
  });

  it("parsePortable accepts a bare rates array", () => {
    const doc = parsePortable(sampleRows);
    expect(doc.items?.[0]?.id).toBe(16011);
  });
});
