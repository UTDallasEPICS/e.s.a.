<script setup lang="ts">
  /**
   * Purpose
   * Render the semester filter part of the ESA interface.
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
  import CreateSemesterModal from '~/components/modals/CreateSemesterModal.vue'
  import { ACTION_ICONS } from '~/utils/icons'
  import { errorMessage } from '~/utils/errors'
  import { formatSemester } from '~/utils/labels'

  // Fully controlled rather than `defineModel`: the Database page may refuse a change when a tab
  // holds staged work, and a local model value would leave the dropdown showing a semester the page
  // never adopted. Every change leaves through the emit and comes back as a prop, or not at all.
  const props = defineProps<{ modelValue?: string }>()
  // Use defineEmits to initialize emit.
  const emit = defineEmits<{ 'update:modelValue': [value: string | undefined] }>()

  // Use useSemesters to initialize { semesters, createSemester, deleteSemester }.
  const { semesters, createSemester, deleteSemester } = useSemesters()
  // Use useSemesterLookup to initialize { semesterOptions }.
  const { semesterOptions } = useSemesterLookup()

  // If the selected semester gets deleted elsewhere (e.g. another mounted
  // SemesterFilter instance), drop the now-dangling selection here too.
  watch(semesters, (list) => {
    // Check whether props.modelValue && !list.some((s) => s.id === props.modelValue) before running this branch.
    if (props.modelValue && !list.some((s) => s.id === props.modelValue)) {
      // Call emit to run this step.
      emit('update:modelValue', undefined)
    }
  })

  // Recalculate selectedSemester when the values it reads change.
  const selectedSemester = computed(() => semesters.value.find((s) => s.id === props.modelValue))

  // Use useOverlay to initialize overlay.
  const overlay = useOverlay()
  // Use overlay.create to initialize createModal.
  const createModal = overlay.create(CreateSemesterModal)

  // Define the helper that will open create modal.
  async function openCreateModal() {
    // Define semester for the steps below.
    const semester = await createModal.open().result
    // Check whether semester before running this branch.
    if (semester) {
      await createSemester(semester)
    }
  }

  // Use useConfirm to initialize confirm.
  const confirm = useConfirm()
  // Use useToast to initialize toast.
  const toast = useToast()

  // Define the helper that will on delete click.
  async function onDeleteClick() {
    // Define semester for the steps below.
    const semester = selectedSemester.value
    // Check whether !semester before running this branch.
    if (!semester) return

    // Define ok for the steps below.
    const ok = await confirm({
      title: `Delete ${formatSemester(semester)}?`,
      description: 'This cannot be undone.',
    })
    // Check whether !ok before running this branch.
    if (!ok) return

    try {
      await deleteSemester(semester.id)
      // Call emit to run this step.
      emit('update:modelValue', undefined)
    } catch (e: any) {
      // Call toast.add to run this step.
      toast.add({
        title: 'Could not delete semester',
        description: errorMessage(e, 'Unknown error.'),
        color: 'error',
      })
    }
  }
</script>

<template>
  <div class="flex items-center gap-2">
    <USelectMenu
      :model-value="props.modelValue"
      :items="semesterOptions"
      value-key="value"
      placeholder="All Semesters"
      class="w-48"
      @update:model-value="(value: any) => emit('update:modelValue', value)"
    />
    <UButton
      v-if="props.modelValue"
      :icon="ACTION_ICONS.cancel"
      color="neutral"
      variant="ghost"
      aria-label="Clear semester filter"
      @click="emit('update:modelValue', undefined)"
    />
    <UButton
      :icon="ACTION_ICONS.add"
      label="Add Semester"
      color="neutral"
      variant="soft"
      @click="openCreateModal"
    />
    <UButton
      :icon="ACTION_ICONS.delete"
      label="Delete Semester"
      color="error"
      variant="soft"
      aria-label="Delete semester"
      :disabled="!props.modelValue"
      @click="onDeleteClick"
    />
  </div>
</template>
