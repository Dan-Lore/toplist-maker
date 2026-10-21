<script setup lang="ts">
import { RouterView } from "vue-router";
</script>

<template>
  <div class="shell">
    <nav class="nav" aria-label="Primary">
      <RouterLink class="nav__brand" :to="{ name: 'home' }">Toplist Maker</RouterLink>
      <div class="nav__links">
        <RouterLink :to="{ name: 'home' }">Setup</RouterLink>
        <RouterLink :to="{ name: 'duel' }">Duel</RouterLink>
        <RouterLink :to="{ name: 'results' }">Results</RouterLink>
      </div>
    </nav>
    <main class="main">
      <RouterView />
    </main>
  </div>
</template>
