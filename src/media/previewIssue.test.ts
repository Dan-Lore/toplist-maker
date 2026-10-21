import { describe, expect, it } from "vite-plus/test";
import { diagnoseMissingPoster } from "./previewIssue";
import type { Contender } from "../domain";

describe("diagnoseMissingPoster", () => {
  it("reports missing ids", () => {
    const item: Contender = { id: "x", title: "Custom" };
    const issue = diagnoseMissingPoster({
      item,
      provider: "auto",
      candidates: [],
      failedUrls: [],
    });
    expect(issue.code).toBe("no_ids");
    expect(issue.detail).toContain("code=no_ids");
  });

  it("reports mal provider without malId", () => {
    const item: Contender = { id: 20, title: "Naruto", source: "shiki" };
    const issue = diagnoseMissingPoster({
      item,
      provider: "mal",
      candidates: [],
      failedUrls: [],
    });
    expect(issue.code).toBe("provider_needs_mal_id");
  });

  it("reports exhausted CDN urls with host in detail", () => {
    const item: Contender = {
      id: 20,
      title: "Naruto",
      source: "shiki",
      imageUrl: "https://shikimori.one/system/animes/preview/20.jpg",
    };
    const urls = [
      "https://shikimori.one/system/animes/preview/20.jpg",
      "https://shikimori.one/system/animes/original/20.jpg",
    ];
    const issue = diagnoseMissingPoster({
      item,
      provider: "shiki",
      candidates: urls,
      failedUrls: urls,
    });
    expect(issue.code).toBe("cdn_all_failed");
    expect(issue.message).toContain("shikimori.one");
    expect(issue.detail).toContain("tried=2");
    expect(issue.detail).toContain("hosts=shikimori.one");
  });
});
