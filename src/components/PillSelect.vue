<script setup lang="ts" generic="T extends string">
import { computed, onMounted, onUnmounted, ref } from "vue";

const props = defineProps<{
  modelValue: T;
  options: { value: T; label: string }[];
  disabled?: boolean;
  ariaLabel?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: T];
}>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);

const currentLabel = computed(
  () =>
    props.options.find((o) => o.value === props.modelValue)?.label ?? props.options[0]?.label ?? "",
);

function toggle(): void {
  if (props.disabled) return;
  open.value = !open.value;
}

function pick(value: T): void {
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
  <div ref="root" class="pill-select" :class="{ 'pill-select--open': open }">
    <div class="pill-select__sizer" aria-hidden="true">
      <span v-for="opt in options" :key="opt.value" class="pill-select__sizer-row">
        {{ opt.label }}
      </span>
    </div>
    <button
      type="button"
      class="pill-select__trigger"
      :disabled="disabled"
      :aria-expanded="open"
      :aria-label="ariaLabel"
      aria-haspopup="listbox"
      @click="toggle"
    >
      <span class="pill-select__label">{{ currentLabel }}</span>
      <span class="pill-select__chevron" aria-hidden="true" />
    </button>
    <ul v-if="open" class="pill-select__menu" role="listbox">
      <li
        v-for="opt in options"
        :key="opt.value"
        role="option"
        :aria-selected="opt.value === modelValue"
      >
        <button
          type="button"
          class="pill-select__option"
          :class="{ 'pill-select__option--active': opt.value === modelValue }"
          @click="pick(opt.value)"
        >
          {{ opt.label }}
        </button>
      </li>
    </ul>
  </div>
</template>
