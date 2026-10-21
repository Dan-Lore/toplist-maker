<script setup lang="ts">
import { onMounted, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import ContenderCard from "../components/ContenderCard.vue";
import { useSessionStore } from "../stores/session";
import type { ContenderId } from "../domain";

const router = useRouter();
const session = useSessionStore();
const { currentPair, started, complete, progressLabel, progressPercent, hasItems } =
  storeToRefs(session);

async function pick(id: ContenderId): Promise<void> {
  await session.recordWinner(id);
}

function onKey(e: KeyboardEvent): void {
  if (e.repeat || !currentPair.value) return;
  const target = e.target as HTMLElement | null;
  if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

  if (e.key === "1") {
    e.preventDefault();
    void pick(currentPair.value.a.id);
  } else if (e.key === "2") {
    e.preventDefault();
    void pick(currentPair.value.b.id);
  }
}

onMounted(() => {
  if (!started.value) {
    if (hasItems.value) {
      session.startTournament();
    } else {
      void router.replace({ name: "home" });
      return;
    }
  }
  if (complete.value) {
    void router.replace({ name: "results" });
    return;
  }
  window.addEventListener("keydown", onKey);
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKey);
});

watch(complete, (done) => {
  if (done) void router.replace({ name: "results" });
});
</script>

<template>
  <section class="panel duel">
    <header class="duel__header">
      <RouterLink class="back-link" :to="{ name: 'home' }">← Setup</RouterLink>
      <h1 class="duel__title">Duel</h1>
      <p class="duel__hint">Press <kbd>1</kbd> or <kbd>2</kbd> to pick a winner</p>
      <div class="progress" aria-label="Tournament progress">
        <div class="progress__bar" :style="{ width: `${progressPercent}%` }" />
      </div>
      <p class="progress__label">{{ progressLabel }}</p>
    </header>

    <div v-if="currentPair" class="duel__arena">
      <ContenderCard
        :item="currentPair.a"
        shortcut="1"
        interactive
        @pick="pick(currentPair.a.id)"
      />
      <p class="duel__vs" aria-hidden="true">vs</p>
      <ContenderCard
        :item="currentPair.b"
        shortcut="2"
        interactive
        @pick="pick(currentPair.b.id)"
      />
    </div>

    <p v-else class="empty">No active pair — finishing up…</p>
  </section>
</template>
