<script setup lang="ts">
  /**
   * Purpose
   * Render the semester info modal part of the ESA interface.
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
  import {
    CLASS_OPTIONS,
    GENDER_OPTIONS,
    MEETING_DAY_OPTIONS,
    YEAR_OPTIONS,
    type SelectOption,
  } from '~/utils/options'
  import type { SemesterInfoDraft } from '~/utils/recordDrafts'

  // Use defineProps to initialize props.
  const props = defineProps<{
    /** Whether this student can hold a Mentor card at all; gates the Role radio. */
    isMentor: boolean
    semesters: SelectOption[]
    /**
     * Semesters that already carry a Student card — a student may hold only one Student card per
     * semester (one Enrollment). Mentor cards have no such limit: a mentor can lead more than one
     * project in the same semester, so `MENTOR` is not used to disable the semester picker.
     */
    taken: { STUDENT: string[]; MENTOR: string[] }
    /** Every project; narrowed to the chosen semester as the user picks one. */
    projects: ProjectRead[]
  }>()

  // Use defineEmits to initialize emit.
  const emit = defineEmits<{ close: [draft: SemesterInfoDraft | null] }>()

  // Use reactive to initialize draft.
  const draft = reactive<SemesterInfoDraft>({
    semesterId: '',
    role: 'STUDENT',
    meetingDay: 'WEDNESDAY',
    major: '',
    year: 'FRESHMAN',
    class: 'EPCS_2200',
    gender: 'OTHER',
  })

  // Recalculate takenForRole when the values it reads change.
  const takenForRole = computed(() => new Set(draft.role === 'MENTOR' ? [] : props.taken.STUDENT))

  // Recalculate semesterItems when the values it reads change.
  const semesterItems = computed(() =>
    props.semesters.map((semester) => ({
      ...semester,
      disabled: takenForRole.value.has(semester.value),
    }))
  )

  // Recalculate valid when the values it reads change.
  const valid = computed(() => !!draft.semesterId && !takenForRole.value.has(draft.semesterId))

  // A project is only assignable in the semester it has a team for, so the pick cannot outlive it.
  watch(
    () => draft.semesterId,
    () => {
      // Update draft.project with the value on the right.
      draft.project = undefined
    }
  )

  // Define the helper that will search.
  async function search(query: string) {
    // Check whether !draft.semesterId before running this branch.
    if (!draft.semesterId) return []
    // Pass searchProjects(props.projects, query, { semesterId: draft.semesterId }) back to the caller.
    return searchProjects(props.projects, query, { semesterId: draft.semesterId })
  }

  // Define the helper that will on confirm.
  function onConfirm() {
    // Check whether !valid.value before running this branch.
    if (!valid.value) return
    // Call emit to run this step.
    emit('close', { ...draft })
  }
</script>

<template>
  <UModal title="Add Semester Info" @close="emit('close', null)">
    <template #body>
      <div class="space-y-4">
        <UFormField label="Semester">
          <USelectMenu
            v-model="draft.semesterId"
            :items="semesterItems"
            value-key="value"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Meeting Day">
          <USelectMenu
            v-model="draft.meetingDay"
            :items="MEETING_DAY_OPTIONS"
            value-key="value"
            class="w-full"
          />
        </UFormField>
        <UFormField v-if="props.isMentor" label="Role">
          <URadioGroup
            v-model="draft.role"
            orientation="horizontal"
            :items="[
              { label: 'Student', value: 'STUDENT' },
              { label: 'Mentor', value: 'MENTOR' },
            ]"
          />
        </UFormField>

        <template v-if="draft.role === 'STUDENT'">
          <UFormField label="Major">
            <UInput v-model="draft.major" class="w-full" />
          </UFormField>
          <UFormField label="Year">
            <USelectMenu
              v-model="draft.year"
              :items="YEAR_OPTIONS"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Class">
            <USelectMenu
              v-model="draft.class"
              :items="CLASS_OPTIONS"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Gender">
            <USelectMenu
              v-model="draft.gender"
              :items="GENDER_OPTIONS"
              value-key="value"
              class="w-full"
            />
          </UFormField>
        </template>

        <UFormField label="Team" hint="Optional">
          <RecordSearchInput
            v-model="draft.project"
            :search="search"
            :display-label="projectLabel"
            placeholder="Search by project or partner name…"
          />
        </UFormField>

        <ModalFooter :disabled="!valid" @cancel="emit('close', null)" @confirm="onConfirm" />
      </div>
    </template>
  </UModal>
</template>
