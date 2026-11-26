<script setup lang="ts">
  /**
   * Purpose
   * Render the modal footer part of the ESA interface.
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
  import { ACTION_ICONS } from '~/utils/icons'

  // Call withDefaults to run this step.
  withDefaults(
    defineProps<{
      confirmLabel?: string
      cancelLabel?: string
      confirmColor?: 'primary' | 'error'
      disabled?: boolean
      /** Inside a UForm, Confirm must submit the form rather than emit. */
      submit?: boolean
    }>(),
    { confirmLabel: 'Confirm', cancelLabel: 'Cancel', confirmColor: 'primary' }
  )

  // Use defineEmits to initialize emit.
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
