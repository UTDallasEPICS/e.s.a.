<script setup lang="ts">
  /**
   * Purpose
   * Render the confirmation modal part of the ESA interface.
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
  import ModalFooter from '~/components/modals/ModalFooter.vue'
  import type { ConfirmOptions } from '~/composables/useConfirm'

  // Use defineProps to initialize props.
  const props = defineProps<ConfirmOptions>()
  // Use defineEmits to initialize emit.
  const emit = defineEmits<{ close: [confirmed: boolean] }>()
</script>

<template>
  <UModal :title="props.title" :description="props.description" @close="emit('close', false)">
    <template #body>
      <ul v-if="props.affected?.length" class="list-inside list-disc space-y-1 text-sm">
        <li v-for="item in props.affected" :key="item.label">
          {{ item.count }} {{ item.label }}{{ item.count === 1 ? '' : 's' }}
        </li>
      </ul>
    </template>

    <template #footer>
      <ModalFooter
        :confirm-label="props.confirmLabel"
        confirm-color="error"
        @cancel="emit('close', false)"
        @confirm="emit('close', true)"
      />
    </template>
  </UModal>
</template>
