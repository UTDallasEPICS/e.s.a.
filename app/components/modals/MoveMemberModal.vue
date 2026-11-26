<script setup lang="ts">
  /**
   * Purpose
   * Render the move member modal part of the ESA interface.
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
  import type { SelectOption } from '~/utils/options'

  // Use defineProps to initialize props.
  const props = defineProps<{
    /** The project's other teams; empty when there is nowhere to move to. */
    teams: SelectOption[]
  }>()

  // Use defineEmits to initialize emit.
  const emit = defineEmits<{ close: [teamId: string | null] }>()

  // Store destination as state so Vue reacts when it changes.
  const destination = ref<string | undefined>()
</script>

<template>
  <UModal title="Move Student" @close="emit('close', null)">
    <template #body>
      <div class="space-y-4">
        <UFormField label="Destination Team">
          <USelectMenu
            v-model="destination"
            :items="props.teams"
            value-key="value"
            placeholder="Select a team…"
            class="w-full"
          />
        </UFormField>
        <p v-if="!props.teams.length" class="text-sm text-gray-500">
          This project has no other team to move to.
        </p>
        <ModalFooter
          :disabled="!destination"
          @cancel="emit('close', null)"
          @confirm="emit('close', destination ?? null)"
        />
      </div>
    </template>
  </UModal>
</template>
