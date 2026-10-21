import { computed, ref } from "vue";
import { defineStore } from "pinia";
import {
  createTournament,
  selectTopCompleted,
  type Contender,
  type ContenderId,
  type Pair,
  type RankedContender,
  type Tournament,
  type TournamentProgress,
} from "../domain";
import {
  deleteSavedList,
  deleteSavedResult,
  getSavedList,
  getSavedResult,
  listSavedLists,
  listSavedResults,
  saveList,
  saveResult,
  type SavedListRecord,
  type SavedResultRecord,
} from "../db";
import {
  buildListDocument,
  buildRankingDocument,
  downloadJson,
  parsePortable,
  slugifyFilename,
  type PortableDocument,
} from "../io/portable";
import { enrichContendersWithPreviews, type PreviewProvider } from "../media/previews";

const SAMPLE_URL = `${import.meta.env.BASE_URL}samples/shiki-completed-seed.json`;

interface SeedFile {
  meta?: Record<string, unknown>;
  items: Array<Contender & { episodes?: number; status?: string }>;
}

const emptyProgress = (): TournamentProgress => ({
  round: 0,
  totalRounds: 0,
  pairsPlayed: 0,
  pairsTotal: 0,
  pendingInRound: 0,
});

export const useSessionStore = defineStore("session", () => {
  const items = ref<Contender[]>([]);
  const sessionName = ref("Untitled list");
  const seedMeta = ref<Record<string, unknown> | null>(null);
  const savedListId = ref<number | undefined>();
  const loadError = ref<string | null>(null);
  const loading = ref(false);

  const currentPair = ref<Pair | null>(null);
  const progress = ref<TournamentProgress>(emptyProgress());
  const ranking = ref<RankedContender[]>([]);
  const complete = ref(false);
  const started = ref(false);
  const lastResultId = ref<number | undefined>();
  /** True when user opened a finished ranking without starting a new duel. */
  const viewingImportedRanking = ref(false);

  const historyLists = ref<SavedListRecord[]>([]);
  const historyResults = ref<SavedResultRecord[]>([]);
  const previewProvider = ref<PreviewProvider>("auto");
  const previewLoading = ref(false);
  const previewProgress = ref<{ done: number; total: number } | null>(null);

  /** Domain tournament kept outside deep reactivity. */
  let tournament: Tournament | null = null;

  const itemCount = computed(() => items.value.length);
  const hasItems = computed(() => items.value.length >= 2);
  const hasRanking = computed(() => ranking.value.length > 0);
  const progressLabel = computed(() => {
    const p = progress.value;
    if (!started.value || p.pairsTotal <= 0) return "";
    return `Round ${p.round}/${p.totalRounds} · ${p.pairsPlayed}/${p.pairsTotal}`;
  });
  const progressPercent = computed(() => {
    const p = progress.value;
    if (p.pairsTotal <= 0) return 0;
    return Math.min(100, Math.round((p.pairsPlayed / p.pairsTotal) * 100));
  });

  function syncFromTournament(): void {
    if (!tournament) {
      currentPair.value = null;
      progress.value = emptyProgress();
      ranking.value = [];
      complete.value = false;
      return;
    }
    currentPair.value = tournament.nextPair();
    progress.value = tournament.getProgress();
    ranking.value = tournament.getRanking();
    complete.value = tournament.isComplete();
  }

  function resetTournament(): void {
    tournament = null;
    started.value = false;
    complete.value = false;
    currentPair.value = null;
    progress.value = emptyProgress();
    ranking.value = [];
    lastResultId.value = undefined;
    viewingImportedRanking.value = false;
  }

  async function refreshHistory(): Promise<void> {
    const [lists, results] = await Promise.all([listSavedLists(), listSavedResults()]);
    historyLists.value = lists;
    historyResults.value = results;
  }

  async function applyList(
    name: string,
    nextItems: Contender[],
    meta?: Record<string, unknown>,
    options?: { persist?: boolean; enrichPreviews?: boolean },
  ): Promise<void> {
    const tagged = nextItems.map((item) => ({
      ...item,
      source: item.source ?? ("shiki" as const),
    }));
    items.value = tagged;
    sessionName.value = name;
    seedMeta.value = meta ?? null;
    resetTournament();
    if (options?.enrichPreviews !== false) {
      void enrichPreviews();
    }
    if (options?.persist === false) {
      savedListId.value = undefined;
      return;
    }
    try {
      savedListId.value = await saveList(name, tagged, meta);
      await refreshHistory();
    } catch (persistErr) {
      console.warn("Could not persist list locally", persistErr);
      savedListId.value = undefined;
    }
  }

  async function enrichPreviews(): Promise<void> {
    if (!items.value.length || previewLoading.value) return;
    previewLoading.value = true;
    previewProgress.value = { done: 0, total: items.value.length };
    try {
      const enriched = await enrichContendersWithPreviews(items.value, previewProvider.value, {
        concurrency: 2,
        onProgress: (done, total) => {
          previewProgress.value = { done, total };
        },
      });
      items.value = enriched;
      // Keep open ranking posters in sync when viewing imported results
      if (viewingImportedRanking.value && ranking.value.length) {
        const byId = new Map(enriched.map((item) => [String(item.id), item]));
        ranking.value = ranking.value.map((row) => {
          const hit = byId.get(String(row.id));
          return hit
            ? { ...row, imageUrl: hit.imageUrl, malId: hit.malId, shikiId: hit.shikiId }
            : row;
        });
      }
    } finally {
      previewLoading.value = false;
      previewProgress.value = null;
    }
  }

  function setPreviewProvider(provider: PreviewProvider): void {
    previewProvider.value = provider;
  }

  async function loadSample(options?: { quiet?: boolean }): Promise<void> {
    loading.value = true;
    loadError.value = null;
    try {
      const res = await fetch(SAMPLE_URL);
      if (!res.ok) {
        throw new Error(`Sample list unavailable (${res.status})`);
      }
      const data = (await res.json()) as SeedFile;
      const selected = selectTopCompleted(data.items);
      await applyList("Shiki completed seed", selected, data.meta);
    } catch (err) {
      items.value = [];
      seedMeta.value = null;
      sessionName.value = "Untitled list";
      // First visit / auto-load: empty setup is fine — don't scare with a red banner.
      if (!options?.quiet) {
        loadError.value = err instanceof Error ? err.message : String(err);
      } else {
        console.warn("Sample list not loaded", err);
      }
    } finally {
      loading.value = false;
    }
  }

  function startTournament(): boolean {
    if (items.value.length < 2) {
      loadError.value = "Need at least 2 items to start a tournament";
      return false;
    }
    loadError.value = null;
    viewingImportedRanking.value = false;
    tournament = createTournament(items.value, { seedBy: "score" });
    started.value = true;
    syncFromTournament();
    return true;
  }

  async function recordWinner(id: ContenderId): Promise<boolean> {
    if (!tournament || complete.value) return false;
    tournament.recordWinner(id);
    syncFromTournament();
    if (complete.value) {
      try {
        lastResultId.value = await saveResult(
          `${sessionName.value} · ${new Date().toLocaleString()}`,
          ranking.value,
          { sourceListId: savedListId.value, items: items.value },
        );
        await refreshHistory();
      } catch (persistErr) {
        console.warn("Could not persist result locally", persistErr);
        lastResultId.value = undefined;
      }
    }
    return true;
  }

  async function importPortableJson(raw: unknown): Promise<PortableDocument> {
    const doc = parsePortable(raw);
    loadError.value = null;
    if (doc.kind === "list") {
      await applyList(doc.name, doc.items ?? [], doc.meta);
      return doc;
    }
    const nextItems = doc.items ?? [];
    items.value = nextItems;
    sessionName.value = doc.name;
    seedMeta.value = doc.meta ?? null;
    resetTournament();
    ranking.value = doc.ranking ?? [];
    complete.value = true;
    viewingImportedRanking.value = true;
    try {
      savedListId.value =
        nextItems.length > 0 ? await saveList(doc.name, nextItems, doc.meta) : undefined;
      lastResultId.value = await saveResult(doc.name, ranking.value, {
        sourceListId: savedListId.value,
        items: nextItems,
      });
      await refreshHistory();
    } catch (persistErr) {
      console.warn("Could not persist imported ranking", persistErr);
    }
    void enrichPreviews();
    return doc;
  }

  async function loadHistoryList(id: number): Promise<void> {
    const row = await getSavedList(id);
    if (!row) throw new Error(`List #${id} not found`);
    items.value = row.items;
    sessionName.value = row.name;
    seedMeta.value = row.meta ?? null;
    savedListId.value = row.id;
    resetTournament();
    void enrichPreviews();
  }

  async function loadHistoryResult(id: number): Promise<"ranking" | "list"> {
    const row = await getSavedResult(id);
    if (!row) throw new Error(`Result #${id} not found`);
    const nextItems =
      row.items ??
      row.ranking.map(
        ({ id: cid, title, titleRu, score, status, imageUrl, malId, shikiId, source }) => ({
          id: cid,
          title,
          titleRu,
          score,
          status,
          imageUrl,
          malId,
          shikiId,
          source,
        }),
      );
    items.value = nextItems;
    sessionName.value = row.name;
    seedMeta.value = null;
    savedListId.value = row.sourceListId;
    resetTournament();
    ranking.value = row.ranking;
    complete.value = true;
    viewingImportedRanking.value = true;
    lastResultId.value = row.id;
    void enrichPreviews();
    return "ranking";
  }

  function exportCurrentList(): void {
    if (!items.value.length) {
      loadError.value = "Nothing to export";
      return;
    }
    const doc = buildListDocument(sessionName.value, items.value, seedMeta.value ?? undefined);
    downloadJson(`${slugifyFilename(sessionName.value)}-list.json`, doc);
  }

  function exportCurrentRanking(): void {
    if (!ranking.value.length) {
      loadError.value = "No ranking to export";
      return;
    }
    const doc = buildRankingDocument(
      sessionName.value,
      ranking.value,
      items.value,
      seedMeta.value ?? undefined,
    );
    downloadJson(`${slugifyFilename(sessionName.value)}-ranking.json`, doc);
  }

  async function removeHistoryList(id: number): Promise<void> {
    await deleteSavedList(id);
    await refreshHistory();
  }

  async function removeHistoryResult(id: number): Promise<void> {
    await deleteSavedResult(id);
    await refreshHistory();
  }

  return {
    items,
    sessionName,
    seedMeta,
    savedListId,
    loadError,
    loading,
    currentPair,
    progress,
    ranking,
    complete,
    started,
    lastResultId,
    viewingImportedRanking,
    historyLists,
    historyResults,
    previewProvider,
    previewLoading,
    previewProgress,
    itemCount,
    hasItems,
    hasRanking,
    progressLabel,
    progressPercent,
    loadSample,
    startTournament,
    recordWinner,
    resetTournament,
    refreshHistory,
    importPortableJson,
    loadHistoryList,
    loadHistoryResult,
    exportCurrentList,
    exportCurrentRanking,
    removeHistoryList,
    removeHistoryResult,
    enrichPreviews,
    setPreviewProvider,
  };
});
