<script setup lang="ts">
  const props = defineProps<{ status: string }>()

  const styles: Record<string, string> = {
    Active: 'background:#dcfce7;color:#166534',
    Completed: 'background:#d4edda;color:#145214',
    Paused: 'background:#fef9c3;color:#854d0e',
    'In Progress': 'background:#dcfce7;color:#166534',
    New: 'background:#fff1e7;color:#a0440e',
  }
  const style = styles[props.status] ?? 'background:#f0ede6;color:#3d2a00'
</script>

<template>
  <span class="badge" :style="style">{{ status }}</span>
</template>
