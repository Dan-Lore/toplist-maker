import { describe, expect, it } from "vite-plus/test";
import {
  rewriteShikiUrl,
  SHIKI_ORIGIN,
  shikiOriginalUrl,
  shikiPreviewUrl,
  staticPreviewCandidates,
} from "./previews";
import type { Contender } from "../domain";

describe("preview helpers", () => {
  it("builds shiki CDN urls on .io", () => {
    expect(SHIKI_ORIGIN).toBe("https://shikimori.io");
    expect(shikiPreviewUrl(20)).toBe("https://shikimori.io/system/animes/preview/20.jpg");
    expect(shikiOriginalUrl(20)).toContain("/system/animes/original/20.jpg");
  });

  it("rewrites legacy .one hosts to .io", () => {
    expect(rewriteShikiUrl("https://shikimori.one/system/animes/original/20.jpg")).toBe(
      "https://shikimori.io/system/animes/original/20.jpg",
    );
  });

  it("lists static candidates with existing image first", () => {
    const item: Contender = {
      id: 20,
      title: "Naruto",
      source: "shiki",
      imageUrl: "https://example.com/x.jpg",
    };
    const urls = staticPreviewCandidates(item, "shiki");
    expect(urls[0]).toBe("https://example.com/x.jpg");
    expect(urls).toContain(shikiPreviewUrl(20));
    expect(urls).toContain(shikiOriginalUrl(20));
  });

  it("migrates .one imageUrl into candidates", () => {
    const item: Contender = {
      id: 20,
      title: "Naruto",
      source: "shiki",
      imageUrl: "https://shikimori.one/system/animes/original/20.jpg",
    };
    const urls = staticPreviewCandidates(item, "shiki");
    expect(urls[0]).toBe("https://shikimori.io/system/animes/original/20.jpg");
    expect(urls.every((u) => !u.includes("shikimori.one"))).toBe(true);
  });

  it("uses malId only as id when source=mal", () => {
    const item: Contender = { id: 1, title: "Cowboy Bebop", source: "mal" };
    const urls = staticPreviewCandidates(item, "mal");
    expect(urls.some((u) => u.includes("shikimori"))).toBe(false);
  });
});
