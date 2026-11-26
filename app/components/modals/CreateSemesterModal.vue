<script setup lang="ts">
  /**
   * Purpose
   * Render the create semester modal part of the ESA interface.
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
  import { z } from 'zod'
  import type { FormSubmitEvent } from '@nuxt/ui'
  import type { SemesterCreate } from '#server/services/semesterService'

  // Use defineEmits to initialize emit.
  const emit = defineEmits<{ close: [semester: SemesterCreate | null] }>()

  // Define seasons for the steps below.
  const seasons = [
    { label: 'Spring', value: 'SPRING' },
    { label: 'Summer', value: 'SUMMER' },
    { label: 'Fall', value: 'FALL' },
  ]

  // Use z.object to initialize schema.
  const schema = z.object({
    season: z.enum(['SPRING', 'SUMMER', 'FALL']),
    year: z.number().int().min(2000).max(2100),
  })

  // Use reactive to initialize state.
  const state = reactive({
    season: 'FALL' as 'SPRING' | 'SUMMER' | 'FALL',
    year: new Date().getFullYear(),
  })

  // Define the helper that will on submit.
  function onSubmit(event: FormSubmitEvent<z.infer<typeof schema>>) {
    // Call emit to run this step.
    emit('close', event.data)
  }
</script>

<template>
  <UModal title="Add Semester" @close="emit('close', null)">
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField label="Season" name="season">
          <URadioGroup v-model="state.season" orientation="horizontal" :items="seasons" />
        </UFormField>

        <UFormField label="Year" name="year">
          <UInputNumber v-model="state.year" class="w-full" />
        </UFormField>

        <ModalFooter submit @cancel="emit('close', null)" />
      </UForm>
    </template>
  </UModal>
</template>
