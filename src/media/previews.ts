import type { Contender, ContenderId } from "../domain";

export type PreviewProvider = "auto" | "shiki" | "mal";

/** Current Shikimori host (.one is blocked/unavailable in many networks). */
export const SHIKI_ORIGIN = "https://shikimori.io";
const SHIKI_LEGACY_HOSTS = ["shikimori.one", "nyaa.shikimori.one", "nyaa.shikimori.io"];
const JIKAN_ORIGIN = "https://api.jikan.moe/v4";
const USER_AGENT = "toplist-maker/0.1 (+https://github.com/Dan-Lore/toplist-maker)";

/** Rewrite legacy Shiki hosts (.one / nyaa) to the current origin. */
export function rewriteShikiUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (SHIKI_LEGACY_HOSTS.includes(parsed.hostname) || parsed.hostname === "shikimori.io") {
      parsed.protocol = "https:";
      parsed.hostname = "shikimori.io";
      return parsed.toString();
    }
  } catch {
    return url;
  }
  return url;
}

/** In-memory cache so duel remounts don't re-hit APIs. */
const resolvedCache = new Map<string, string>();

export function cacheKey(item: Contender, provider: PreviewProvider): string {
  return `${provider}:${item.source ?? "shiki"}:${String(item.id)}:${item.malId ?? ""}`;
}

export function shikiPreviewUrl(id: ContenderId): string {
  return `${SHIKI_ORIGIN}/system/animes/preview/${id}.jpg`;
}

export function shikiOriginalUrl(id: ContenderId): string {
  return `${SHIKI_ORIGIN}/system/animes/original/${id}.jpg`;
}

export function resolveShikiId(item: Contender): number | undefined {
  if (typeof item.shikiId === "number") return item.shikiId;
  if (item.source === "mal") return undefined;
  const n = Number(item.id);
  return Number.isFinite(n) ? n : undefined;
}

export function resolveMalId(item: Contender): number | undefined {
  if (typeof item.malId === "number") return item.malId;
  if (item.source === "mal") {
    const n = Number(item.id);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/** Sync candidates for <img> fallback chain (no network). */
export function staticPreviewCandidates(
  item: Contender,
  provider: PreviewProvider = "auto",
): string[] {
  const urls: string[] = [];
  const push = (url?: string): void => {
    const next = rewriteShikiUrl(url) ?? url;
    if (!next) return;
    if (!urls.includes(next)) urls.push(next);
  };

  push(item.imageUrl);
  // Prefer migrated host even when raw imageUrl still points at .one
  push(rewriteShikiUrl(item.imageUrl));

  const shikiId = resolveShikiId(item);
  const malId = resolveMalId(item);
  const useShiki = provider === "auto" || provider === "shiki";
  const useMalHint = provider === "auto" || provider === "mal";

  if (useShiki && shikiId != null) {
    push(shikiPreviewUrl(shikiId));
    push(shikiOriginalUrl(shikiId));
  }

  // MAL has no stable public CDN path by id without API — only use known imageUrl/cache.
  if (useMalHint) {
    const cached = resolvedCache.get(cacheKey({ ...item, malId }, "mal"));
    push(cached);
  }

  const cachedAuto = resolvedCache.get(cacheKey(item, provider));
  push(cachedAuto);

  return urls;
}

interface ShikiGraphqlAnime {
  id: number;
  malId?: number | null;
  poster?: {
    previewUrl?: string | null;
    mainUrl?: string | null;
    originalUrl?: string | null;
  } | null;
}

export async function fetchShikiPoster(
  shikiId: number,
): Promise<{ imageUrl?: string; malId?: number }> {
  const query = `query { animes(ids: "${shikiId}", limit: 1) { id malId poster { previewUrl mainUrl originalUrl } } }`;
  const res = await fetch(`${SHIKI_ORIGIN}/api/graphql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Shikimori GraphQL ${res.status}`);
  const json = (await res.json()) as {
    data?: { animes?: ShikiGraphqlAnime[] };
    errors?: unknown;
  };
  const anime = json.data?.animes?.[0];
  if (!anime) {
    // REST fallback (older image paths)
    return fetchShikiPosterRest(shikiId);
  }
  const imageUrl =
    anime.poster?.previewUrl || anime.poster?.mainUrl || anime.poster?.originalUrl || undefined;
  return {
    imageUrl: absoluteShikiUrl(imageUrl) ?? shikiPreviewUrl(shikiId),
    malId: typeof anime.malId === "number" ? anime.malId : undefined,
  };
}

async function fetchShikiPosterRest(
  shikiId: number,
): Promise<{ imageUrl?: string; malId?: number }> {
  const res = await fetch(`${SHIKI_ORIGIN}/api/animes/${shikiId}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`Shikimori REST ${res.status}`);
  const data = (await res.json()) as {
    image?: { preview?: string; original?: string };
    myanimelist_id?: number;
  };
  const path = data.image?.preview || data.image?.original;
  return {
    imageUrl: absoluteShikiUrl(path) ?? shikiPreviewUrl(shikiId),
    malId: data.myanimelist_id,
  };
}

export async function fetchMalPoster(malId: number): Promise<string | undefined> {
  const res = await fetch(`${JIKAN_ORIGIN}/anime/${malId}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`Jikan ${res.status}`);
  const json = (await res.json()) as {
    data?: {
      images?: {
        jpg?: { image_url?: string; large_image_url?: string };
        webp?: { image_url?: string; large_image_url?: string };
      };
    };
  };
  return (
    json.data?.images?.webp?.large_image_url ||
    json.data?.images?.jpg?.large_image_url ||
    json.data?.images?.webp?.image_url ||
    json.data?.images?.jpg?.image_url
  );
}

/**
 * Resolve a best-effort preview URL for one contender.
 * Prefer existing imageUrl; otherwise Shiki and/or MAL (Jikan).
 */
export async function resolvePreviewUrl(
  item: Contender,
  provider: PreviewProvider = "auto",
): Promise<{ imageUrl?: string; malId?: number; shikiId?: number }> {
  const key = cacheKey(item, provider);
  const cached = resolvedCache.get(key);
  if (cached) {
    return { imageUrl: cached, malId: resolveMalId(item), shikiId: resolveShikiId(item) };
  }

  let malId = resolveMalId(item);
  let shikiId = resolveShikiId(item);
  let imageUrl = rewriteShikiUrl(item.imageUrl) ?? item.imageUrl;
  let shikiFallback: string | undefined;

  const tryShiki = provider === "auto" || provider === "shiki";
  const tryMal = provider === "auto" || provider === "mal";

  // Shiki: posters + optional malId discovery (also when provider=mal but malId unknown)
  if (shikiId != null && (tryShiki || (tryMal && malId == null))) {
    try {
      const shiki = await fetchShikiPoster(shikiId);
      shikiFallback = shiki.imageUrl || shikiPreviewUrl(shikiId);
      if (tryShiki) imageUrl = imageUrl || shikiFallback;
      if (shiki.malId != null) malId = shiki.malId;
    } catch {
      shikiFallback = shikiPreviewUrl(shikiId);
      if (tryShiki) imageUrl = imageUrl || shikiFallback;
    }
  }

  if (tryMal && malId != null) {
    try {
      const malUrl = await fetchMalPoster(malId);
      if (malUrl && (provider === "mal" || !imageUrl)) {
        imageUrl = malUrl;
      }
    } catch {
      // keep Shiki / existing
    }
  }

  if (!imageUrl && shikiFallback) imageUrl = shikiFallback;

  if (imageUrl) resolvedCache.set(key, imageUrl);
  return { imageUrl, malId, shikiId };
}

export async function enrichContendersWithPreviews(
  items: Contender[],
  provider: PreviewProvider = "auto",
  options?: { concurrency?: number; onProgress?: (done: number, total: number) => void },
): Promise<Contender[]> {
  const concurrency = Math.max(1, options?.concurrency ?? 2);
  const total = items.length;
  let done = 0;
  const out = items.map((item) => ({ ...item }));

  let index = 0;
  async function worker(): Promise<void> {
    while (index < out.length) {
      const i = index++;
      const item = out[i]!;
      try {
        const resolved = await resolvePreviewUrl(item, provider);
        if (resolved.imageUrl) item.imageUrl = resolved.imageUrl;
        if (resolved.malId != null) item.malId = resolved.malId;
        if (resolved.shikiId != null) item.shikiId = resolved.shikiId;
        if (!item.source) {
          item.source = provider === "mal" ? "mal" : "shiki";
        }
      } catch {
        /* keep item as-is */
      }
      done += 1;
      options?.onProgress?.(done, total);
      // Mild pacing for free-tier APIs
      await sleep(provider === "mal" ? 350 : 120);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, () => worker()));
  return out;
}

function absoluteShikiUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return rewriteShikiUrl(path) ?? path;
  }
  return `${SHIKI_ORIGIN}${path.startsWith("/") ? "" : "/"}${path}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
