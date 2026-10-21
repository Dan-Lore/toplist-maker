<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { Contender } from "../domain";
import { displayTitle } from "../utils/display";
import { diagnoseMissingPoster, formatPreviewIssueTooltip } from "../media/previewIssue";
import { staticPreviewCandidates, type PreviewProvider } from "../media/previews";
import PosterTip from "./PosterTip.vue";

const props = withDefaults(
  defineProps<{
    item: Contender;
    shortcut?: string;
    interactive?: boolean;
    provider?: PreviewProvider;
  }>(),
  { provider: "auto" },
);

defineEmits<{
  pick: [];
}>();

const candidateIndex = ref(0);
const failedUrls = ref<string[]>([]);

const candidates = computed(() => staticPreviewCandidates(props.item, props.provider));

const currentSrc = computed(() => candidates.value[candidateIndex.value]);

watch(
  () => [props.item.id, props.item.imageUrl, props.provider] as const,
  () => {
    candidateIndex.value = 0;
    failedUrls.value = [];
  },
);

function onImgError(): void {
  const failed = currentSrc.value;
  if (failed && !failedUrls.value.includes(failed)) {
    failedUrls.value = [...failedUrls.value, failed];
  }
  if (candidateIndex.value + 1 < candidates.value.length) {
    candidateIndex.value += 1;
    return;
  }
  candidateIndex.value = candidates.value.length;
}

const showImage = computed(
  () => Boolean(currentSrc.value) && candidateIndex.value < candidates.value.length,
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
  <button v-if="interactive" type="button" class="card card--interactive" @click="$emit('pick')">
    <span v-if="shortcut" class="card__key">{{ shortcut }}</span>
    <div class="card__media" :title="nativeTitle">
      <img
        v-if="showImage"
        :src="currentSrc"
        alt=""
        loading="lazy"
        referrerpolicy="no-referrer"
        @error="onImgError"
      />
      <div v-else class="card__placeholder" aria-hidden="true">
        <span>{{ displayTitle(item).slice(0, 1) }}</span>
      </div>
      <PosterTip v-if="issue" :issue="issue" />
    </div>
    <div class="card__body">
      <strong class="card__title">{{ displayTitle(item) }}</strong>
      <span v-if="item.titleRu && item.title !== item.titleRu" class="card__sub">
        {{ item.title }}
      </span>
      <span v-if="item.score != null" class="card__meta">Score {{ item.score }}</span>
    </div>
  </button>

  <article v-else class="card">
    <div class="card__media card__media--sm" :title="nativeTitle">
      <img
        v-if="showImage"
        :src="currentSrc"
        alt=""
        loading="lazy"
        referrerpolicy="no-referrer"
        @error="onImgError"
      />
      <div v-else class="card__placeholder" aria-hidden="true">
        <span>{{ displayTitle(item).slice(0, 1) }}</span>
      </div>
      <PosterTip v-if="issue" :issue="issue" />
    </div>
    <div class="card__body">
      <strong class="card__title">{{ displayTitle(item) }}</strong>
      <span v-if="item.titleRu && item.title !== item.titleRu" class="card__sub">
        {{ item.title }}
      </span>
    </div>
  </article>
</template>
