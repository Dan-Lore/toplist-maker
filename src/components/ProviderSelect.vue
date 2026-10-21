<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import type { PreviewProvider } from "../media/previews";

const props = defineProps<{
  modelValue: PreviewProvider;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: PreviewProvider];
}>();

const options: { value: PreviewProvider; label: string }[] = [
  { value: "auto", label: "Auto (Shiki → MAL)" },
  { value: "shiki", label: "Shikimori" },
  { value: "mal", label: "MAL (Jikan)" },
];

const open = ref(false);
const root = ref<HTMLElement | null>(null);

const currentLabel = computed(
  () => options.find((o) => o.value === props.modelValue)?.label ?? options[0]!.label,
);

function toggle(): void {
  if (props.disabled) return;
  open.value = !open.value;
}

function pick(value: PreviewProvider): void {
  emit("update:modelValue", value);
  open.value = false;
}

function onDocPointer(event: Event): void {
  const target = event.target as Node | null;
  if (!root.value || !target || root.value.contains(target)) return;
  open.value = false;
}

function onKey(event: KeyboardEvent): void {
  if (event.key === "Escape") open.value = false;
}

onMounted(() => {
  document.addEventListener("pointerdown", onDocPointer);
  document.addEventListener("keydown", onKey);
});

onUnmounted(() => {
  document.removeEventListener("pointerdown", onDocPointer);
  document.removeEventListener("keydown", onKey);
});
</script>

<template>
  <div ref="root" class="provider-select" :class="{ 'provider-select--open': open }">
    <!-- Keeps width fixed to the longest label so the control doesn't jump on change -->
    <div class="provider-select__sizer" aria-hidden="true">
      <span v-for="opt in options" :key="opt.value" class="provider-select__sizer-row">
        {{ opt.label }}
      </span>
    </div>
    <button
      type="button"
      class="provider-select__trigger"
      :disabled="disabled"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="toggle"
    >
      <span class="provider-select__label">{{ currentLabel }}</span>
      <span class="provider-select__chevron" aria-hidden="true" />
    </button>
    <ul v-if="open" class="provider-select__menu" role="listbox">
      <li
        v-for="opt in options"
        :key="opt.value"
        role="option"
        :aria-selected="opt.value === modelValue"
      >
        <button
          type="button"
          class="provider-select__option"
          :class="{ 'provider-select__option--active': opt.value === modelValue }"
          @click="pick(opt.value)"
        >
          {{ opt.label }}
        </button>
      </li>
    </ul>
  </div>
</template>
