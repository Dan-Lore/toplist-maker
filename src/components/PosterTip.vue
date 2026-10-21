<script setup lang="ts">
import type { PreviewIssue } from "../media/previewIssue";

defineProps<{
  issue: PreviewIssue;
}>();
</script>

<template>
  <span class="poster-tip" role="tooltip">
    <span class="poster-tip__msg">{{ issue.message }}</span>
    <span class="poster-tip__detail">{{ issue.detail }}</span>
  </span>
</template>
