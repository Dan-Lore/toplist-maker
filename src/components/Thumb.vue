<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { Contender } from "../domain";
import { diagnoseMissingPoster, formatPreviewIssueTooltip } from "../media/previewIssue";
import { staticPreviewCandidates, type PreviewProvider } from "../media/previews";
import PosterTip from "./PosterTip.vue";

const props = withDefaults(
  defineProps<{
    src?: string;
    label: string;
    item?: Contender;
    provider?: PreviewProvider;
  }>(),
  { provider: "auto" },
);

const index = ref(0);
const failedUrls = ref<string[]>([]);

const candidates = computed(() => {
  if (props.item) return staticPreviewCandidates(props.item, props.provider);
  return props.src ? [props.src] : [];
});

const currentSrc = computed(() => candidates.value[index.value]);

watch(
  () => [props.src, props.item?.id, props.item?.imageUrl, props.provider] as const,
  () => {
    index.value = 0;
    failedUrls.value = [];
  },
);

function onError(): void {
  const failed = currentSrc.value;
  if (failed && !failedUrls.value.includes(failed)) {
    failedUrls.value = [...failedUrls.value, failed];
  }
  if (index.value + 1 < candidates.value.length) {
    index.value += 1;
    return;
  }
  index.value = candidates.value.length;
}

const showImage = computed(
  () => Boolean(currentSrc.value) && index.value < candidates.value.length,
);

const issue = computed(() => {
  if (showImage.value) return null;
  return diagnoseMissingPoster({
    item: props.item,
    provider: props.provider,
    candidates: candidates.value,
    failedUrls: failedUrls.value,
  });
});

const nativeTitle = computed(() =>
  issue.value ? formatPreviewIssueTooltip(issue.value) : undefined,
);
</script>

<template>
  <span class="thumb-wrap" :title="nativeTitle">
    <img
      v-if="showImage"
      class="thumb"
      :src="currentSrc"
      alt=""
      loading="lazy"
      referrerpolicy="no-referrer"
      @error="onError"
    />
    <span v-else class="thumb thumb--empty" aria-hidden="true">{{ label.slice(0, 1) }}</span>
    <PosterTip v-if="issue" :issue="issue" />
  </span>
</template>
