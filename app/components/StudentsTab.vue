<script setup lang="ts">
  /**
   * Purpose
   * Render the students tab part of the ESA interface.
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
  import type { DataTableColumn } from '~/components/DataTable.vue'
  import { ACTION_ICONS } from '~/utils/icons'
  import { textColumn } from '~/utils/columns'
  import { ENROLLMENT_FIELDS, MENTOR_FILTER_OPTIONS } from '~/utils/options'
  import type { StudentRead } from '#server/services/studentService'

  // Use useSemesterFilter to initialize { semesterId, guard }.
  const { semesterId, guard } = useSemesterFilter()
  // Use useRecordModals to initialize { openSemesterInfoModal }.
  const { openSemesterInfoModal } = useRecordModals()

  // Use useStagedChanges to initialize staging.
  const staging = useStagedChanges()
  // Call guard to run this step.
  guard(staging)

  // Use useFetch to initialize { data: students, refresh, status, }.
  const {
    data: students,
    refresh,
    status,
  } = useFetch<StudentRead[]>('/api/students', {
    key: 'students',
    query: computed(() => ({ semesterId: semesterId.value })),
    default: () => [],
  })

  // Registers every student's enrollments, memberships, and choices, so StudentSemesterCard and
  // useSemesterCards never have to look up the fetched original themselves.
  watch(
    students,
    (list) => {
      // Repeat the following steps for each item in list.
      for (const student of list) {
        // Call staging.children.register to run this step.
        staging.children.register(student.id, 'Enrollments', student.Enrollments ?? [], (e) => e.id)
        // Call staging.children.register to run this step.
        staging.children.register(student.id, 'Memberships', student.Memberships ?? [], (m) => m.id)
        // Call staging.children.register to run this step.
        staging.children.register(student.id, 'Choices', student.Choices ?? [], (c) => c.id)
      }
    },
    { immediate: true }
  )

  // Every semester's projects, so a card can offer the teams of whichever semester it belongs to.
  const { data: allProjects } = useAllProjects()

  // Use useSemesterLookup to initialize { semesters, semesterLabel, semesterSortKey, semesterOptions }.
  const { semesters, semesterLabel, semesterSortKey, semesterOptions } = useSemesterLookup()
  // Use useSemesterCards to initialize { cardsFor, choiceEntries, teamIn }.
  const { cardsFor, choiceEntries, teamIn } = useSemesterCards({
    staging,
    projects: allProjects,
    semesterLabel,
    semesterSortKey,
  })

  // ------------------------------------------------------------------- table

  const rows = computed<StudentRow[]>(() =>
    students.value.map((student) => {
      // Define enrollment for the steps below.
      const enrollment = semesterId.value
        ? student.Enrollments.find((e) => e.semesterId === semesterId.value)
        : undefined
      // Pass { ...student, meetingDay: enrollment?.meetingDay ?? null, gender: enrollment?.gender ?? null, major: back to the caller.
      return {
        ...student,
        meetingDay: enrollment?.meetingDay ?? null,
        gender: enrollment?.gender ?? null,
        major: enrollment?.major ?? null,
        year: enrollment?.year ?? null,
        class: enrollment?.class ?? null,
      }
    })
  )

  /**
   * Points a semester column at the selected semester's enrollment. Returning undefined — a student
   * who only mentors that semester — leaves the cell read-only; no enrollment is invented (§3.2.1).
   */
  function enrollmentTarget(field: string) {
    // Pass (row: StudentRow) => { const enrollment = row.Enrollments?.find((e) => e.semesterId === semesterId.v back to the caller.
    return (row: StudentRow) => {
      // Use row.Enrollments?.find to initialize enrollment.
      const enrollment = row.Enrollments?.find((e) => e.semesterId === semesterId.value)
      // Pass enrollment ? { collection: 'Enrollments', id: enrollment.id, field } : undefined back to the caller.
      return enrollment ? { collection: 'Enrollments', id: enrollment.id, field } : undefined
    }
  }

  // Recalculate columns when the values it reads change.
  const columns = computed<DataTableColumn<StudentRow>[]>(() => {
    // Define base for the steps below.
    const base: DataTableColumn<StudentRow>[] = [
      textColumn<StudentRow>('netID', 'NetID', { required: true }),
      textColumn<StudentRow>('firstName', 'First Name', { required: true }),
      textColumn<StudentRow>('lastName', 'Last Name', { required: true }),
      textColumn<StudentRow>('email', 'Email'),
      textColumn<StudentRow>('discord', 'Discord'),
      {
        id: 'isMentor',
        header: 'Is Mentor?',
        accessorKey: 'isMentor',
        sortable: true,
        filter: { type: 'multiselect', options: MENTOR_FILTER_OPTIONS },
        editable: { type: 'switch' },
      },
    ]
    // Check whether !semesterId.value before running this branch.
    if (!semesterId.value) return base
    // Repeat the following steps for each item in ENROLLMENT_FIELDS.
    for (const { field, label, options } of ENROLLMENT_FIELDS) {
      // Call base.push to run this step.
      base.push({
        id: field,
        header: label,
        accessorKey: field,
        sortable: true,
        editable: options
          ? { type: 'select', options: [...options], child: enrollmentTarget(field) }
          : { type: 'text', child: enrollmentTarget(field) },
      })
    }
    // Pass base back to the caller.
    return base
  })

  // Define the helper that will new student row.
  function newStudentRow() {
    // Pass { id: '', netID: '', firstName: '', lastName: '', email: '', discord: '', isMentor: false, Enrollmen back to the caller.
    return {
      id: '',
      netID: '',
      firstName: '',
      lastName: '',
      email: '',
      discord: '',
      isMentor: false,
      Enrollments: [],
      Memberships: [],
      Choices: [],
    }
  }

  // --------------------------------------------------------------- expansion

  function accordionItems(row: StudentRow, rowId: string) {
    // Pass cardsFor(row, rowId) .filter((card) => !semesterId.value || card.semesterId === semesterId.value) .m back to the caller.
    return cardsFor(row, rowId)
      .filter((card) => !semesterId.value || card.semesterId === semesterId.value)
      .map((card) => ({
        label: card.label,
        value: card.key,
        class: STAGE_TINTS[card.state],
        card,
        choices: card.role === 'Student' ? choiceEntries(row, rowId, card.semesterId) : [],
      }))
  }

  // Define the helper that will add semester info.
  async function addSemesterInfo(row: StudentRow, rowId: string) {
    // Define taken for the steps below.
    const taken = { STUDENT: [] as string[], MENTOR: [] as string[] }
    // Repeat the following steps for each item in cardsFor(row, rowId).
    for (const card of cardsFor(row, rowId)) {
      // Call taken[card.role === 'Mentor' ? 'MENTOR' : 'STUDENT'].push to run this step.
      taken[card.role === 'Mentor' ? 'MENTOR' : 'STUDENT'].push(card.semesterId)
    }

    // Define draft for the steps below.
    const draft = await openSemesterInfoModal({
      isMentor: !!row.isMentor,
      semesters: semesterOptions.value,
      taken,
      projects: allProjects.value,
    })
    // Check whether !draft before running this branch.
    if (!draft) return

    // Define isMentor for the steps below.
    const isMentor = !!row.isMentor && draft.role === 'MENTOR'
    // Define teamId for the steps below.
    const teamId = draft.project ? teamIn(draft.project, draft.semesterId)?.id : undefined

    // Check whether isMentor before running this branch.
    if (isMentor) {
      // Left unassigned the card still stages, and its membership is only sent once a team is set.
      staging.children.add(rowId, 'Memberships', {
        semesterId: draft.semesterId,
        teamId,
        isMentor: true,
      })
      return
    }
    // Call staging.children.add to run this step.
    staging.children.add(rowId, 'Enrollments', {
      semesterId: draft.semesterId,
      meetingDay: draft.meetingDay,
      major: draft.major,
      year: draft.year,
      class: draft.class,
      gender: draft.gender,
    })
    // Check whether teamId before running this branch.
    if (teamId) {
      // Call staging.children.add to run this step.
      staging.children.add(rowId, 'Memberships', {
        semesterId: draft.semesterId,
        teamId,
        isMentor: false,
      })
    }
  }

  // ---------------------------------------------------------------- saving

  function pickEnrollment(fields: Record<string, any>) {
    // Pass { semesterId: fields.semesterId, meetingDay: fields.meetingDay, major: fields.major, year: fields.ye back to the caller.
    return {
      semesterId: fields.semesterId,
      meetingDay: fields.meetingDay,
      major: fields.major,
      year: fields.year,
      class: fields.class,
      gender: fields.gender,
      skills: fields.skills,
      comments: fields.comments,
    }
  }

  /** New choices are renumbered 1..n per semester so the rank uniqueness constraint holds. */
  function nestedChoices(children: ChildStage[]) {
    // Define bySemester for the steps below.
    const bySemester = new Map<string, ChildStage[]>()
    // Repeat the following steps for each item in children.
    for (const child of children) {
      // Check whether child.deleted before running this branch.
      if (child.deleted) continue
      // Define list for the steps below.
      const list = bySemester.get(child.fields.semesterId) ?? []
      // Call list.push to run this step.
      list.push(child)
      // Call bySemester.set to run this step.
      bySemester.set(child.fields.semesterId, list)
    }
    // Define choices for the steps below.
    const choices: { semesterId: string; projectId: string; rank: number }[] = []
    // Repeat the following steps for each item in bySemester.
    for (const [semesterId, list] of bySemester) {
      // Call list.sort to run this step.
      list.sort((a, b) => a.fields.rank - b.fields.rank || b.fields.baseRank - a.fields.baseRank)
      // Call list.forEach to run this step.
      list.forEach((child, index) => {
        // Call choices.push to run this step.
        choices.push({ semesterId, projectId: child.fields.projectId, rank: index + 1 })
      })
    }
    // Pass choices back to the caller.
    return choices
  }

  // Define the helper that will create student.
  async function createStudent(record: StagedRecord) {
    // Define fields for the steps below.
    const fields = record.fields
    // Use (record.children.Enrollments ?? []) .filter((child) => !child.deleted) .map to initialize enrollments.
    const enrollments = (record.children.Enrollments ?? [])
      .filter((child) => !child.deleted)
      .map((child) => pickEnrollment(child.fields))
    // Use (record.children.Memberships ?? []) .filter((child) => !child.deleted && child.fields.teamId) .map to initialize memberships.
    const memberships = (record.children.Memberships ?? [])
      .filter((child) => !child.deleted && child.fields.teamId)
      .map((child) => ({ teamId: child.fields.teamId, isMentor: !!child.fields.isMentor }))
    // Use nestedChoices to initialize choices.
    const choices = nestedChoices(record.children.Choices ?? [])

    await $fetch('/api/students', {
      method: 'POST',
      body: {
        netID: fields.netID,
        firstName: fields.firstName,
        lastName: fields.lastName,
        email: fields.email || undefined,
        discord: fields.discord || undefined,
        isMentor: !!fields.isMentor,
        Enrollments: enrollments.length ? enrollments : undefined,
        Memberships: memberships.length ? memberships : undefined,
        Choices: choices.length ? choices : undefined,
      },
    })
  }

  // Define the helper that will update student.
  async function updateStudent(record: StagedRecord) {
    // Define id for the steps below.
    const id = record.id
    // Define fields for the steps below.
    const fields = record.fields

    // Define body for the steps below.
    const body: Record<string, any> = {}
    // Repeat the following steps for each item in ['netID', 'firstName', 'lastName', 'isMentor'] as const.
    for (const key of ['netID', 'firstName', 'lastName', 'isMentor'] as const) {
      // Check whether key in fields before running this branch.
      if (key in fields) body[key] = fields[key]
    }
    // Repeat the following steps for each item in ['email', 'discord'] as const.
    for (const key of ['email', 'discord'] as const) {
      // Check whether key in fields before running this branch.
      if (key in fields) body[key] = fields[key] === '' ? null : fields[key]
    }
    // Check whether Object.keys(body).length before running this branch.
    if (Object.keys(body).length) {
      await $fetch(`/api/students/${id}`, { method: 'PUT', body })
    }

    // Deletions run before creations for both enrollments and memberships: a semester's enrollment
    // and a team's membership are unique per student, so re-adding one has to wait for the old row.
    const enrollments = record.children.Enrollments ?? []
    // Repeat the following steps for each item in enrollments.
    for (const child of enrollments) {
      // Check whether child.deleted before running this branch.
      if (child.deleted) await $fetch(`/api/enrollments/${child.id}`, { method: 'DELETE' })
    }
    // Repeat the following steps for each item in enrollments.
    for (const child of enrollments) {
      // Check whether child.deleted before running this branch.
      if (child.deleted) continue
      // Check whether child.isNew before running this branch.
      if (child.isNew) {
        await $fetch('/api/enrollments', {
          method: 'POST',
          body: { studentId: id, ...pickEnrollment(child.fields) },
        })
      } else if (Object.keys(child.fields).length) {
        await $fetch(`/api/enrollments/${child.id}`, { method: 'PUT', body: child.fields })
      }
    }

    // Define memberships for the steps below.
    const memberships = record.children.Memberships ?? []
    // Repeat the following steps for each item in memberships.
    for (const child of memberships) {
      // Check whether child.deleted before running this branch.
      if (child.deleted) await $fetch(`/api/memberships/${child.id}`, { method: 'DELETE' })
    }
    // Repeat the following steps for each item in memberships.
    for (const child of memberships) {
      // Check whether child.deleted || !child.isNew || !child.fields.teamId before running this branch.
      if (child.deleted || !child.isNew || !child.fields.teamId) continue
      await $fetch('/api/memberships', {
        method: 'POST',
        body: {
          studentId: id,
          teamId: child.fields.teamId,
          isMentor: !!child.fields.isMentor,
        },
      })
    }

    // Choices are created at the end of their semester's list and then moved, because only the
    // update endpoint shifts the siblings out of the way of a rank.
    const choices = record.children.Choices ?? []
    // Use students.value.find to initialize fetched.
    const fetched = students.value.find((student) => student.id === id)
    // Define lastRank for the steps below.
    const lastRank = new Map<string, number>()
    // Repeat the following steps for each item in fetched?.Choices ?? [].
    for (const choice of fetched?.Choices ?? []) {
      // Call lastRank.set to run this step.
      lastRank.set(choice.semesterId, Math.max(lastRank.get(choice.semesterId) ?? 0, choice.rank))
    }
    // Use choices .filter((child) => child.isNew && !child.deleted) .sort to initialize added.
    const added = choices
      .filter((child) => child.isNew && !child.deleted)
      .sort((a, b) => a.fields.rank - b.fields.rank || b.fields.baseRank - a.fields.baseRank)
    // Repeat the following steps for each item in added.
    for (const child of added) {
      // Define childSemesterId for the steps below.
      const childSemesterId = child.fields.semesterId
      // Define appended for the steps below.
      const appended = (lastRank.get(childSemesterId) ?? 0) + 1
      // Call lastRank.set to run this step.
      lastRank.set(childSemesterId, appended)
      // Define created for the steps below.
      const created = await $fetch<{ id: string }>('/api/choices', {
        method: 'POST',
        body: {
          studentId: id,
          semesterId: childSemesterId,
          projectId: child.fields.projectId,
          rank: appended,
        },
      })
      // Define target for the steps below.
      const target = child.fields.rank
      // Check whether typeof target === 'number' && target >= 1 && target !== appended before running this branch.
      if (typeof target === 'number' && target >= 1 && target !== appended) {
        await $fetch(`/api/choices/${created.id}`, { method: 'PUT', body: { rank: target } })
      }
    }
    // Repeat the following steps for each item in choices.
    for (const child of choices) {
      // Check whether child.isNew || child.deleted before running this branch.
      if (child.isNew || child.deleted) continue
      // Check whether typeof child.fields.rank === 'number' before running this branch.
      if (typeof child.fields.rank === 'number') {
        await $fetch(`/api/choices/${child.id}`, {
          method: 'PUT',
          body: { rank: child.fields.rank },
        })
      }
    }
    // Repeat the following steps for each item in choices.
    for (const child of choices) {
      // Check whether child.deleted before running this branch.
      if (child.deleted) await $fetch(`/api/choices/${child.id}`, { method: 'DELETE' })
    }
  }

  // Define the helper that will delete student.
  async function deleteStudent(id: string) {
    await $fetch(`/api/students/${id}`, { method: 'DELETE' })
  }

  // Use useStagedSave to initialize { saving, onSave }.
  const { saving, onSave } = useStagedSave({
    staging,
    entity: 'student',
    cascade: 'This will also delete all associated enrollments, choices, and memberships.',
    affected: (ids) => {
      // Use students.value.filter to initialize selected.
      const selected = students.value.filter((student) => ids.includes(student.id))
      // Pass [ { label: 'Enrollment', count: selected.reduce((n, student) => n + student.Enrollments.length, 0),  back to the caller.
      return [
        {
          label: 'Enrollment',
          count: selected.reduce((n, student) => n + student.Enrollments.length, 0),
        },
        { label: 'Choice', count: selected.reduce((n, student) => n + student.Choices.length, 0) },
        {
          label: 'Membership',
          count: selected.reduce((n, student) => n + student.Memberships.length, 0),
        },
      ]
    },
    refresh,
    create: createStudent,
    update: updateStudent,
    delete: deleteStudent,
  })

  // Call provideRowStaging to run this step.
  provideRowStaging({ staging, saving })
</script>

<template>
  <DataTable
    :data="rows"
    :columns="columns"
    :row-key="(row) => row.id"
    :staging="staging"
    :loading="status === 'pending'"
    :saving="saving"
    expandable
    :new-row="newStudentRow"
    @save="onSave"
  >
    <template #expanded="{ row, rowId, deleted }">
      <div class="space-y-3 p-3">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold">Semester Info</h3>
          <UButton
            label="Add Semester Info"
            :icon="ACTION_ICONS.add"
            size="xs"
            variant="soft"
            :disabled="deleted || saving"
            @click="addSemesterInfo(row, rowId)"
          />
        </div>

        <!-- Semester set: every matching card open and non-collapsible. -->
        <template v-if="semesterId">
          <div
            v-for="item in accordionItems(row, rowId)"
            :key="item.value"
            class="rounded border border-gray-200 dark:border-gray-800"
            :class="item.class"
          >
            <div class="border-b border-gray-200 px-3 py-2 font-medium dark:border-gray-800">
              {{ item.label }}
            </div>
            <StudentSemesterCard
              :row-id="rowId"
              :row="row"
              :card="item.card"
              :choices="item.choices"
              :disabled="deleted"
            />
          </div>
        </template>

        <!-- Semester unset: every semester, collapsible, multi-open. -->
        <UAccordion v-else :items="accordionItems(row, rowId)" type="multiple">
          <template #body="{ item }">
            <StudentSemesterCard
              :row-id="rowId"
              :row="row"
              :card="item.card"
              :choices="item.choices"
              :disabled="deleted"
            />
          </template>
        </UAccordion>
      </div>
    </template>
  </DataTable>
</template>
