<script setup lang="ts">
  // A small ⓘ next to a setting's label. The explanation opens on hover (and is the
  // button's label for screen readers), so labels stay short and screens uncluttered.
  // Phones have no hover, so a tap opens it too; tapping elsewhere closes it.
  defineProps<{ text: string }>()

  const open = ref(false)
</script>

<template>
  <UPopover v-model:open="open" mode="hover" :open-delay="150" :content="{ side: 'top' }">
    <button
      type="button"
      class="inline-flex shrink-0 align-middle text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
      :aria-label="text"
      @click.stop="open = !open"
    >
      <UIcon name="i-heroicons-information-circle" class="size-4" />
    </button>
    <template #content>
      <p class="max-w-64 px-3 py-2 text-xs text-gray-600 dark:text-gray-300">{{ text }}</p>
    </template>
  </UPopover>
</template>
