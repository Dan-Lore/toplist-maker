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
import { saveList, saveResult } from "../db";

const SAMPLE_URL = "/samples/shiki-completed-seed.json";

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

  /** Domain tournament kept outside deep reactivity. */
  let tournament: Tournament | null = null;

  const itemCount = computed(() => items.value.length);
  const hasItems = computed(() => items.value.length >= 2);
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

  async function loadSample(): Promise<void> {
    loading.value = true;
    loadError.value = null;
    try {
      const res = await fetch(SAMPLE_URL);
      if (!res.ok) {
        throw new Error(`Failed to load sample (${res.status})`);
      }
      const data = (await res.json()) as SeedFile;
      const selected = selectTopCompleted(data.items);
      items.value = selected;
      seedMeta.value = data.meta ?? null;
      try {
        savedListId.value = await saveList("Shiki completed seed", selected, data.meta);
      } catch (persistErr) {
        console.warn("Could not persist list locally", persistErr);
        savedListId.value = undefined;
      }
      resetTournament();
    } catch (err) {
      loadError.value = err instanceof Error ? err.message : String(err);
      items.value = [];
      seedMeta.value = null;
    } finally {
      loading.value = false;
    }
  }

  function resetTournament(): void {
    tournament = null;
    started.value = false;
    complete.value = false;
    currentPair.value = null;
    progress.value = emptyProgress();
    ranking.value = [];
    lastResultId.value = undefined;
  }

  function startTournament(): boolean {
    if (items.value.length < 2) {
      loadError.value = "Need at least 2 items to start a tournament";
      return false;
    }
    loadError.value = null;
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
          `Result ${new Date().toLocaleString()}`,
          ranking.value,
          savedListId.value,
        );
      } catch (persistErr) {
        console.warn("Could not persist result locally", persistErr);
        lastResultId.value = undefined;
      }
    }
    return true;
  }

  return {
    items,
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
    itemCount,
    hasItems,
    progressLabel,
    progressPercent,
    loadSample,
    startTournament,
    recordWinner,
    resetTournament,
  };
});
