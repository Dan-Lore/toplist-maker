import type { Contender } from "../domain";
import { shikiOriginalUrl, rewriteShikiUrl } from "../media/previews";
import { buildListDocument, type PortableDocument } from "./portable";

/** One row from Shikimori "Export list" / `*_animes.json` user-rates dump. */
export interface ShikiUserRateRow {
  target_title?: unknown;
  target_title_ru?: unknown;
  target_id?: unknown;
  target_type?: unknown;
  score?: unknown;
  status?: unknown;
  rewatches?: unknown;
  episodes?: unknown;
  text?: unknown;
}

export function isShikiUserRatesExport(raw: unknown): boolean {
  if (!Array.isArray(raw) || raw.length === 0) return false;
  const first = raw[0];
  if (!first || typeof first !== "object") return false;
  const row = first as Record<string, unknown>;
  return "target_id" in row && "target_title" in row;
}

/**
 * Convert a Shikimori user-rates JSON array into our portable list document.
 * Defaults to anime rows only (`target_type` missing or `Anime`).
 */
export function shikiUserRatesToPortable(
  rows: unknown[],
  options?: { name?: string; animeOnly?: boolean },
): PortableDocument {
  const animeOnly = options?.animeOnly !== false;
  const items: Contender[] = [];
  const statusCounts: Record<string, number> = {};

  for (let index = 0; index < rows.length; index++) {
    const entry = rows[index];
    if (!entry || typeof entry !== "object") {
      throw new Error(`Shikimori rates[${index}] is invalid`);
    }
    const row = entry as ShikiUserRateRow;
    const targetType = typeof row.target_type === "string" ? row.target_type : undefined;
    if (animeOnly && targetType && targetType.toLowerCase() !== "anime") {
      continue;
    }

    const id = row.target_id;
    if (typeof id !== "number" && typeof id !== "string") {
      throw new Error(`Shikimori rates[${index}] missing target_id`);
    }
    const title = typeof row.target_title === "string" ? row.target_title.trim() : "";
    if (!title) {
      throw new Error(`Shikimori rates[${index}] missing target_title`);
    }

    const titleRu =
      typeof row.target_title_ru === "string" && row.target_title_ru.trim()
        ? row.target_title_ru.trim()
        : undefined;
    const status = typeof row.status === "string" ? row.status : undefined;
    if (status) statusCounts[status] = (statusCounts[status] ?? 0) + 1;

    const shikiId = typeof id === "number" ? id : Number(id);
    const imageUrl = Number.isFinite(shikiId)
      ? rewriteShikiUrl(shikiOriginalUrl(shikiId))
      : undefined;

    items.push({
      id,
      title,
      titleRu,
      score: typeof row.score === "number" ? row.score : undefined,
      status,
      imageUrl,
      source: "shiki",
      shikiId: Number.isFinite(shikiId) ? shikiId : undefined,
    });
  }

  if (items.length < 1) {
    throw new Error("Shikimori export has no usable anime rows");
  }

  return buildListDocument(options?.name?.trim() || "Shikimori list", items, {
    source: "shikimori-user-rates",
    importedAt: new Date().toISOString(),
    rowCount: rows.length,
    itemCount: items.length,
    statuses: statusCounts,
  });
}
