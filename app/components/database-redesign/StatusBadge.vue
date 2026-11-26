<script setup lang="ts">
  /**
   * Purpose
   * Render the status badge part of the ESA interface.
   *
   * Inputs
   * - The component’s props, shared state, and any user actions it handles.
   *
   * Outputs
   * - Rendered controls or content, plus events exposed to the parent where applicable.
   *
   * Pseudocode
   * Read the inputs → prepare values for display → render the template → respond to user actions.
   */
  import { computed } from 'vue'

  // Use defineProps to initialize props.
  const props = defineProps<{ status: string }>()

  // Define styles for the steps below.
  const styles: Record<string, string> = {
    Active: 'background:#dcfce7;color:#166534',
    New: 'background:#dce8cf;color:#244c20',
    'In Progress': 'background:#dcfce7;color:#166534',
    Paused: 'background:#fef9c3;color:#854d0e',
    Completed: 'background:#dbeafe;color:#1d4ed8',
    Dropped: 'background:#fee2e2;color:#991b1b',
  }

  // Recalculate style when the values it reads change.
  const style = computed(() => styles[props.status] ?? 'background:#f0ede6;color:#3d2a00')
</script>

<template>
  <span class="badge" :style="style">{{ status }}</span>
</template>
