import { describe, expect, it } from "vite-plus/test";
import { shikiOriginalUrl, shikiPreviewUrl, staticPreviewCandidates } from "./previews";
import type { Contender } from "../domain";

describe("preview helpers", () => {
  it("builds shiki CDN urls", () => {
    expect(shikiPreviewUrl(20)).toContain("/system/animes/preview/20.jpg");
    expect(shikiOriginalUrl(20)).toContain("/system/animes/original/20.jpg");
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

  it("uses malId only as id when source=mal", () => {
    const item: Contender = { id: 1, title: "Cowboy Bebop", source: "mal" };
    const urls = staticPreviewCandidates(item, "mal");
    expect(urls.some((u) => u.includes("shikimori"))).toBe(false);
  });
});
