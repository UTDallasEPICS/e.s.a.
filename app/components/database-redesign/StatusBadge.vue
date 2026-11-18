<script setup lang="ts">
  import { computed } from 'vue'

  const props = defineProps<{ status: string }>()

  const styles: Record<string, string> = {
    Active: 'background:#dcfce7;color:#166534',
    New: 'background:#dce8cf;color:#244c20',
    'In Progress': 'background:#dcfce7;color:#166534',
    Paused: 'background:#fef9c3;color:#854d0e',
    Completed: 'background:#dbeafe;color:#1d4ed8',
    Dropped: 'background:#fee2e2;color:#991b1b',
  }

  const style = computed(() => styles[props.status] ?? 'background:#f0ede6;color:#3d2a00')
</script>

<template>
  <span class="badge" :style="style">{{ status }}</span>
</template>
