<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useSessionStore } from "../stores/session";
import { displayTitle } from "../utils/display";

const router = useRouter();
const session = useSessionStore();
const { items, loading, loadError, hasItems, seedMeta, sessionName, historyLists, historyResults } =
  storeToRefs(session);

const fileInput = ref<HTMLInputElement | null>(null);

onMounted(async () => {
  await session.refreshHistory();
  if (items.value.length === 0 && !loading.value) {
    await session.loadSample();
  }
});

async function onReload(): Promise<void> {
  await session.loadSample();
}

function onStart(): void {
  if (!session.startTournament()) return;
  void router.push({ name: "duel" });
}

function onExportList(): void {
  session.exportCurrentList();
}

function onPickFile(): void {
  fileInput.value?.click();
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  try {
    const text = await file.text();
    const doc = await session.importPortableJson(JSON.parse(text) as unknown);
    if (doc.kind === "ranking") {
      void router.push({ name: "results" });
    }
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : String(err);
  }
}

async function onOpenList(id: number | undefined): Promise<void> {
  if (id == null) return;
  await session.loadHistoryList(id);
}

async function onOpenResult(id: number | undefined): Promise<void> {
  if (id == null) return;
  await session.loadHistoryResult(id);
  void router.push({ name: "results" });
}

function formatWhen(ts: number): string {
  return new Date(ts).toLocaleString();
}
</script>

<template>
  <section class="panel">
    <header class="panel__header">
      <p class="eyebrow">Private MVP</p>
      <h1 class="brand">Toplist Maker</h1>
      <p class="lede">
        Load a list (sample, file, or history), run pairwise duels, or open an already finished
        ranking. Everything stays in this browser for now.
      </p>
    </header>

    <div class="toolbar">
      <button type="button" class="btn btn--ghost" :disabled="loading" @click="onReload">
        {{ loading ? "Loading…" : "Reload sample" }}
      </button>
      <button type="button" class="btn btn--ghost" :disabled="loading" @click="onPickFile">
        Import JSON
      </button>
      <button
        type="button"
        class="btn btn--ghost"
        :disabled="!items.length || loading"
        @click="onExportList"
      >
        Export list
      </button>
      <button
        type="button"
        class="btn btn--primary"
        :disabled="!hasItems || loading"
        @click="onStart"
      >
        Start tournament
      </button>
      <input
        ref="fileInput"
        class="file-input"
        type="file"
        accept="application/json,.json"
        @change="onFileChange"
      />
    </div>

    <p v-if="loadError" class="error" role="alert">{{ loadError }}</p>

    <p class="meta-line">
      <strong>{{ sessionName }}</strong>
      · {{ items.length }} contenders
      <template v-if="seedMeta?.source"> · {{ seedMeta.source }}</template>
    </p>

    <ul v-if="items.length" class="seed-list">
      <li v-for="item in items" :key="String(item.id)" class="seed-list__row">
        <span class="seed-list__title">{{ displayTitle(item) }}</span>
        <span v-if="item.score != null" class="seed-list__score">{{ item.score }}</span>
      </li>
    </ul>

    <p v-else-if="!loading" class="empty">No items loaded yet.</p>

    <section class="history">
      <h2 class="history__title">Local history</h2>
      <p class="meta-line">
        Saved lists and finished tops in IndexedDB. Export anytime; cloud sync is a later TODO.
      </p>

      <div class="history__grid">
        <div>
          <h3 class="history__subtitle">Lists</h3>
          <ul v-if="historyLists.length" class="history-list">
            <li v-for="row in historyLists" :key="row.id" class="history-list__row">
              <button type="button" class="history-list__main" @click="onOpenList(row.id)">
                <strong>{{ row.name }}</strong>
                <span>{{ row.items.length }} items · {{ formatWhen(row.createdAt) }}</span>
              </button>
              <button
                type="button"
                class="btn btn--ghost btn--tiny"
                @click="session.removeHistoryList(row.id!)"
              >
                Delete
              </button>
            </li>
          </ul>
          <p v-else class="empty">No saved lists yet.</p>
        </div>

        <div>
          <h3 class="history__subtitle">Rankings</h3>
          <ul v-if="historyResults.length" class="history-list">
            <li v-for="row in historyResults" :key="row.id" class="history-list__row">
              <button type="button" class="history-list__main" @click="onOpenResult(row.id)">
                <strong>{{ row.name }}</strong>
                <span>{{ row.ranking.length }} places · {{ formatWhen(row.createdAt) }}</span>
              </button>
              <button
                type="button"
                class="btn btn--ghost btn--tiny"
                @click="session.removeHistoryResult(row.id!)"
              >
                Delete
              </button>
            </li>
          </ul>
          <p v-else class="empty">No saved rankings yet.</p>
        </div>
      </div>
    </section>
  </section>
</template>
