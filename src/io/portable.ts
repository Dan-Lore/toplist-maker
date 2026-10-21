import type { Contender, RankedContender } from "../domain";

export const PORTABLE_FORMAT = "toplist-maker" as const;
export const PORTABLE_VERSION = 1 as const;

export type PortableKind = "list" | "ranking";

/** Portable JSON for export / import (file or clipboard later). */
export interface PortableDocument {
  format: typeof PORTABLE_FORMAT;
  version: typeof PORTABLE_VERSION;
  kind: PortableKind;
  exportedAt: string;
  name: string;
  meta?: Record<string, unknown>;
  /** Contenders for a tournament (required for kind=list). */
  items?: Contender[];
  /** Finished ranking (required for kind=ranking). */
  ranking?: RankedContender[];
}

export function buildListDocument(
  name: string,
  items: Contender[],
  meta?: Record<string, unknown>,
): PortableDocument {
  return {
    format: PORTABLE_FORMAT,
    version: PORTABLE_VERSION,
    kind: "list",
    exportedAt: new Date().toISOString(),
    name,
    meta,
    items: structuredClonePlain(items),
  };
}

export function buildRankingDocument(
  name: string,
  ranking: RankedContender[],
  items?: Contender[],
  meta?: Record<string, unknown>,
): PortableDocument {
  return {
    format: PORTABLE_FORMAT,
    version: PORTABLE_VERSION,
    kind: "ranking",
    exportedAt: new Date().toISOString(),
    name,
    meta,
    ranking: structuredClonePlain(ranking),
    items: items ? structuredClonePlain(items) : rankingToItems(ranking),
  };
}

export function parsePortable(raw: unknown): PortableDocument {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid file: expected a JSON object");
  }
  const doc = raw as Record<string, unknown>;

  // Accept legacy sample seed shape { meta, items }
  if (!("format" in doc) && Array.isArray(doc.items)) {
    return buildListDocument("Imported list", normalizeItems(doc.items), asMeta(doc.meta));
  }

  if (doc.format !== PORTABLE_FORMAT) {
    throw new Error(`Unknown format (expected ${PORTABLE_FORMAT})`);
  }
  if (doc.version !== PORTABLE_VERSION) {
    throw new Error(`Unsupported version: ${String(doc.version)}`);
  }
  if (doc.kind !== "list" && doc.kind !== "ranking") {
    throw new Error(`Unknown kind: ${String(doc.kind)}`);
  }
  if (typeof doc.name !== "string" || !doc.name.trim()) {
    throw new Error("Missing name");
  }

  if (doc.kind === "list") {
    const items = normalizeItems(doc.items);
    if (items.length < 1) throw new Error("List has no items");
    return {
      format: PORTABLE_FORMAT,
      version: PORTABLE_VERSION,
      kind: "list",
      exportedAt: typeof doc.exportedAt === "string" ? doc.exportedAt : new Date().toISOString(),
      name: doc.name.trim(),
      meta: asMeta(doc.meta),
      items,
    };
  }

  const ranking = normalizeRanking(doc.ranking);
  if (ranking.length < 1) throw new Error("Ranking has no entries");
  const items = doc.items ? normalizeItems(doc.items) : rankingToItems(ranking);
  return {
    format: PORTABLE_FORMAT,
    version: PORTABLE_VERSION,
    kind: "ranking",
    exportedAt: typeof doc.exportedAt === "string" ? doc.exportedAt : new Date().toISOString(),
    name: doc.name.trim(),
    meta: asMeta(doc.meta),
    ranking,
    items,
  };
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function slugifyFilename(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return slug || "toplist";
}

function rankingToItems(ranking: RankedContender[]): Contender[] {
  return ranking.map(({ id, title, titleRu, score, status, imageUrl, source, shikiId, malId }) => ({
    id,
    title,
    titleRu,
    score,
    status,
    imageUrl,
    source,
    shikiId,
    malId,
  }));
}

function normalizeItems(raw: unknown): Contender[] {
  if (!Array.isArray(raw)) throw new Error("items must be an array");
  return raw.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`items[${index}] is invalid`);
    }
    const item = entry as Record<string, unknown>;
    if (item.id === undefined || item.id === null) {
      throw new Error(`items[${index}] missing id`);
    }
    if (typeof item.title !== "string" || !item.title.trim()) {
      throw new Error(`items[${index}] missing title`);
    }
    const source =
      item.source === "shiki" || item.source === "mal" || item.source === "unknown"
        ? item.source
        : undefined;
    return {
      id: item.id as Contender["id"],
      title: item.title.trim(),
      titleRu: typeof item.titleRu === "string" ? item.titleRu : undefined,
      score: typeof item.score === "number" ? item.score : undefined,
      status: typeof item.status === "string" ? item.status : undefined,
      imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : undefined,
      source,
      shikiId: typeof item.shikiId === "number" ? item.shikiId : undefined,
      malId: typeof item.malId === "number" ? item.malId : undefined,
    };
  });
}

function normalizeRanking(raw: unknown): RankedContender[] {
  if (!Array.isArray(raw)) throw new Error("ranking must be an array");
  return raw.map((entry, index) => {
    const base = normalizeItems([entry])[0]!;
    const row = entry as Record<string, unknown>;
    return {
      ...base,
      rank: typeof row.rank === "number" ? row.rank : index + 1,
      counter: typeof row.counter === "number" ? row.counter : 0,
      coef: typeof row.coef === "number" ? row.coef : 0,
      opponents: Array.isArray(row.opponents) ? (row.opponents as Contender["id"][]) : [],
    };
  });
}

function asMeta(raw: unknown): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  return raw as Record<string, unknown>;
}

function structuredClonePlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
