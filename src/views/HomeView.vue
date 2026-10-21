<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import PillSelect from "../components/PillSelect.vue";
import ProviderSelect from "../components/ProviderSelect.vue";
import Thumb from "../components/Thumb.vue";
import { useSessionStore } from "../stores/session";
import { displayTitle } from "../utils/display";
import type { PreviewProvider } from "../media/previews";
import type { ShikiListStatus } from "../io/shikiProfile";

const statusOptions: { value: ShikiListStatus; label: string }[] = [
  { value: "completed", label: "Completed" },
  { value: "watching", label: "Watching" },
  { value: "planned", label: "Planned" },
  { value: "on_hold", label: "On hold" },
  { value: "dropped", label: "Dropped" },
  { value: "rewatching", label: "Rewatching" },
  { value: "all", label: "All" },
];

const router = useRouter();
const session = useSessionStore();
const {
  items,
  loading,
  loadError,
  hasItems,
  seedMeta,
  sessionName,
  historyLists,
  historyResults,
  previewProvider,
  previewLoading,
  previewProgress,
  profileLoading,
  profileProgress,
} = storeToRefs(session);

const fileInput = ref<HTMLInputElement | null>(null);
const profileInput = ref("");
const profileStatus = ref<ShikiListStatus>("completed");

onMounted(async () => {
  await session.refreshHistory();
  if (items.value.length === 0 && !loading.value) {
    await session.loadSample({ quiet: true });
  }
});

async function onReload(): Promise<void> {
  await session.loadSample();
}

async function onLoadProfile(): Promise<void> {
  await session.loadShikiProfile(profileInput.value, profileStatus.value);
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
        Load a list (sample, Shikimori profile URL, JSON export, or history), run pairwise duels, or
        open an already finished ranking. Everything stays in this browser for now.
      </p>
    </header>

    <div class="profile-block">
      <div class="profile-row">
        <label class="profile-row__field">
          <span>Shikimori profile</span>
          <input
            v-model="profileInput"
            type="text"
            inputmode="url"
            autocomplete="off"
            spellcheck="false"
            placeholder="https://shikimori.io/Dan_Lore"
            :disabled="profileLoading"
            @keydown.enter.prevent="onLoadProfile"
          />
        </label>
        <label class="profile-row__field profile-row__field--status">
          <span>Status</span>
          <PillSelect
            v-model="profileStatus"
            :options="statusOptions"
            :disabled="profileLoading"
            aria-label="List status filter"
          />
        </label>
        <button
          type="button"
          class="btn btn--primary"
          :disabled="profileLoading || !profileInput.trim()"
          @click="onLoadProfile"
        >
          {{ profileLoading ? "Loading…" : "Load from Shiki" }}
        </button>
      </div>
      <p v-if="profileLoading && profileProgress" class="profile-status" aria-live="polite">
        {{ profileProgress.phase }}
        <template v-if="profileProgress.loaded > 0">
          · {{ profileProgress.loaded }} items
        </template>
      </p>
    </div>

    <div class="toolbar">
      <button type="button" class="btn btn--ghost" :disabled="loading" @click="onReload">
        {{ loading && !profileLoading ? "Loading…" : "Reload sample" }}
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
      <label class="provider">
        <span>Posters</span>
        <ProviderSelect
          :model-value="previewProvider"
          :disabled="previewLoading"
          @update:model-value="(v: PreviewProvider) => session.setPreviewProvider(v)"
        />
      </label>
      <button
        type="button"
        class="btn btn--ghost"
        :disabled="!items.length || previewLoading"
        @click="session.enrichPreviews()"
      >
        {{
          previewLoading && previewProgress
            ? `Posters ${previewProgress.done}/${previewProgress.total}`
            : "Fetch posters"
        }}
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
        <Thumb
          :item="item"
          :src="item.imageUrl"
          :label="displayTitle(item)"
          :provider="previewProvider"
        />
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
