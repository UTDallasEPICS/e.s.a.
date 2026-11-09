<script setup lang="ts">
  import { ACTION_ICONS } from '~/utils/icons'

  withDefaults(
    defineProps<{
      confirmLabel?: string
      cancelLabel?: string
      confirmColor?: 'primary' | 'error' | 'success' | 'neutral'
      disabled?: boolean
      /** Inside a UForm, Confirm must submit the form rather than emit. */
      submit?: boolean
    }>(),
    { confirmLabel: 'Confirm', cancelLabel: 'Cancel', confirmColor: 'primary' }
  )

  const emit = defineEmits<{ cancel: []; confirm: [] }>()
</script>

<template>
  <div class="flex justify-end gap-2">
    <UButton
      :label="cancelLabel"
      :icon="ACTION_ICONS.cancel"
      color="neutral"
      variant="soft"
      @click="emit('cancel')"
    />
    <UButton
      v-if="submit"
      :label="confirmLabel"
      :icon="ACTION_ICONS.confirm"
      :color="confirmColor"
      :disabled="disabled"
      type="submit"
    />
    <UButton
      v-else
      :label="confirmLabel"
      :icon="ACTION_ICONS.confirm"
      :color="confirmColor"
      :disabled="disabled"
      @click="emit('confirm')"
    />
  </div>
</template>
