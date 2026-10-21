import { describe, expect, it } from "vite-plus/test";
import { parseShikiProfileInput } from "./shikiProfile";

describe("parseShikiProfileInput", () => {
  it("accepts bare nickname", () => {
    expect(parseShikiProfileInput("Dan_Lore")).toBe("Dan_Lore");
    expect(parseShikiProfileInput("@Dan_Lore")).toBe("Dan_Lore");
  });

  it("parses profile URLs on .io and .one", () => {
    expect(parseShikiProfileInput("https://shikimori.io/Dan_Lore")).toBe("Dan_Lore");
    expect(parseShikiProfileInput("https://shikimori.one/Dan_Lore/list/anime")).toBe("Dan_Lore");
    expect(parseShikiProfileInput("https://shikimori.io/Dan_Lore?foo=1")).toBe("Dan_Lore");
  });

  it("rejects empty / reserved paths", () => {
    expect(() => parseShikiProfileInput("")).toThrow(/Paste/);
    expect(() => parseShikiProfileInput("https://shikimori.io/animes")).toThrow(/nickname/);
    expect(() => parseShikiProfileInput("https://example.com/x")).toThrow(/Invalid/);
  });
});
