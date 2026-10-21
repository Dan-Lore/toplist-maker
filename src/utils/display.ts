import type { Contender } from "../domain";

/** Prefer Russian title when present, else original. */
export function displayTitle(item: Pick<Contender, "title" | "titleRu">): string {
  const ru = item.titleRu?.trim();
  if (ru) return ru;
  return item.title;
}
