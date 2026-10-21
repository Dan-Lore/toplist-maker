<script setup lang="ts">
import type { PreviewProvider } from "../media/previews";
import PillSelect from "./PillSelect.vue";

defineProps<{
  modelValue: PreviewProvider;
  disabled?: boolean;
}>();

defineEmits<{
  "update:modelValue": [value: PreviewProvider];
}>();

const options: { value: PreviewProvider; label: string }[] = [
  { value: "auto", label: "Auto (Shiki → MAL)" },
  { value: "shiki", label: "Shikimori" },
  { value: "mal", label: "MAL (Jikan)" },
];
</script>

<template>
  <PillSelect
    :model-value="modelValue"
    :options="options"
    :disabled="disabled"
    aria-label="Poster provider"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>
