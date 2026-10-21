<script setup lang="ts">
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import Thumb from "../components/Thumb.vue";
import { useSessionStore } from "../stores/session";
import { displayTitle } from "../utils/display";

const router = useRouter();
const session = useSessionStore();
const {
  ranking,
  complete,
  started,
  lastResultId,
  viewingImportedRanking,
  hasItems,
  previewProvider,
} = storeToRefs(session);

onMounted(() => {
  if (!started.value && ranking.value.length === 0) {
    void router.replace({ name: "home" });
  }
});

function onAgain(): void {
  session.resetTournament();
  void router.push({ name: "home" });
}

function onReplay(): void {
  if (!session.startTournament()) return;
  void router.push({ name: "duel" });
}

function onExportRanking(): void {
  session.exportCurrentRanking();
}

function onExportList(): void {
  session.exportCurrentList();
}
</script>

<template>
  <section class="panel">
    <header class="panel__header">
      <RouterLink class="back-link" :to="{ name: 'home' }">← Setup</RouterLink>
      <h1 class="brand brand--sm">Your ranking</h1>
      <p class="lede">
        <template v-if="viewingImportedRanking">Imported / history ranking.</template>
        <template v-else>
          {{ complete ? "Tournament complete." : "Live standings so far." }}
        </template>
        <span v-if="lastResultId != null"> Saved locally (#{{ lastResultId }}).</span>
      </p>
    </header>

    <div class="toolbar">
      <button type="button" class="btn btn--ghost" @click="onAgain">Back to setup</button>
      <button
        type="button"
        class="btn btn--ghost"
        :disabled="!ranking.length"
        @click="onExportRanking"
      >
        Export ranking
      </button>
      <button type="button" class="btn btn--ghost" :disabled="!hasItems" @click="onExportList">
        Export list
      </button>
      <button type="button" class="btn btn--primary" :disabled="!hasItems" @click="onReplay">
        Run again
      </button>
    </div>

    <ol v-if="ranking.length" class="rank-list">
      <li v-for="row in ranking" :key="String(row.id)" class="rank-list__row">
        <span class="rank-list__rank">{{ row.rank }}</span>
        <Thumb
          :item="row"
          :src="row.imageUrl"
          :label="displayTitle(row)"
          :provider="previewProvider"
        />
        <div class="rank-list__main">
          <strong>{{ displayTitle(row) }}</strong>
          <span v-if="row.titleRu && row.title !== row.titleRu" class="rank-list__sub">
            {{ row.title }}
          </span>
        </div>
        <span class="rank-list__stats" title="Wins · strength of schedule">
          {{ row.counter }} · {{ row.coef }}
        </span>
      </li>
    </ol>

    <p v-else class="empty">No ranking yet. Start a tournament from setup.</p>
  </section>
</template>
