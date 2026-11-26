<script setup lang="ts">
  /**
   * Purpose
   * Render the project picker modal part of the ESA interface.
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
  import type { ProjectRead } from '#server/services/projectService'
  import { projectLabel } from '~/utils/labels'
  import { searchProjects } from '~/utils/search'

  // Use defineProps to initialize props.
  const props = defineProps<{
    title: string
    /** Already narrowed by the caller to the semester's projects, minus any already taken. */
    projects: ProjectRead[]
  }>()

  // Use defineEmits to initialize emit.
  const emit = defineEmits<{ close: [project: ProjectRead | null] }>()

  // Store picked as state so Vue reacts when it changes.
  const picked = ref<ProjectRead | undefined>()

  // Define the helper that will search.
  async function search(query: string) {
    // Pass searchProjects(props.projects, query) back to the caller.
    return searchProjects(props.projects, query)
  }
</script>

<template>
  <UModal :title="props.title" @close="emit('close', null)">
    <template #body>
      <div class="space-y-4">
        <RecordSearchInput
          v-model="picked"
          :search="search"
          :display-label="projectLabel"
          placeholder="Search by project or partner name…"
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
