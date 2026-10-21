<script setup lang="ts">
import { ref, watch } from "vue";
import type { Contender } from "../domain";
import { displayTitle } from "../utils/display";

const props = defineProps<{
  item: Contender;
  shortcut?: string;
  interactive?: boolean;
}>();

defineEmits<{
  pick: [];
}>();

const imgFailed = ref(false);

watch(
  () => props.item.imageUrl,
  () => {
    imgFailed.value = false;
  },
);

function onImgError(): void {
  imgFailed.value = true;
}
</script>

<template>
  <button v-if="interactive" type="button" class="card card--interactive" @click="$emit('pick')">
    <span v-if="shortcut" class="card__key">{{ shortcut }}</span>
    <div class="card__media">
      <img
        v-if="item.imageUrl && !imgFailed"
        :src="item.imageUrl"
        :alt="displayTitle(item)"
        loading="lazy"
        @error="onImgError"
      />
      <div v-else class="card__placeholder" aria-hidden="true">
        <span>{{ displayTitle(item).slice(0, 1) }}</span>
      </div>
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
    <div class="card__media card__media--sm">
      <img
        v-if="item.imageUrl && !imgFailed"
        :src="item.imageUrl"
        :alt="displayTitle(item)"
        loading="lazy"
        @error="onImgError"
      />
      <div v-else class="card__placeholder" aria-hidden="true">
        <span>{{ displayTitle(item).slice(0, 1) }}</span>
      </div>
    </div>
    <div class="card__body">
      <strong class="card__title">{{ displayTitle(item) }}</strong>
      <span v-if="item.titleRu && item.title !== item.titleRu" class="card__sub">
        {{ item.title }}
      </span>
    </div>
  </article>
</template>
