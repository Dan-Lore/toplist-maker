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
  sourceListId?: number,
): Promise<number> {
  const id = await db.results.add({
    name,
    createdAt: Date.now(),
    ranking: cloneJson(ranking),
    sourceListId,
  });
  if (id === undefined) throw new Error("Failed to save result");
  return id;
}

export async function listSavedResults(): Promise<SavedResultRecord[]> {
  return db.results.orderBy("createdAt").reverse().toArray();
}
