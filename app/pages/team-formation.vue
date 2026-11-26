<script setup lang="ts">
  /**
   * Purpose
   * Render the team formation part of the ESA interface.
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
  import { parseCsv, validateBidRows, type BidRowError } from '~/utils/bidCsv'
  import { downloadCsv } from '~/utils/csvExport'
  import { titleCase } from '~/utils/labels'
  import { MEETING_DAY_OPTIONS } from '~/utils/options'
  import type { ProjectRead } from '#server/services/projectService'
  import type { StudentRead } from '#server/services/studentService'

  type MeetingDay = 'WEDNESDAY' | 'THURSDAY'

  // ── Semester & meeting day ───────────────────────────────────────────────────

  const semesterId = ref<string | undefined>()
  // Store meetingDay as state so Vue reacts when it changes.
  const meetingDay = ref<MeetingDay>('WEDNESDAY')

  // Use useSemesters to initialize { semesters }.
  const { semesters } = useSemesters()
  // Recalculate selectedSemesterLabel when the values it reads change.
  const selectedSemesterLabel = computed(() => {
    // Use semesters.value.find to initialize semester.
    const semester = semesters.value.find((s) => s.id === semesterId.value)
    // Check whether !semester before running this branch.
    if (!semester) return 'semester'
    // Define season for the steps below.
    const season = semester.season[0] + semester.season.slice(1).toLowerCase()
    // Pass `${season}-${semester.year}` back to the caller.
    return `${season}-${semester.year}`
  })

  // Use useFetch to initialize { data: projectsForSemester, status: projectsStatus, refresh: refreshProjectsForSemester, }.
  const {
    data: projectsForSemester,
    status: projectsStatus,
    refresh: refreshProjectsForSemester,
  } = useFetch<ProjectRead[]>('/api/projects', {
    query: computed(() => ({ semesterId: semesterId.value })),
    watch: [semesterId],
    default: () => [],
  })

  // Recalculate teamsForDay when the values it reads change.
  const teamsForDay = computed(() =>
    projectsForSemester.value.flatMap((project) =>
      project.Teams.filter(
        (t) => t.semesterId === semesterId.value && t.meetingDay === meetingDay.value
      ).map((team) => ({
        id: team.id,
        projectName: project.name,
        partnerName: project.Partner.name,
        memberCount: team.Memberships.length,
      }))
    )
  )

  // Use useFetch to initialize { data: studentsForSemester, refresh: refreshStudentsForSemester }.
  const { data: studentsForSemester, refresh: refreshStudentsForSemester } = useFetch<
    StudentRead[]
  >('/api/students', {
    query: computed(() => ({ semesterId: semesterId.value })),
    watch: [semesterId],
    default: () => [],
  })

  // Use useFetch to initialize { data: allProjects, refresh: refreshAllProjects }.
  const { data: allProjects, refresh: refreshAllProjects } = useFetch<ProjectRead[]>(
    '/api/projects',
    {
      default: () => [],
    }
  )

  // Recalculate canExport when the values it reads change.
  const canExport = computed(() => !!semesterId.value && !!meetingDay.value)

  // Define the helper that will season code.
  function seasonCode(season: string) {
    // Check whether season === 'SPRING' before running this branch.
    if (season === 'SPRING') return 'S'
    // Check whether season === 'SUMMER' before running this branch.
    if (season === 'SUMMER') return 'U'
    // Check whether season === 'FALL' before running this branch.
    if (season === 'FALL') return 'F'
    // Pass season[0] back to the caller.
    return season[0]
  }

  // Define CHOICE_COLUMN_COUNT for the steps below.
  const CHOICE_COLUMN_COUNT = 6

  // Define the helper that will export teams.
  function exportTeams() {
    // Use semesters.value.find to initialize semester.
    const semester = semesters.value.find((s) => s.id === semesterId.value)
    // Check whether !semester before running this branch.
    if (!semester) return

    // Define term for the steps below.
    const term = `${seasonCode(semester.season)}${String(semester.year).slice(-2)}`
    // Define projectLabelById for the steps below.
    const projectLabelById = new Map(
      allProjects.value.map((p) => [p.id, `${term} - ${p.Partner.name}: ${p.name}`])
    )
    // Define studentById for the steps below.
    const studentById = new Map(studentsForSemester.value.map((s) => [s.id, s]))

    // Define rows for the steps below.
    const rows: string[][] = [
      [
        'Team',
        'Student',
        ...Array.from({ length: CHOICE_COLUMN_COUNT }, (_, i) => `Choice ${i + 1}`),
        'Student Major',
        'Student Classification',
        'Gender',
        'Skills',
        'Comments',
      ],
    ]

    // Repeat the following steps for each item in projectsForSemester.value.
    for (const project of projectsForSemester.value) {
      // Define teamLabel for the steps below.
      const teamLabel =
        projectLabelById.get(project.id) ?? `${term} - ${project.Partner.name}: ${project.name}`

      // Repeat the following steps for each item in project.Teams.
      for (const team of project.Teams) {
        // Check whether team.meetingDay !== meetingDay.value before running this branch.
        if (team.meetingDay !== meetingDay.value) continue

        // Repeat the following steps for each item in team.Memberships.
        for (const membership of team.Memberships) {
          // Use studentById.get to initialize student.
          const student = studentById.get(membership.studentId)
          // Use student?.Enrollments.find to initialize enrollment.
          const enrollment = student?.Enrollments.find((e) => e.semesterId === semesterId.value)

          // Use (student?.Choices ?? []) .filter((c) => c.semesterId === semesterId.value) .sort((a, b) => a.rank -  to initialize choices.
          const choices = (student?.Choices ?? [])
            .filter((c) => c.semesterId === semesterId.value)
            .sort((a, b) => a.rank - b.rank)
            .map((c) => projectLabelById.get(c.projectId) ?? '')
          // Use Array.from to initialize choiceCells.
          const choiceCells = Array.from(
            { length: CHOICE_COLUMN_COUNT },
            (_, i) => choices[i] ?? ''
          )

          // Call rows.push to run this step.
          rows.push([
            teamLabel,
            `${membership.Student.lastName}, ${membership.Student.firstName}`,
            ...choiceCells,
            enrollment?.major ?? '',
            enrollment ? titleCase(enrollment.year) : '',
            enrollment ? titleCase(enrollment.gender) : '',
            enrollment?.skills.join('; ') ?? '',
            enrollment?.comments ?? '',
          ])
        }
      }
    }

    // Define dayLabel for the steps below.
    const dayLabel = meetingDay.value === 'WEDNESDAY' ? 'Wed' : 'Thu'
    // Call downloadCsv to run this step.
    downloadCsv(`${dayLabel} Teams - ${selectedSemesterLabel.value}.csv`, rows)
  }

  // ── Bid file upload ──────────────────────────────────────────────────────────

  const bidFile = ref<File | null>(null)
  // Store parsedRows as state so Vue reacts when it changes.
  const parsedRows = ref<Record<string, string>[]>([])
  // Store parseErrors as state so Vue reacts when it changes.
  const parseErrors = ref<BidRowError[]>([])
  // Store missingColumns as state so Vue reacts when it changes.
  const missingColumns = ref<string[]>([])
  // Store uploadResult as state so Vue reacts when it changes.
  const uploadResult = ref<{
    studentsImported: number
    choicesCreated: number
    skippedStudents: string[]
  } | null>(null)
  // Store uploading as state so Vue reacts when it changes.
  const uploading = ref(false)
  // Store uploadError as state so Vue reacts when it changes.
  const uploadError = ref<string | null>(null)

  // Run the callback when the watched values change.
  watch(bidFile, async (file) => {
    // Update parsedRows.value with the value on the right.
    parsedRows.value = []
    // Update parseErrors.value with the value on the right.
    parseErrors.value = []
    // Update missingColumns.value with the value on the right.
    missingColumns.value = []
    // Check whether !file before running this branch.
    if (!file) return

    // Only clear prior results once a new file is actually chosen, so a successful
    // upload's summary stays visible after we reset `bidFile` below.
    uploadResult.value = null
    // Update uploadError.value with the value on the right.
    uploadError.value = null

    // Define text for the steps below.
    const text = await file.text()
    // Use parseCsv to initialize rows.
    const rows = parseCsv(text)
    // Use validateBidRows to initialize validation.
    const validation = validateBidRows(rows)
    // Update missingColumns.value with the value on the right.
    missingColumns.value = validation.missingColumns
    // Update parseErrors.value with the value on the right.
    parseErrors.value = validation.errors
    // Check whether !validation.missingColumns.length && !validation.errors.length before running this branch.
    if (!validation.missingColumns.length && !validation.errors.length) {
      // Update parsedRows.value with the value on the right.
      parsedRows.value = rows
    }
  })

  // Recalculate canUpload when the values it reads change.
  const canUpload = computed(
    () =>
      !!semesterId.value &&
      parsedRows.value.length > 0 &&
      !parseErrors.value.length &&
      !missingColumns.value.length
  )

  // Define the helper that will submit bid file.
  async function submitBidFile() {
    // Check whether !canUpload.value || !semesterId.value before running this branch.
    if (!canUpload.value || !semesterId.value) return
    // Update uploading.value with the value on the right.
    uploading.value = true
    // Update uploadError.value with the value on the right.
    uploadError.value = null
    try {
      // Update uploadResult.value with the value on the right.
      uploadResult.value = await $fetch('/api/team-formation/bids', {
        method: 'POST',
        query: { semesterId: semesterId.value, meetingDay: meetingDay.value },
        body: parsedRows.value,
      })
      // Require an explicit new file selection before another upload can be submitted —
      // otherwise switching the meeting day and re-clicking Upload silently resubmits the
      // same roster under the new day, overwriting those students' enrollment day.
      bidFile.value = null
      await Promise.all([
        refreshProjectsForSemester(),
        refreshAllProjects(),
        refreshStudentsForSemester(),
      ])
    } catch (e: any) {
      // Update uploadError.value with the value on the right.
      uploadError.value = e?.data?.message ?? e?.message ?? 'Failed to import bid file.'
    } finally {
      // Update uploading.value with the value on the right.
      uploading.value = false
    }
  }

  // ── Team generation ──────────────────────────────────────────────────────────

  const config = reactive({
    min_team_size: 4,
    max_team_size: 6,
    prioritize_returning_students: true,
    prioritize_3200_first_choice: true,
    balance_gender: true,
  })

  // Store generating as state so Vue reacts when it changes.
  const generating = ref(false)
  // Store generateError as state so Vue reacts when it changes.
  const generateError = ref<string | null>(null)
  interface GenerateResponse {
    teamAssignments: Record<string, { firstName: string; lastName: string; netID: string }[]>
    projects: { id: string; name: string }[]
    teamMeta: Record<string, { projectId: string; meetingDay: MeetingDay; projectName: string }>
  }
  // Store generateResult as state so Vue reacts when it changes.
  const generateResult = ref<GenerateResponse | null>(null)

  // Recalculate canGenerate when the values it reads change.
  const canGenerate = computed(() => !!semesterId.value && teamsForDay.value.length > 0)

  // Define the helper that will generate teams.
  async function generateTeams() {
    // Check whether !canGenerate.value || !semesterId.value before running this branch.
    if (!canGenerate.value || !semesterId.value) return
    // Update generating.value with the value on the right.
    generating.value = true
    // Update generateError.value with the value on the right.
    generateError.value = null
    // Update generateResult.value with the value on the right.
    generateResult.value = null
    try {
      // Update generateResult.value with the value on the right.
      generateResult.value = await $fetch<GenerateResponse>('/api/team-formation/generate', {
        method: 'POST',
        body: { semesterId: semesterId.value, day: meetingDay.value, config },
      })
      await Promise.all([
        refreshProjectsForSemester(),
        refreshAllProjects(),
        refreshStudentsForSemester(),
      ])
    } catch (e: any) {
      // Update generateError.value with the value on the right.
      generateError.value = e?.data?.message ?? e?.message ?? 'Team generation failed.'
    } finally {
      // Update generating.value with the value on the right.
      generating.value = false
    }
  }

  // Define the helper that will students for.
  function studentsFor(teamId: string) {
    // Pass generateResult.value?.teamAssignments[teamId] ?? [] back to the caller.
    return generateResult.value?.teamAssignments[teamId] ?? []
  }
</script>

<template>
  <UContainer class="max-w-4xl space-y-10 py-8">
    <section class="space-y-4">
      <h2 class="text-lg font-semibold">1. Semester & Meeting Day</h2>

      <UFormField label="Semester">
        <SemesterFilter v-model="semesterId" />
      </UFormField>

      <UFormField label="Meeting Day">
        <URadioGroup v-model="meetingDay" orientation="horizontal" :items="MEETING_DAY_OPTIONS" />
      </UFormField>

      <UButton
        label="Export Teams"
        icon="i-heroicons-arrow-down-tray"
        color="neutral"
        variant="soft"
        :disabled="!canExport"
        @click="exportTeams"
      />

      <div v-if="semesterId" class="space-y-2">
        <h3 class="font-medium">Teams already entered for this semester/day</h3>
        <UAlert
          v-if="projectsStatus !== 'pending' && !teamsForDay.length"
          icon="i-heroicons-exclamation-triangle"
          color="warning"
          variant="subtle"
          title="No teams found"
          description="Create projects and teams for this semester/day in the Database tab before continuing."
        />
        <ul v-else class="space-y-1">
          <li
            v-for="team in teamsForDay"
            :key="team.id"
            class="flex items-center justify-between rounded border border-gray-200 p-2 text-sm dark:border-gray-800"
          >
            <span>{{ team.projectName }} — {{ team.partnerName }}</span>
            <span class="text-gray-500">{{ team.memberCount }} member(s)</span>
          </li>
        </ul>
      </div>
    </section>

    <USeparator />

    <section class="space-y-4">
      <h2 class="text-lg font-semibold">2. Bid File</h2>

      <UFormField label="Bid Response CSV">
        <UFileUpload
          v-model="bidFile"
          accept=".csv"
          label="Drop CSV here or click to browse"
          :disabled="!semesterId"
        />
      </UFormField>
      <p v-if="!semesterId" class="text-sm text-gray-500">Select a semester above first.</p>

      <UAlert
        v-if="missingColumns.length"
        color="error"
        variant="subtle"
        title="Missing required columns"
        :description="missingColumns.join(', ')"
      />

      <div v-else-if="parseErrors.length" class="space-y-2">
        <UAlert
          color="error"
          variant="subtle"
          :title="`${parseErrors.length} error(s) found — upload aborted`"
        />
        <ul class="max-h-64 space-y-1 overflow-y-auto text-sm">
          <li v-for="(err, i) in parseErrors" :key="i" class="text-red-600 dark:text-red-400">
            Row {{ err.row }}: {{ err.message }}
          </li>
        </ul>
      </div>

      <UAlert
        v-else-if="parsedRows.length"
        color="success"
        variant="subtle"
        :title="`${parsedRows.length} row(s) validated successfully`"
      />

      <UButton
        label="Upload"
        icon="i-heroicons-arrow-up-tray"
        :loading="uploading"
        :disabled="!canUpload || uploading"
        @click="submitBidFile"
      />

      <UAlert
        v-if="uploadError"
        color="error"
        variant="subtle"
        title="Upload failed"
        :description="uploadError"
      />

      <div v-if="uploadResult" class="space-y-2">
        <UAlert
          color="success"
          variant="subtle"
          title="Import complete"
          :description="`${uploadResult.studentsImported} student(s) imported, ${uploadResult.choicesCreated} choice(s) recorded.`"
        />
        <UAlert
          v-if="uploadResult.skippedStudents.length"
          color="warning"
          variant="subtle"
          title="Skipped rows (missing SSO ID)"
          :description="uploadResult.skippedStudents.join(', ')"
        />
      </div>
    </section>

    <USeparator />

    <section class="space-y-4">
      <h2 class="text-lg font-semibold">3. Team Generation</h2>

      <div class="grid grid-cols-2 gap-4">
        <UFormField label="Min Team Size">
          <UInputNumber v-model="config.min_team_size" :min="1" class="w-full" />
        </UFormField>
        <UFormField label="Max Team Size">
          <UInputNumber v-model="config.max_team_size" :min="config.min_team_size" class="w-full" />
        </UFormField>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <UCheckbox
          v-model="config.prioritize_returning_students"
          label="Prioritize returning students"
        />
        <UCheckbox
          v-model="config.prioritize_3200_first_choice"
          label="Prioritize 3200 first choice"
        />
        <UCheckbox v-model="config.balance_gender" label="Balance gender" />
      </div>

      <UButton
        label="Generate Teams"
        icon="i-heroicons-sparkles"
        :loading="generating"
        :disabled="!canGenerate || generating"
        @click="generateTeams"
      />
      <p v-if="!canGenerate" class="text-sm text-gray-500">
        Select a semester/day with at least one team above first.
      </p>

      <UAlert
        v-if="generateError"
        color="error"
        variant="subtle"
        title="Team generation failed"
        :description="generateError"
      />

      <div v-if="generateResult" class="space-y-4">
        <UAlert color="success" variant="subtle" title="Teams generated successfully" />

        <div class="space-y-2">
          <div
            v-for="[teamId, meta] in Object.entries(generateResult.teamMeta)"
            :key="teamId"
            class="rounded border border-gray-200 p-3 dark:border-gray-800"
          >
            <div class="mb-1 font-medium">{{ meta.projectName }}</div>
            <ul class="text-sm text-gray-600 dark:text-gray-400">
              <li v-for="student in studentsFor(teamId)" :key="student.netID">
                {{ student.firstName }} {{ student.lastName }} ({{ student.netID }})
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  </UContainer>
</template>
