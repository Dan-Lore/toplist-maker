<script setup lang="ts">
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useSessionStore } from "../stores/session";
import { displayTitle } from "../utils/display";

const router = useRouter();
const session = useSessionStore();
const { items, loading, loadError, hasItems, seedMeta } = storeToRefs(session);

onMounted(() => {
  if (items.value.length === 0 && !loading.value) {
    void session.loadSample();
  }
});

async function onReload(): Promise<void> {
  await session.loadSample();
}

function onStart(): void {
  if (!session.startTournament()) return;
  void router.push({ name: "duel" });
}
</script>

<template>
  <section class="panel">
    <header class="panel__header">
      <p class="eyebrow">Private MVP</p>
      <h1 class="brand">Toplist Maker</h1>
      <p class="lede">
        Load a seed list, then rank it through pairwise duels — pick A or B until a personal top
        emerges.
      </p>
    </header>

    <div class="toolbar">
      <button type="button" class="btn btn--ghost" :disabled="loading" @click="onReload">
        {{ loading ? "Loading…" : "Reload sample" }}
      </button>
      <button
        type="button"
        class="btn btn--primary"
        :disabled="!hasItems || loading"
        @click="onStart"
      >
        Start tournament
      </button>
    </div>

    <p v-if="loadError" class="error" role="alert">{{ loadError }}</p>

    <p v-if="seedMeta" class="meta-line">
      <template v-if="seedMeta.source">Source: {{ seedMeta.source }} · </template>
      {{ items.length }} contenders ready
    </p>

    <ul v-if="items.length" class="seed-list">
      <li v-for="item in items" :key="String(item.id)" class="seed-list__row">
        <span class="seed-list__title">{{ displayTitle(item) }}</span>
        <span v-if="item.score != null" class="seed-list__score">{{ item.score }}</span>
      </li>
    </ul>

    <p v-else-if="!loading" class="empty">No items loaded yet.</p>
  </section>
</template>
