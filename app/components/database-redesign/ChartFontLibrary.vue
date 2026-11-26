<script setup lang="ts">
  /**
   * Purpose
   * Let someone try a font before changing the chart.
   *
   * Inputs
   * - The font currently applied to the chart.
   *
   * Outputs
   * - The chosen font name when Apply Font is clicked.
   *
   * Pseudocode
   * Open the library → select a font → preview it → apply the selection.
   */
  import { ref } from 'vue'

  const props = defineProps<{ modelValue: string }>()
  const emit = defineEmits<{ 'update:modelValue': [font: string] }>()

  const graphFonts = [
    'Inter',
    'Roboto Slab',
    'JetBrains Mono',
    'Arial',
    'Verdana',
    'Tahoma',
    'Trebuchet MS',
    'Segoe UI',
    'Calibri',
    'Candara',
    'Corbel',
    'Georgia',
    'Cambria',
    'Constantia',
    'Times New Roman',
    'Palatino Linotype',
    'Consolas',
    'Courier New',
  ] as const

  // Keep a preview selection separate from the font saved on the chart.
  const draftFont = ref(props.modelValue)
  const libraryOpen = ref(false)

  function openLibrary() {
    draftFont.value = props.modelValue
    libraryOpen.value = true
  }

  function applyFont() {
    emit('update:modelValue', draftFont.value)
    libraryOpen.value = false
  }
</script>

<template>
  <div class="font-library">
    <button v-if="!libraryOpen" type="button" class="secondary-button" @click="openLibrary">
      Font Library
    </button>
    <span v-if="!libraryOpen" class="font-library-current">{{ modelValue }}</span>

    <div v-else class="font-library-panel">
      <label>
        Choose a Font
        <select v-model="draftFont">
          <option v-if="!graphFonts.some(font => font === modelValue)" :value="modelValue">{{ modelValue }}</option>
          <option v-for="font in graphFonts" :key="font" :value="font">{{ font }}</option>
        </select>
      </label>
      <div class="font-library-preview" :style="{ fontFamily: JSON.stringify(draftFont) + ', sans-serif' }">
        <strong>{{ draftFont }}</strong>
        <span>Spring 2026 · 150 Students</span>
        <span>ABCDEFGHIJKLMNOPQRSTUVWXYZ · 0123456789</span>
      </div>
      <p class="font-library-hint">If a font is unavailable on this device, ESA uses a fallback.</p>
      <div class="font-library-actions">
        <button type="button" class="primary-button" @click="applyFont">Apply Font</button>
        <button type="button" class="secondary-button" @click="libraryOpen = false">Cancel</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .font-library { grid-column: 1 / -1; min-width: 0; }
  .font-library-current { margin-inline-start: 8px; color: var(--muted-foreground); font-size: 0.875rem; }
  .font-library-panel { display: grid; gap: 10px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; }
  .font-library-panel select { display: block; width: 100%; margin-top: 4px; }
  .font-library-preview { display: grid; gap: 4px; overflow-wrap: anywhere; padding: 12px; background: var(--background); border-radius: 6px; font-size: 1rem; }
  .font-library-hint { margin: 0; font-size: 0.75rem; color: var(--muted-foreground); }
  .font-library-actions { display: flex; flex-wrap: wrap; gap: 8px; }
</style>
