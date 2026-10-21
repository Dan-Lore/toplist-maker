import type { Contender } from "../domain";
import { SHIKI_ORIGIN, rewriteShikiUrl } from "../media/previews";
import { buildListDocument, type PortableDocument } from "./portable";

const USER_AGENT = "toplist-maker/0.1 (+https://github.com/Dan-Lore/toplist-maker)";
const PAGE_LIMIT = 1000;

export type ShikiListStatus =
  | "completed"
  | "watching"
  | "planned"
  | "on_hold"
  | "dropped"
  | "rewatching"
  | "all";

export interface ShikiProfileFetchOptions {
  status?: ShikiListStatus;
  onProgress?: (info: { phase: string; loaded: number; page: number }) => void;
}

/** Extract nickname from a Shikimori profile URL or raw nickname. */
export function parseShikiProfileInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Paste a Shikimori profile URL or nickname");

  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "");
    if (
      host === "shikimori.io" ||
      host === "shikimori.one" ||
      host.endsWith(".shikimori.io") ||
      host.endsWith(".shikimori.one")
    ) {
      const parts = url.pathname.split("/").filter(Boolean);
      const nick = parts[0];
      if (!nick || reservedPath(nick)) {
        throw new Error("Could not find a nickname in that Shikimori URL");
      }
      return decodeURIComponent(nick);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Could not")) throw err;
    // not a URL — treat as nickname
  }

  const nick = trimmed.replace(/^@/, "").split(/[/?#\s]/)[0] ?? "";
  if (!nick || !/^[\w.-]+$/u.test(nick)) {
    throw new Error("Invalid Shikimori nickname");
  }
  return nick;
}

function reservedPath(segment: string): boolean {
  return [
    "api",
    "animes",
    "mangas",
    "characters",
    "people",
    "clubs",
    "forum",
    "contests",
    "collections",
    "ongoings",
    "about",
    "oauth",
  ].includes(segment.toLowerCase());
}

interface ShikiUser {
  id: number;
  nickname: string;
}

interface ShikiAnimeRate {
  id?: number;
  score?: number;
  status?: string;
  episodes?: number;
  rewatches?: number;
  anime?: {
    id?: number;
    name?: string;
    russian?: string;
    image?: { original?: string; preview?: string };
  };
}

async function shikiGet<T>(path: string): Promise<T> {
  // Browsers ignore custom User-Agent; still send Accept. UA constant kept for non-browser callers.
  void USER_AGENT;
  const res = await fetch(`${SHIKI_ORIGIN}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error(`Shikimori user or list not found (${path})`);
    if (res.status === 429) throw new Error("Shikimori rate limit — wait a few seconds and retry");
    throw new Error(`Shikimori API ${res.status}`);
  }
  return (await res.json()) as T;
}

function absoluteShikiImage(path?: string): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return rewriteShikiUrl(path);
  }
  return rewriteShikiUrl(`${SHIKI_ORIGIN}${path.startsWith("/") ? "" : "/"}${path}`);
}

function rateToContender(rate: ShikiAnimeRate): Contender | null {
  const anime = rate.anime;
  if (!anime) return null;
  const idNum = typeof anime.id === "number" ? anime.id : Number(anime.id);
  if (!Number.isFinite(idNum)) return null;
  const title = typeof anime.name === "string" ? anime.name.trim() : "";
  if (!title) return null;
  const titleRu =
    typeof anime.russian === "string" && anime.russian.trim() ? anime.russian.trim() : undefined;
  const imageUrl =
    absoluteShikiImage(anime.image?.original) || absoluteShikiImage(anime.image?.preview);

  return {
    id: idNum,
    title,
    titleRu,
    score: typeof rate.score === "number" ? rate.score : undefined,
    status: typeof rate.status === "string" ? rate.status : undefined,
    imageUrl,
    source: "shiki",
    shikiId: idNum,
  };
}

/**
 * Fetch a user's anime list from Shikimori by profile URL or nickname.
 * Uses public REST `/api/users/:nick/anime_rates` (CORS-friendly).
 */
export async function fetchShikiProfileList(
  input: string,
  options?: ShikiProfileFetchOptions,
): Promise<PortableDocument> {
  const nickname = parseShikiProfileInput(input);
  const status = options?.status ?? "completed";

  options?.onProgress?.({ phase: `Looking up ${nickname}…`, loaded: 0, page: 0 });

  let user: ShikiUser;
  try {
    user = await shikiGet<ShikiUser>(`/api/users/${encodeURIComponent(nickname)}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Failed to fetch|NetworkError|CORS/i.test(msg)) {
      throw new Error(
        "Cannot reach Shikimori from this browser (network/CORS). Try again or Import JSON export.",
      );
    }
    throw err;
  }
  if (!user?.id || !user.nickname) {
    throw new Error(`Shikimori user “${nickname}” not found`);
  }

  const rates: ShikiAnimeRate[] = [];
  let page = 1;
  while (true) {
    options?.onProgress?.({
      phase: `Fetching ${status} list (page ${page})…`,
      loaded: rates.length,
      page,
    });

    const params = new URLSearchParams({
      limit: String(PAGE_LIMIT),
      page: String(page),
    });
    if (status !== "all") params.set("status", status);

    const batch = await shikiGet<unknown>(
      `/api/users/${encodeURIComponent(user.nickname)}/anime_rates?${params}`,
    );
    if (!Array.isArray(batch) || batch.length === 0) break;

    rates.push(...(batch as ShikiAnimeRate[]));
    options?.onProgress?.({
      phase: `Fetched ${rates.length} rates…`,
      loaded: rates.length,
      page,
    });

    if (batch.length <= PAGE_LIMIT) break;
    page += 1;
    await sleep(350);
  }

  const items: Contender[] = [];
  const seen = new Set<string>();
  const statusCounts: Record<string, number> = {};

  for (const rate of rates) {
    const item = rateToContender(rate);
    if (!item) continue;
    const key = String(item.id);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
    if (item.status) statusCounts[item.status] = (statusCounts[item.status] ?? 0) + 1;
  }

  if (items.length < 1) {
    throw new Error(
      status === "all"
        ? `No anime found in ${user.nickname}'s list`
        : `No “${status}” anime in ${user.nickname}'s list`,
    );
  }

  return buildListDocument(`${user.nickname} · ${status}`, items, {
    source: "shikimori-profile",
    profileUrl: `${SHIKI_ORIGIN}/${user.nickname}`,
    nickname: user.nickname,
    userId: user.id,
    statusFilter: status,
    importedAt: new Date().toISOString(),
    itemCount: items.length,
    statuses: statusCounts,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
