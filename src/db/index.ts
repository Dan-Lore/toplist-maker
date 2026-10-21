import Dexie, { type EntityTable } from "dexie";
import type { Contender, RankedContender } from "../domain";

/** A contender list persisted locally (private MVP). */
export interface SavedListRecord {
  id?: number;
  name: string;
  createdAt: number;
  items: Contender[];
  meta?: Record<string, unknown>;
}

/** Tournament ranking snapshot persisted after a run. */
export interface SavedResultRecord {
  id?: number;
  name: string;
  createdAt: number;
  ranking: RankedContender[];
  /** Contenders used for the run (so a ranking can be replayed). */
  items?: Contender[];
  sourceListId?: number;
}

class ToplistDatabase extends Dexie {
  lists!: EntityTable<SavedListRecord, "id">;
  results!: EntityTable<SavedResultRecord, "id">;

  constructor() {
    super("toplist-maker");
    this.version(1).stores({
      lists: "++id, name, createdAt",
      results: "++id, name, createdAt, sourceListId",
    });
  }
}

export const db = new ToplistDatabase();

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function saveList(
  name: string,
  items: Contender[],
  meta?: Record<string, unknown>,
): Promise<number> {
  const id = await db.lists.add({
    name,
    createdAt: Date.now(),
    items: cloneJson(items),
    meta: meta ? cloneJson(meta) : undefined,
  });
  if (id === undefined) throw new Error("Failed to save list");
  return id;
}

export async function saveResult(
  name: string,
  ranking: RankedContender[],
  options?: { sourceListId?: number; items?: Contender[] },
): Promise<number> {
  const id = await db.results.add({
    name,
    createdAt: Date.now(),
    ranking: cloneJson(ranking),
    items: options?.items ? cloneJson(options.items) : undefined,
    sourceListId: options?.sourceListId,
  });
  if (id === undefined) throw new Error("Failed to save result");
  return id;
}

export async function listSavedLists(): Promise<SavedListRecord[]> {
  return db.lists.orderBy("createdAt").reverse().toArray();
}

export async function listSavedResults(): Promise<SavedResultRecord[]> {
  return db.results.orderBy("createdAt").reverse().toArray();
}

export async function getSavedList(id: number): Promise<SavedListRecord | undefined> {
  return db.lists.get(id);
}

export async function getSavedResult(id: number): Promise<SavedResultRecord | undefined> {
  return db.results.get(id);
}

export async function deleteSavedList(id: number): Promise<void> {
  await db.lists.delete(id);
}

export async function deleteSavedResult(id: number): Promise<void> {
  await db.results.delete(id);
}
