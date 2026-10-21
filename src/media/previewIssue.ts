import type { Contender } from "../domain";
import { resolveMalId, resolveShikiId, type PreviewProvider } from "./previews";

/** Machine-readable reason — stable for debugging / logs. */
export type PreviewIssueCode =
  | "no_ids"
  | "provider_needs_mal_id"
  | "provider_needs_shiki_id"
  | "no_candidates"
  | "cdn_all_failed";

export interface PreviewIssue {
  code: PreviewIssueCode;
  /** Plain language for anyone. */
  message: string;
  /** Compact debug line for developers. */
  detail: string;
}

export function diagnoseMissingPoster(input: {
  item?: Contender;
  provider: PreviewProvider;
  candidates: string[];
  failedUrls: string[];
}): PreviewIssue {
  const { item, provider, candidates, failedUrls } = input;
  const shikiId = item ? resolveShikiId(item) : undefined;
  const malId = item ? resolveMalId(item) : undefined;
  const hasImageUrl = Boolean(item?.imageUrl || input.candidates[0]);
  const idBits = [
    `provider=${provider}`,
    item ? `id=${String(item.id)}` : "id=?",
    `source=${item?.source ?? "—"}`,
    `shikiId=${shikiId ?? "—"}`,
    `malId=${malId ?? "—"}`,
    `imageUrl=${item?.imageUrl ? "yes" : "no"}`,
  ].join(" ");

  if (failedUrls.length > 0 && failedUrls.length >= candidates.length && candidates.length > 0) {
    const hosts = uniqueHosts(failedUrls);
    return {
      code: "cdn_all_failed",
      message:
        hosts.length === 1
          ? `Poster didn't load — ${hosts[0]} didn't return an image.`
          : "Poster didn't load — every image link failed (host down, blocked, or missing file).",
      detail: `code=cdn_all_failed tried=${failedUrls.length} hosts=${hosts.join(",") || "—"} ${idBits}`,
    };
  }

  if (provider === "mal" && malId == null) {
    return {
      code: "provider_needs_mal_id",
      message: "No poster — MAL mode needs a MyAnimeList id (or fetch via Auto/Shiki first).",
      detail: `code=provider_needs_mal_id ${idBits}`,
    };
  }

  if (provider === "shiki" && shikiId == null) {
    return {
      code: "provider_needs_shiki_id",
      message: "No poster — Shikimori mode needs a Shikimori id.",
      detail: `code=provider_needs_shiki_id ${idBits}`,
    };
  }

  if (!hasImageUrl && shikiId == null && malId == null) {
    return {
      code: "no_ids",
      message: "No poster — this item has no image link and no Shiki/MAL id to look up.",
      detail: `code=no_ids ${idBits}`,
    };
  }

  if (candidates.length === 0) {
    return {
      code: "no_candidates",
      message: "No poster URL available for the selected provider.",
      detail: `code=no_candidates ${idBits}`,
    };
  }

  return {
    code: "cdn_all_failed",
    message: "Poster didn't load — the image could not be shown.",
    detail: `code=cdn_all_failed tried=${failedUrls.length} ${idBits}`,
  };
}

export function formatPreviewIssueTooltip(issue: PreviewIssue): string {
  return `${issue.message}\n${issue.detail}`;
}

function uniqueHosts(urls: string[]): string[] {
  const set = new Set<string>();
  for (const url of urls) {
    try {
      set.add(new URL(url).hostname);
    } catch {
      /* ignore bad urls */
    }
  }
  return [...set];
}
