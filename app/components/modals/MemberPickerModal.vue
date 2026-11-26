<script setup lang="ts">
  /**
   * Purpose
   * Render the member picker modal part of the ESA interface.
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
  import type { StudentRead } from '#server/services/studentService'
  import { studentLabel } from '~/utils/labels'
  import { searchStudents } from '~/utils/search'

  // Use defineProps to initialize props.
  const props = defineProps<{
    title: string
    /** Already narrowed by the caller to students not on the team (§3.1.5). */
    students: StudentRead[]
  }>()

  // Use defineEmits to initialize emit.
  const emit = defineEmits<{ close: [student: StudentRead | null] }>()

  // Store picked as state so Vue reacts when it changes.
  const picked = ref<StudentRead | undefined>()

  // Define the helper that will search.
  async function search(query: string) {
    // Pass searchStudents(props.students, query) back to the caller.
    return searchStudents(props.students, query)
  }
</script>

<template>
  <UModal :title="props.title" @close="emit('close', null)">
    <template #body>
      <div class="space-y-4">
        <RecordSearchInput
          v-model="picked"
          :search="search"
          :display-label="studentLabel"
          placeholder="Search by name or netID…"
        />
        <ModalFooter
          :disabled="!picked"
          @cancel="emit('close', null)"
          @confirm="emit('close', picked ?? null)"
        />
      </div>
    </template>
  </UModal>
</template>
