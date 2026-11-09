<script setup lang="ts">
  import { parseCsv, validateBidRows, type BidRowError } from '~/utils/bidCsv'
  import { downloadCsv } from '~/utils/csvExport'
  import { titleCase } from '~/utils/labels'
  import { MEETING_DAY_OPTIONS } from '~/utils/options'
  import type { ProjectRead } from '#server/services/projectService'
  import type { StudentRead } from '#server/services/studentService'

  type MeetingDay = 'WEDNESDAY' | 'THURSDAY'

  // ── Semester & meeting day ───────────────────────────────────────────────────

  const semesterId = ref<string | undefined>()
  const meetingDay = ref<MeetingDay>('WEDNESDAY')

  const { semesters } = useSemesters()
  const selectedSemesterLabel = computed(() => {
    const semester = semesters.value.find((s) => s.id === semesterId.value)
    if (!semester) return 'semester'
    const season = semester.season[0] + semester.season.slice(1).toLowerCase()
    return `${season}-${semester.year}`
  })

  const {
    data: projectsForSemester,
    status: projectsStatus,
    refresh: refreshProjectsForSemester,
  } = useFetch<ProjectRead[]>('/api/projects', {
    query: computed(() => ({ semesterId: semesterId.value })),
    watch: [semesterId],
    default: () => [],
  })

  const teamsForDay = computed(() =>
    projectsForSemester.value.flatMap((project) =>
      project.Teams.filter(
        (t) => t.semesterId === semesterId.value && t.meetingDay === meetingDay.value
      ).map((team) => ({
        id: team.id,
        projectId: project.id,
        projectName: project.name,
        partnerName: project.Partner.name,
        memberCount: team.Memberships.length,
      }))
    )
  )

  // Single source of truth for "is this team locked" — reads straight off
  // projectsForSemester (always loaded, not dependent on having clicked Generate
  // Teams this page load) so lock status and the Lock/Unlock button are visible
  // everywhere, not just inside a freshly-generated results view.
  function membershipsForTeam(teamId: string) {
    for (const project of projectsForSemester.value) {
      const team = project.Teams.find((t) => t.id === teamId)
      if (team) return team.Memberships.filter((m) => !m.isMentor)
    }
    return []
  }

  function isTeamLocked(teamId: string) {
    const memberships = membershipsForTeam(teamId)
    return memberships.length > 0 && memberships.every((m) => m.locked)
  }

  const lockingTeamKey = ref<string | null>(null)
  const teamLockError = ref<string | null>(null)

  async function toggleTeamLock(teamId: string, locked: boolean) {
    lockingTeamKey.value = teamId
    teamLockError.value = null
    try {
      await $fetch('/api/team-formation/lock-team', { method: 'POST', body: { teamId, locked } })
      await Promise.all([refreshProjectsForSemester(), refreshStudentsForSemester()])
    } catch (e: any) {
      teamLockError.value = e?.data?.message ?? e?.message ?? 'Failed to update team lock.'
    } finally {
      lockingTeamKey.value = null
    }
  }

  const { data: studentsForSemester, refresh: refreshStudentsForSemester } = useFetch<
    StudentRead[]
  >('/api/students', {
    query: computed(() => ({ semesterId: semesterId.value })),
    watch: [semesterId],
    default: () => [],
  })

  const { data: allProjects, refresh: refreshAllProjects } = useFetch<ProjectRead[]>(
    '/api/projects',
    {
      default: () => [],
    }
  )

  const canExport = computed(() => !!semesterId.value && !!meetingDay.value)

  function seasonCode(season: string) {
    if (season === 'SPRING') return 'S'
    if (season === 'SUMMER') return 'U'
    if (season === 'FALL') return 'F'
    return season[0]
  }

  const CHOICE_COLUMN_COUNT = 6

  function exportTeams() {
    const semester = semesters.value.find((s) => s.id === semesterId.value)
    if (!semester) return

    const term = `${seasonCode(semester.season)}${String(semester.year).slice(-2)}`
    const projectLabelById = new Map(
      allProjects.value.map((p) => [p.id, `${term} - ${p.Partner.name}: ${p.name}`])
    )
    const studentById = new Map(studentsForSemester.value.map((s) => [s.id, s]))

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

    for (const project of projectsForSemester.value) {
      const teamLabel =
        projectLabelById.get(project.id) ?? `${term} - ${project.Partner.name}: ${project.name}`

      for (const team of project.Teams) {
        if (team.meetingDay !== meetingDay.value) continue

        for (const membership of team.Memberships) {
          const student = studentById.get(membership.studentId)
          const enrollment = student?.Enrollments.find((e) => e.semesterId === semesterId.value)

          const choices = (student?.Choices ?? [])
            .filter((c) => c.semesterId === semesterId.value)
            .sort((a, b) => a.rank - b.rank)
            .map((c) => projectLabelById.get(c.projectId) ?? '')
          const choiceCells = Array.from(
            { length: CHOICE_COLUMN_COUNT },
            (_, i) => choices[i] ?? ''
          )

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

    const dayLabel = meetingDay.value === 'WEDNESDAY' ? 'Wed' : 'Thu'
    downloadCsv(`${dayLabel} Teams - ${selectedSemesterLabel.value}.csv`, rows)
  }

  // ── Bid file upload ──────────────────────────────────────────────────────────

  const bidFile = ref<File | null>(null)
  const parsedRows = ref<Record<string, string>[]>([])
  const parseErrors = ref<BidRowError[]>([])
  const missingColumns = ref<string[]>([])
  const uploadResult = ref<{
    studentsImported: number
    choicesCreated: number
    skippedStudents: string[]
  } | null>(null)
  const uploading = ref(false)
  const uploadError = ref<string | null>(null)

  watch(bidFile, async (file) => {
    parsedRows.value = []
    parseErrors.value = []
    missingColumns.value = []
    if (!file) return

    // Only clear prior results once a new file is actually chosen, so a successful
    // upload's summary stays visible after we reset `bidFile` below.
    uploadResult.value = null
    uploadError.value = null

    const text = await file.text()
    const rows = parseCsv(text)
    const validation = validateBidRows(rows)
    missingColumns.value = validation.missingColumns
    parseErrors.value = validation.errors
    if (!validation.missingColumns.length && !validation.errors.length) {
      parsedRows.value = rows
    }
  })

  // Once bids are saved for this semester/day the upload box is tucked away behind
  // "Replace bid file", since the usual visit has nothing to upload. With nothing
  // saved yet it's the whole step, as before.
  const replacingBids = ref(false)
  const showBidUpload = computed(() => !bidCountForDay.value || replacingBids.value)
  watch([semesterId, meetingDay], () => (replacingBids.value = false))

  function cancelReplaceBids() {
    replacingBids.value = false
    bidFile.value = null
  }

  const canUpload = computed(
    () =>
      !!semesterId.value &&
      parsedRows.value.length > 0 &&
      !parseErrors.value.length &&
      !missingColumns.value.length
  )

  async function submitBidFile() {
    if (!canUpload.value || !semesterId.value) return
    uploading.value = true
    uploadError.value = null
    try {
      uploadResult.value = await $fetch('/api/team-formation/bids', {
        method: 'POST',
        query: { semesterId: semesterId.value, meetingDay: meetingDay.value },
        body: parsedRows.value,
      })
      // Require an explicit new file selection before another upload can be submitted —
      // otherwise switching the meeting day and re-clicking Upload silently resubmits the
      // same roster under the new day, overwriting those students' enrollment day.
      bidFile.value = null
      replacingBids.value = false
      await Promise.all([
        refreshProjectsForSemester(),
        refreshAllProjects(),
        refreshStudentsForSemester(),
      ])
    } catch (e: any) {
      uploadError.value = e?.data?.message ?? e?.message ?? 'Failed to import bid file.'
    } finally {
      uploading.value = false
    }
  }

  // ── Step-by-step page layout ─────────────────────────────────────────────────

  // One step on screen at a time — the others aren't rendered at all. Staff can
  // always go back to any step they've reached, but can only move forward with
  // Next, and Next waits until the data that step exists for is actually there
  // (not until a particular button was clicked): bids already imported on an
  // earlier visit count, and locking 3200s is optional. Changing the semester or
  // day starts the walk over, since everything after step 1 depends on it.
  const activeSection = ref(1)
  const furthestStep = ref(1)
  watch([semesterId, meetingDay], () => (furthestStep.value = 1))

  const STEP_COUNT = 5
  const steps = computed(() =>
    [
      { title: 'Semester & Day', icon: 'i-heroicons-calendar' },
      { title: 'Bid File', icon: 'i-heroicons-arrow-up-tray' },
      { title: 'Lock 3200s', icon: 'i-heroicons-lock-closed' },
      { title: 'Generate', icon: 'i-heroicons-sparkles' },
      { title: 'Arrange Teams', icon: 'i-heroicons-squares-2x2' },
    ].map((step, i) => ({ ...step, disabled: i + 1 > furthestStep.value }))
  )
  // UStepper treats a numeric v-model as a 0-based index; sections are numbered from 1.
  const stepIndex = computed({
    get: () => activeSection.value - 1,
    set: (i: number) => (activeSection.value = i + 1),
  })

  const bidCountForDay = computed(
    () =>
      studentsForSemester.value.filter(
        (s) =>
          s.Enrollments.some(
            (e) => e.semesterId === semesterId.value && e.meetingDay === meetingDay.value
          ) && s.Choices.some((c) => c.semesterId === semesterId.value)
      ).length
  )
  const teamsHaveMembers = computed(() => teamsForDay.value.some((t) => t.memberCount > 0))

  // Why Next is blocked on the current step, or null when it's free to go.
  const nextBlocker = computed(() => {
    if (activeSection.value === 1 && !semesterId.value) return 'Pick a semester first.'
    if (activeSection.value === 2 && !bidCountForDay.value)
      return 'Upload a bid file for this day first.'
    if (activeSection.value === 4 && !teamsHaveMembers.value) return 'Generate teams first.'
    return null
  })

  function goNext() {
    if (nextBlocker.value || activeSection.value >= STEP_COUNT) return
    activeSection.value++
    furthestStep.value = Math.max(furthestStep.value, activeSection.value)
  }

  // ── 3200 lock-in ──────────────────────────────────────────────────────────────

  const students3200ForDay = computed(() =>
    studentsForSemester.value.filter((s) => {
      const enrollment = s.Enrollments.find((e) => e.semesterId === semesterId.value)
      return enrollment?.class === 'EPCS_3200' && enrollment.meetingDay === meetingDay.value
    })
  )

  function lockedMembershipFor(student: StudentRead) {
    return student.Memberships.find(
      (m) =>
        m.locked &&
        m.Team.semesterId === semesterId.value &&
        m.Team.meetingDay === meetingDay.value
    )
  }

  function choiceLabelsFor(student: StudentRead) {
    return student.Choices.filter((c) => c.semesterId === semesterId.value)
      .sort((a, b) => a.rank - b.rank)
      .map((c) => allProjects.value.find((p) => p.id === c.projectId)?.name ?? '')
      .filter(Boolean)
  }

  const SEASON_ORDER: Record<string, number> = { SPRING: 0, SUMMER: 1, FALL: 2 }

  // The project a student most recently worked on in an earlier semester, if any —
  // mirrors the "returning student" logic the solver itself uses, computed here from
  // data already on the student object so the dropdown/labels can show it live.
  function previousProjectFor(student: StudentRead): string | undefined {
    const currentSemester = semesters.value.find((s) => s.id === semesterId.value)
    if (!currentSemester) return undefined
    const currentRank = currentSemester.year * 10 + SEASON_ORDER[currentSemester.season]!

    let best: { rank: number; name: string } | undefined
    for (const m of student.Memberships) {
      if (m.isMentor) continue
      const sem = m.Team.Semester
      const rank = sem.year * 10 + SEASON_ORDER[sem.season]!
      if (rank >= currentRank) continue
      if (!best || rank > best.rank) {
        best = { rank, name: m.Team.Project.name }
      }
    }
    return best?.name
  }

  function ordinal(n: number) {
    if (n % 10 === 1 && n % 100 !== 11) return `${n}st`
    if (n % 10 === 2 && n % 100 !== 12) return `${n}nd`
    if (n % 10 === 3 && n % 100 !== 13) return `${n}rd`
    return `${n}th`
  }

  // Team dropdown options for one student, ordered by THEIR ranking (1st choice on
  // top) and labeled with the rank number, so staff can pick straight off the list
  // instead of cross-referencing the Choices line above. Teams they didn't rank at
  // all sort to the bottom, prefixed with "—" instead of a number. Their returning
  // project (if any) is flagged regardless of where it falls in their ranking.
  function teamOptionsFor(student: StudentRead) {
    const rankByProjectName = new Map(choiceLabelsFor(student).map((name, i) => [name, i + 1]))
    const prevProject = previousProjectFor(student)
    return teamsForDay.value
      .map((t) => ({ team: t, rank: rankByProjectName.get(t.projectName) }))
      .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))
      .map(({ team, rank }) => {
        const base = rank ? `${rank}. ${team.projectName}` : `Not ranked: ${team.projectName}`
        return {
          label: team.projectName === prevProject ? `${base} ⟲ returning` : base,
          value: team.id,
        }
      })
  }

  // Live label for whatever team is CURRENTLY picked in the dropdown — recomputes as
  // staff changes the selection, whether it started from a suggestion or a manual pick.
  function selectionLabel(student: StudentRead) {
    const teamId = lockSelections[student.id]
    if (!teamId) return null

    const suggestion = suggestions[student.id]
    if (suggestion && suggestion.teamId === teamId) {
      return `Suggested: ${suggestion.reason}`
    }

    const projectName = teamsForDay.value.find((t) => t.id === teamId)?.projectName
    if (!projectName) return null
    const isReturning = projectName === previousProjectFor(student)
    const idx = choiceLabelsFor(student).indexOf(projectName)
    const rankPart = idx === -1 ? 'not one of their ranked choices' : `their ${ordinal(idx + 1)} choice`
    return isReturning ? `This is their returning project, and ${rankPart}` : `This is ${rankPart}`
  }

  // Locking 3200s ahead of time is optional, so the student list and suggestions
  // stay folded away until staff ask for them; the min/max range stays visible
  // because it also drives Generate Teams.
  const show3200Locking = ref(false)
  const locked3200Count = computed(
    () => students3200ForDay.value.filter((s) => lockedMembershipFor(s)).length
  )

  const lockSelections = reactive<Record<string, string>>({})

  // ── Lock all / Unlock all 3200s ──────────────────────────────────────────────
  // Lock all locks every unlocked 3200 into the team picked in their dropdown, or
  // failing that the team they're on now; anyone with neither is skipped. Unlock
  // all keeps every locked 3200 on their current team and only clears the lock
  // (unlike the per-student Unlock, which removes the placement), so it's safe to
  // undo with Lock all. Both ask first, since real semesters have real locks.

  const confirm = useConfirm()
  const bulkLocking = ref(false)

  function currentMembershipFor(student: StudentRead) {
    return student.Memberships.find(
      (m) =>
        !m.isMentor &&
        m.Team.semesterId === semesterId.value &&
        m.Team.meetingDay === meetingDay.value
    )
  }

  const unlocked3200 = computed(() => students3200ForDay.value.filter((s) => !lockedMembershipFor(s)))
  const lockAllTargets = computed(() =>
    unlocked3200.value.flatMap((s) => {
      const teamId = lockSelections[s.id] ?? currentMembershipFor(s)?.teamId
      return teamId ? [{ studentId: s.id, teamId }] : []
    })
  )

  async function lockAll3200() {
    const targets = lockAllTargets.value
    const skipped = unlocked3200.value.length - targets.length
    if (!targets.length) return
    const ok = await confirm({
      title: `Lock ${targets.length} 3200 student(s)?`,
      description:
        "Each one is locked into the team picked in their dropdown, or the team they're on now. " +
        (skipped ? `${skipped} with no team picked or assigned will be skipped. ` : '') +
        'Generate Teams will leave them where they are.',
      confirmLabel: 'Lock all',
    })
    if (!ok) return
    bulkLocking.value = true
    lockError.value = null
    try {
      for (const { studentId, teamId } of targets) {
        await $fetch('/api/team-formation/lock', {
          method: 'POST',
          body: { teamId, studentId, locked: true },
        })
        delete suggestions[studentId]
      }
    } catch (e: any) {
      lockError.value = e?.data?.message ?? e?.message ?? 'Failed to lock all 3200 students.'
    } finally {
      await Promise.all([refreshProjectsForSemester(), refreshStudentsForSemester()])
      bulkLocking.value = false
    }
  }

  async function unlockAll3200() {
    const locked = students3200ForDay.value.flatMap((s) => {
      const m = lockedMembershipFor(s)
      return m ? [{ studentId: s.id, teamId: m.teamId }] : []
    })
    if (!locked.length) return
    const ok = await confirm({
      title: `Unlock ${locked.length} 3200 student(s)?`,
      description:
        "They stay on the team they're on now, just no longer locked, so Generate Teams can " +
        'move them. A whole team that was locked will count as unlocked afterwards.',
      confirmLabel: 'Unlock all',
    })
    if (!ok) return
    bulkLocking.value = true
    lockError.value = null
    try {
      for (const { studentId, teamId } of locked) {
        await $fetch('/api/team-formation/lock', {
          method: 'POST',
          body: { teamId, studentId, locked: false, replaceLocked: true },
        })
      }
    } catch (e: any) {
      lockError.value = e?.data?.message ?? e?.message ?? 'Failed to unlock all 3200 students.'
    } finally {
      await Promise.all([refreshProjectsForSemester(), refreshStudentsForSemester()])
      bulkLocking.value = false
    }
  }
  const lockingKey = ref<string | null>(null)
  const lockError = ref<string | null>(null)

  async function lockStudent(studentId: string) {
    const teamId = lockSelections[studentId]
    if (!teamId) return
    lockingKey.value = studentId
    lockError.value = null
    try {
      await $fetch('/api/team-formation/lock', { method: 'POST', body: { teamId, studentId } })
      await Promise.all([refreshProjectsForSemester(), refreshStudentsForSemester()])
    } catch (e: any) {
      lockError.value = e?.data?.message ?? e?.message ?? 'Failed to lock student.'
    } finally {
      lockingKey.value = null
    }
  }

  async function unlockMembership(membershipId: string) {
    lockingKey.value = membershipId
    lockError.value = null
    try {
      await $fetch('/api/team-formation/lock', { method: 'DELETE', body: { membershipId } })
      await Promise.all([refreshProjectsForSemester(), refreshStudentsForSemester()])
    } catch (e: any) {
      lockError.value = e?.data?.message ?? e?.message ?? 'Failed to unlock student.'
    } finally {
      lockingKey.value = null
    }
  }

  // Algorithm-suggested placements for unlocked 3200 students, shown as a pre-filled
  // team choice + a reason staff can review before locking anything in.
  interface Suggestion {
    teamId: string
    reason: string
  }
  const suggestions = reactive<Record<string, Suggestion>>({})
  const noChoiceStudentIds = ref<Set<string>>(new Set())
  const suggesting = ref(false)
  const suggestError = ref<string | null>(null)
  const usedFallbackThirdChoice = ref(false)
  const lockingAllSuggested = ref(false)
  // How many 3200 students a single project can absorb before the suggestion step
  // starts pushing the rest to their next choice — keeps a popular project from
  // soaking up every available 3200 and leaving another project without one.
  const maxUpperclassPerProject = ref(4)

  function reasonFor(placement: { choiceRank: number; isReturning: boolean }) {
    if (placement.isReturning) return 'Returning to their previous project'
    if (placement.choiceRank === 1) return 'Their 1st choice'
    if (placement.choiceRank === 2) return 'Their 2nd choice'
    return `Their ${placement.choiceRank}rd choice, since 1st and 2nd were full`
  }

  async function suggestPlacements() {
    if (!semesterId.value) return
    suggesting.value = true
    suggestError.value = null
    try {
      const result = await $fetch<{
        placements: { studentId: string; teamId: string; choiceRank: number; isReturning: boolean }[]
        noChoicesStudentIds: string[]
        usedFallbackThirdChoice: boolean
      }>('/api/team-formation/suggest-locks', {
        method: 'POST',
        body: {
          semesterId: semesterId.value,
          day: meetingDay.value,
          maxTeamSize: config.max_team_size,
          maxUpperclassPerProject: maxUpperclassPerProject.value,
        },
      })
      for (const key of Object.keys(suggestions)) delete suggestions[key]
      for (const p of result.placements) {
        lockSelections[p.studentId] = p.teamId
        suggestions[p.studentId] = { teamId: p.teamId, reason: reasonFor(p) }
      }
      noChoiceStudentIds.value = new Set(result.noChoicesStudentIds)
      usedFallbackThirdChoice.value = result.usedFallbackThirdChoice
    } catch (e: any) {
      suggestError.value = e?.data?.message ?? e?.message ?? 'Failed to compute suggestions.'
    } finally {
      suggesting.value = false
    }
  }

  async function lockAllSuggested() {
    const studentIds = Object.keys(suggestions)
    lockingAllSuggested.value = true
    lockError.value = null
    try {
      for (const studentId of studentIds) {
        // Staff may have changed the dropdown after the suggestion pre-filled it.
        const teamId = lockSelections[studentId] ?? suggestions[studentId]!.teamId
        await $fetch('/api/team-formation/lock', { method: 'POST', body: { teamId, studentId } })
        delete suggestions[studentId]
      }
    } catch (e: any) {
      lockError.value = e?.data?.message ?? e?.message ?? 'Failed to lock all suggested students.'
    } finally {
      // Refresh even on partial failure so already-locked students show as locked.
      await Promise.all([refreshProjectsForSemester(), refreshStudentsForSemester()])
      lockingAllSuggested.value = false
    }
  }

  // Suggestions and picks belong to one semester/day. Drop them when either changes so
  // Lock All Suggested can't lock students into the previous selection's teams.
  watch([semesterId, meetingDay], () => {
    for (const key of Object.keys(suggestions)) delete suggestions[key]
    for (const key of Object.keys(lockSelections)) delete lockSelections[key]
    noChoiceStudentIds.value = new Set()
    usedFallbackThirdChoice.value = false
  })

  // ── Team generation ──────────────────────────────────────────────────────────

  const config = reactive({
    min_team_size: 4,
    max_team_size: 6,
    prioritize_returning_students: true,
    prioritize_3200_first_choice: true,
    balance_gender: true,
  })

  // Defaults to 1 (every team needs a 3200) per the solver's own default — set to 0
  // yourself if there genuinely aren't enough 3200 students to go around this semester.
  const minUpperclassPerProject = ref(1)

  const generating = ref(false)
  const generateError = ref<string | null>(null)
  const generated = ref(false)

  const canGenerate = computed(() => !!semesterId.value && teamsForDay.value.length > 0)

  async function generateTeams() {
    if (!canGenerate.value || !semesterId.value) return
    generating.value = true
    generateError.value = null
    generated.value = false
    try {
      await $fetch('/api/team-formation/generate', {
        method: 'POST',
        body: {
          semesterId: semesterId.value,
          day: meetingDay.value,
          config: {
            ...config,
            max_upperclass_per_project: maxUpperclassPerProject.value,
            min_upperclass_per_project: minUpperclassPerProject.value,
          },
        },
      })
      await Promise.all([
        refreshProjectsForSemester(),
        refreshAllProjects(),
        refreshStudentsForSemester(),
      ])
      generated.value = true
    } catch (e: any) {
      generateError.value = e?.data?.message ?? e?.message ?? 'Team generation failed.'
    } finally {
      generating.value = false
    }
  }

  // ── Arrange teams (the board) ────────────────────────────────────────────────
  // Every team for the semester/day is a square in one grid. Staff set the teams
  // they want to work on aside into the Workbench above it, where those teams sit
  // side by side at full size and students can be dragged between them. Each
  // student shows their rank for the team they're on, and while one is being
  // dragged every Workbench team shows that student's rank for it, so the best
  // drop is visible before letting go. The Workbench itself is only this page's
  // view — nothing is saved until a student actually moves or a team is locked.
  // Locked teams can't take part in moves, so locking one sends it back to the
  // grid, where locked squares sort last. Reads straight from the database rows,
  // so it works with or without a Generate Teams run this visit.

  type BoardDrag =
    | { kind: 'team'; teamId: string }
    | { kind: 'student'; studentId: string; fromTeamId: string }

  const workbenchTeamIds = ref<string[]>([])
  watch([semesterId, meetingDay], () => (workbenchTeamIds.value = []))

  const boardDrag = ref<BoardDrag | null>(null)
  // 'workbench', 'grid', or the id of the Workbench team under the pointer.
  const boardDropTarget = ref<string | null>(null)
  const boardBusy = ref(false)
  const boardError = ref<string | null>(null)

  function onWorkbench(teamId: string) {
    return workbenchTeamIds.value.includes(teamId)
  }

  const workbenchTeams = computed(() =>
    workbenchTeamIds.value.flatMap((id) => teamsForDay.value.filter((t) => t.id === id))
  )
  const gridTeams = computed(() =>
    teamsForDay.value
      .filter((t) => !onWorkbench(t.id))
      .sort((a, b) => Number(isTeamLocked(a.id)) - Number(isTeamLocked(b.id)))
  )

  function setAside(teamId: string) {
    if (isTeamLocked(teamId) || onWorkbench(teamId)) return
    workbenchTeamIds.value = [...workbenchTeamIds.value, teamId]
  }

  function putBack(teamId: string) {
    workbenchTeamIds.value = workbenchTeamIds.value.filter((id) => id !== teamId)
  }

  async function lockFromBoard(teamId: string, locked: boolean) {
    await toggleTeamLock(teamId, locked)
    if (locked && !teamLockError.value) putBack(teamId)
  }

  const studentById = computed(() => new Map(studentsForSemester.value.map((s) => [s.id, s])))

  function boardRank(studentId: string, projectId: string) {
    return studentById.value
      .get(studentId)
      ?.Choices.find((c) => c.semesterId === semesterId.value && c.projectId === projectId)?.rank
  }

  function boardIs3200(studentId: string) {
    const enrollment = studentById.value
      .get(studentId)
      ?.Enrollments.find((e) => e.semesterId === semesterId.value)
    return enrollment?.class === 'EPCS_3200'
  }

  function boardCount3200(teamId: string) {
    return membershipsForTeam(teamId).filter((m) => boardIs3200(m.studentId)).length
  }

  function rankText(rank: number | undefined) {
    return rank ? ordinal(rank) : 'not ranked'
  }

  // Colour says how good a fit is, nothing else: green for 1st/2nd, amber for
  // 3rd, grey for anything lower or unranked.
  function rankColor(rank: number | undefined) {
    if (rank && rank <= 2) return 'success'
    if (rank === 3) return 'warning'
    return 'neutral'
  }

  // The student's full ranking, with Workbench teams flagged so staff can see at a
  // glance which of their preferences are actually on the table right now.
  function boardChoiceList(studentId: string) {
    const student = studentById.value.get(studentId)
    if (!student) return []
    const workbenchProjectIds = new Set(workbenchTeams.value.map((t) => t.projectId))
    return student.Choices.filter((c) => c.semesterId === semesterId.value)
      .sort((a, b) => a.rank - b.rank)
      .map((c) => ({
        rank: c.rank,
        name: allProjects.value.find((p) => p.id === c.projectId)?.name ?? 'Unknown project',
        onWorkbench: workbenchProjectIds.has(c.projectId),
      }))
  }

  function onBoardDragStart(event: DragEvent, drag: BoardDrag) {
    if (boardBusy.value) {
      event.preventDefault()
      return
    }
    boardDrag.value = drag
    boardError.value = null
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      // Firefox won't start a drag without some data set.
      event.dataTransfer.setData('text/plain', drag.kind === 'team' ? drag.teamId : drag.studentId)
    }
  }

  function onBoardDragEnd() {
    boardDrag.value = null
    boardDropTarget.value = null
  }

  // A team square can be dropped on the Workbench (set aside) or back on the grid.
  function canDropTeamOn(area: 'workbench' | 'grid') {
    const drag = boardDrag.value
    if (drag?.kind !== 'team') return false
    return area === 'workbench' ? !onWorkbench(drag.teamId) : onWorkbench(drag.teamId)
  }

  function canDropStudentOn(teamId: string) {
    const drag = boardDrag.value
    return drag?.kind === 'student' && drag.fromTeamId !== teamId && onWorkbench(teamId)
  }

  function onAreaDragOver(event: DragEvent, area: 'workbench' | 'grid') {
    if (!canDropTeamOn(area)) return
    event.preventDefault()
    boardDropTarget.value = area
  }

  function onAreaDrop(area: 'workbench' | 'grid') {
    const drag = boardDrag.value
    onBoardDragEnd()
    if (drag?.kind !== 'team') return
    if (area === 'workbench') setAside(drag.teamId)
    else putBack(drag.teamId)
  }

  function onTeamDragOver(event: DragEvent, teamId: string) {
    if (!canDropStudentOn(teamId)) return
    event.preventDefault()
    event.stopPropagation()
    boardDropTarget.value = teamId
  }

  async function onTeamDrop(teamId: string) {
    const drag = boardDrag.value
    onBoardDragEnd()
    if (drag?.kind !== 'student' || drag.fromTeamId === teamId) return
    await moveStudentOnBoard(drag.studentId, drag.fromTeamId, teamId)
  }

  async function moveStudentOnBoard(
    studentId: string,
    fromTeamId: string,
    toTeamId: string
  ): Promise<boolean> {
    // Keep whatever lock state the student already had — a locked 3200 stays locked,
    // just in the new team; everyone else stays free for the next Generate Teams run.
    const membership = membershipsForTeam(fromTeamId).find((m) => m.studentId === studentId)
    boardBusy.value = true
    try {
      await $fetch('/api/team-formation/lock', {
        method: 'POST',
        body: {
          teamId: toTeamId,
          studentId,
          locked: !!membership?.locked,
          replaceLocked: true,
        },
      })
      await Promise.all([refreshProjectsForSemester(), refreshStudentsForSemester()])
      return true
    } catch (e: any) {
      boardError.value = e?.data?.message ?? e?.message ?? 'Failed to move student.'
      return false
    } finally {
      boardBusy.value = false
    }
  }

  function majorOf(studentId: string) {
    return (
      studentById.value
        .get(studentId)
        ?.Enrollments.find((e) => e.semesterId === semesterId.value)?.major || 'Major not listed'
    )
  }

  function studentName(studentId: string) {
    const student = studentById.value.get(studentId)
    return student ? `${student.firstName} ${student.lastName}` : 'Unknown student'
  }

  // ── Compare and swap on the Workbench ────────────────────────────────────────
  // Click a student on a Workbench card to select them: the compare bar shows
  // their major, full ranking, and what moving to each other Workbench team would
  // mean for them. Click a student on a different Workbench team to preview a
  // swap: both students' before → after ranks, majors and rankings side by side.
  // Plain warnings appear when a change puts someone on a lower-ranked team or
  // breaks a size or 3200 rule, but they never block: the decision is staff's,
  // and nothing is saved until they confirm. With exactly two teams on the
  // Workbench, every row also shows the student's rank for the other one.

  interface ComparePick {
    studentId: string
    teamId: string
  }
  const comparePicks = ref<ComparePick[]>([])
  watch([semesterId, meetingDay], () => (comparePicks.value = []))
  // Forget a pick once its team leaves the Workbench or the student leaves it.
  watch([workbenchTeamIds, projectsForSemester], () => {
    comparePicks.value = comparePicks.value.filter(
      (p) =>
        onWorkbench(p.teamId) &&
        membershipsForTeam(p.teamId).some((m) => m.studentId === p.studentId)
    )
  })

  function isPicked(studentId: string) {
    return comparePicks.value.some((p) => p.studentId === studentId)
  }

  function pickForCompare(studentId: string, teamId: string) {
    if (isPicked(studentId)) {
      comparePicks.value = comparePicks.value.filter((p) => p.studentId !== studentId)
      return
    }
    // One pick per team: picking someone else on the same team replaces them.
    const others = comparePicks.value.filter((p) => p.teamId !== teamId)
    comparePicks.value = [...others, { studentId, teamId }].slice(-2)
  }

  function teamById(teamId: string) {
    return teamsForDay.value.find((t) => t.id === teamId)
  }

  // The other team, when exactly two are on the Workbench — the "there" column.
  function otherWorkbenchTeam(teamId: string) {
    return workbenchTeams.value.length === 2
      ? workbenchTeams.value.find((t) => t.id !== teamId)
      : undefined
  }

  function firstName(studentId: string) {
    return studentById.value.get(studentId)?.firstName ?? 'This student'
  }

  function isLockedOn(studentId: string, teamId: string) {
    return !!membershipsForTeam(teamId).find((m) => m.studentId === studentId)?.locked
  }

  function worseOffWarning(studentId: string, from: DayTeam, to: DayTeam) {
    if (fitCost(studentId, to.projectId) <= fitCost(studentId, from.projectId)) return null
    return `${firstName(studentId)} would go from ${rankText(boardRank(studentId, from.projectId))} to ${rankText(boardRank(studentId, to.projectId))}`
  }

  function moveWarnings(studentId: string, from: DayTeam, to: DayTeam) {
    const warnings: string[] = []
    const worse = worseOffWarning(studentId, from, to)
    if (worse) warnings.push(worse)
    const toSize = membershipsForTeam(to.id).length + 1
    const fromSize = membershipsForTeam(from.id).length - 1
    if (toSize > config.max_team_size)
      warnings.push(`${to.projectName} would have ${toSize} members (max ${config.max_team_size})`)
    if (fromSize < config.min_team_size)
      warnings.push(`${from.projectName} would drop to ${fromSize} members (min ${config.min_team_size})`)
    if (boardIs3200(studentId)) {
      const fromCount = boardCount3200(from.id) - 1
      const toCount = boardCount3200(to.id) + 1
      if (fromCount < minUpperclassPerProject.value)
        warnings.push(`${from.projectName} would have ${fromCount} 3200s (min ${minUpperclassPerProject.value})`)
      if (toCount > maxUpperclassPerProject.value)
        warnings.push(`${to.projectName} would have ${toCount} 3200s (max ${maxUpperclassPerProject.value})`)
    }
    if (isLockedOn(studentId, from.id))
      warnings.push(`${firstName(studentId)} is locked and stays locked on the new team`)
    return warnings
  }

  // One student picked: what moving them to each other Workbench team would mean.
  const compareMoveOptions = computed(() => {
    const pick = comparePicks.value.length === 1 ? comparePicks.value[0] : undefined
    const from = pick && teamById(pick.teamId)
    if (!pick || !from) return []
    return workbenchTeams.value
      .filter((t) => t.id !== from.id)
      .map((to) => ({
        to,
        before: boardRank(pick.studentId, from.projectId),
        after: boardRank(pick.studentId, to.projectId),
        warnings: moveWarnings(pick.studentId, from, to),
      }))
  })

  // Two students on different teams picked: the swap, both sides.
  const swapPreview = computed(() => {
    if (comparePicks.value.length !== 2) return null
    const [a, b] = comparePicks.value as [ComparePick, ComparePick]
    const teamA = teamById(a.teamId)
    const teamB = teamById(b.teamId)
    if (!teamA || !teamB) return null

    const warnings: string[] = []
    const worseA = worseOffWarning(a.studentId, teamA, teamB)
    const worseB = worseOffWarning(b.studentId, teamB, teamA)
    if (worseA) warnings.push(worseA)
    if (worseB) warnings.push(worseB)
    // Sizes don't change in a swap, but the 3200 count does if only one is a 3200.
    const aIs3200 = boardIs3200(a.studentId)
    if (aIs3200 !== boardIs3200(b.studentId)) {
      const losing = aIs3200 ? teamA : teamB
      const gaining = aIs3200 ? teamB : teamA
      const losingCount = boardCount3200(losing.id) - 1
      const gainingCount = boardCount3200(gaining.id) + 1
      if (losingCount < minUpperclassPerProject.value)
        warnings.push(`${losing.projectName} would have ${losingCount} 3200s (min ${minUpperclassPerProject.value})`)
      if (gainingCount > maxUpperclassPerProject.value)
        warnings.push(`${gaining.projectName} would have ${gainingCount} 3200s (max ${maxUpperclassPerProject.value})`)
    }
    for (const p of [a, b]) {
      if (isLockedOn(p.studentId, p.teamId))
        warnings.push(`${firstName(p.studentId)} is locked and stays locked on the new team`)
    }

    const side = (p: ComparePick, from: DayTeam, to: DayTeam) => ({
      studentId: p.studentId,
      from,
      to,
      before: boardRank(p.studentId, from.projectId),
      after: boardRank(p.studentId, to.projectId),
    })
    return { a: side(a, teamA, teamB), b: side(b, teamB, teamA), warnings }
  })

  // Both a student's own ranking and which of the teams in play each choice is.
  function compareChoices(studentId: string, teamIds: string[]) {
    const projectIds = new Set(teamIds.flatMap((id) => teamById(id)?.projectId ?? []))
    return (studentById.value.get(studentId)?.Choices ?? [])
      .filter((c) => c.semesterId === semesterId.value)
      .sort((a, b) => a.rank - b.rank)
      .map((c) => ({
        rank: c.rank,
        name: allProjects.value.find((p) => p.id === c.projectId)?.name ?? 'Unknown project',
        inPlay: projectIds.has(c.projectId),
      }))
  }

  async function confirmCompareMove(toTeamId: string) {
    const pick = comparePicks.value[0]
    if (!pick) return
    const moved = await moveStudentOnBoard(pick.studentId, pick.teamId, toTeamId)
    if (moved) comparePicks.value = []
  }

  async function confirmSwap() {
    const preview = swapPreview.value
    if (!preview) return
    const first = await moveStudentOnBoard(preview.a.studentId, preview.a.from.id, preview.a.to.id)
    if (first) {
      const second = await moveStudentOnBoard(
        preview.b.studentId,
        preview.b.from.id,
        preview.b.to.id
      )
      if (second) comparePicks.value = []
    }
  }

  // ── Improve one team ─────────────────────────────────────────────────────────
  // Staff pick a team ("Improve") and get, for each student on it, the best team
  // they ranked higher that they can actually get onto, across every team for the
  // day (not just the Workbench). The rule is that nobody ends up worse off:
  //   - a straight move when that team has room, this team stays at or above the
  //     minimum size, and the 3200 range holds on both sides;
  //   - otherwise a swap with someone on that team who ranks this team at least as
  //     high as where they are now, preferring whoever gains the most from it.
  // Locked students and locked teams are never touched. Applying a fix sets both
  // teams aside so the result is on the Workbench to look at. Recomputed from live
  // data, so the panel updates after every applied fix.

  type DayTeam = (typeof teamsForDay.value)[number]
  type TeamFix =
    | { kind: 'move'; to: DayTeam; rank: number; full: false }
    | {
        kind: 'swap'
        to: DayTeam
        rank: number
        full: boolean
        withStudentId: string
        // The partner's rank for where they are now, and for this team.
        withBefore: number | undefined
        withAfter: number | undefined
      }
  interface StudentReview {
    membershipId: string
    studentId: string
    locked: boolean
    rank: number | undefined
    fix: TeamFix | null
    // Why each team they ranked higher didn't work, best-ranked first. Only
    // filled in when there's no fix, so staff see the real reason instead of a
    // generic "no better team".
    blocked: { name: string; rank: number; reason: string }[]
  }

  const improveTeamId = ref<string | null>(null)
  const improvePanel = ref<HTMLElement | null>(null)
  watch([semesterId, meetingDay], () => (improveTeamId.value = null))

  const improveTeam = computed(() => teamsForDay.value.find((t) => t.id === improveTeamId.value))

  function openImprove(teamId: string) {
    improveTeamId.value = teamId
    nextTick(() => improvePanel.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  // Lower is better; an unranked team counts as one worse than their last choice.
  function fitCost(studentId: string, projectId: string) {
    return boardRank(studentId, projectId) ?? CHOICE_COLUMN_COUNT + 1
  }

  function fixFor(
    studentId: string,
    here: DayTeam
  ): { fix: TeamFix | null; blocked: StudentReview['blocked'] } {
    const hereCost = fitCost(studentId, here.projectId)
    const is3200 = boardIs3200(studentId)
    const size = (teamId: string) => membershipsForTeam(teamId).length
    const minSize = config.min_team_size
    const min3200 = minUpperclassPerProject.value
    const max3200 = maxUpperclassPerProject.value
    const choices = (studentById.value.get(studentId)?.Choices ?? [])
      .filter((c) => c.semesterId === semesterId.value && c.rank < hereCost)
      .sort((a, b) => a.rank - b.rank)
    const blocked: StudentReview['blocked'] = []
    const noTrade = 'nobody there would trade without losing out'

    for (const choice of choices) {
      const to = teamsForDay.value.find((t) => t.projectId === choice.projectId)
      const name =
        to?.projectName ??
        allProjects.value.find((p) => p.id === choice.projectId)?.name ??
        'Unknown project'
      if (!to) {
        blocked.push({ name, rank: choice.rank, reason: 'no team for it on this day' })
        continue
      }
      if (to.id === here.id) continue
      if (isTeamLocked(to.id)) {
        blocked.push({ name, rank: choice.rank, reason: 'that team is locked' })
        continue
      }

      // A straight move, unless one of these rules stops it.
      const full = size(to.id) >= config.max_team_size
      let moveBlocker: string | null = null
      if (full) moveBlocker = 'full'
      else if (size(here.id) <= minSize)
        moveBlocker = `this team would drop below ${minSize} members`
      else if (is3200 && boardCount3200(here.id) <= min3200)
        moveBlocker =
          min3200 === 1
            ? "they're this team's only 3200"
            : `this team would drop below ${min3200} 3200s`
      else if (is3200 && boardCount3200(to.id) >= max3200)
        moveBlocker = `that team already has ${max3200} 3200s`
      if (!moveBlocker) {
        return { fix: { kind: 'move', to, rank: choice.rank, full: false }, blocked: [] }
      }

      // Swap: someone on that team who is no worse off on this one.
      let best: { id: string; gain: number } | null = null
      for (const m of membershipsForTeam(to.id)) {
        if (m.locked) continue
        const gain = fitCost(m.studentId, to.projectId) - fitCost(m.studentId, here.projectId)
        if (gain < 0) continue
        const otherIs3200 = boardIs3200(m.studentId)
        if (is3200 !== otherIs3200) {
          const losing = is3200 ? here : to
          const gaining = is3200 ? to : here
          if (boardCount3200(losing.id) <= min3200) continue
          if (boardCount3200(gaining.id) >= max3200) continue
        }
        if (!best || gain > best.gain) best = { id: m.studentId, gain }
      }
      if (best) {
        return {
          fix: {
            kind: 'swap',
            to,
            rank: choice.rank,
            full,
            withStudentId: best.id,
            withBefore: boardRank(best.id, to.projectId),
            withAfter: boardRank(best.id, here.projectId),
          },
          blocked: [],
        }
      }
      blocked.push({ name, rank: choice.rank, reason: `${moveBlocker}, and ${noTrade}` })
    }
    return { fix: null, blocked }
  }

  const improveReview = computed<StudentReview[]>(() => {
    const here = improveTeam.value
    if (!here) return []
    return membershipsForTeam(here.id).map((m) => ({
      membershipId: m.id,
      studentId: m.studentId,
      locked: m.locked,
      rank: boardRank(m.studentId, here.projectId),
      ...(m.locked ? { fix: null, blocked: [] } : fixFor(m.studentId, here)),
    }))
  })

  async function applyFix(review: StudentReview) {
    const here = improveTeam.value
    const fix = review.fix
    if (!here || !fix) return
    setAside(here.id)
    setAside(fix.to.id)
    const moved = await moveStudentOnBoard(review.studentId, here.id, fix.to.id)
    if (moved && fix.kind === 'swap') {
      await moveStudentOnBoard(fix.withStudentId, fix.to.id, here.id)
    }
  }
</script>

<template>
  <UContainer
    :class="['space-y-8 py-8', activeSection === 5 ? 'max-w-7xl' : 'max-w-4xl']"
  >
    <UStepper v-model="stepIndex" :items="steps" :linear="false" size="sm" />
    <section v-if="activeSection === 1" class="space-y-4">
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
          v-if="teamLockError"
          color="error"
          variant="subtle"
          title="Could not update team lock"
          :description="teamLockError"
        />
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
            class="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-200 p-2 text-sm dark:border-gray-800"
          >
            <span>
              {{ team.projectName }} ({{ team.partnerName }})
              <UBadge v-if="isTeamLocked(team.id)" color="primary" variant="subtle" size="sm">Locked</UBadge>
            </span>
            <span class="text-gray-500">{{ team.memberCount }} member(s)</span>
          </li>
        </ul>
      </div>
    </section>

    <section v-if="activeSection === 2" class="space-y-4">
      <h2 class="text-lg font-semibold">2. Bid File</h2>

      <div
        v-if="!showBidUpload"
        class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-800"
      >
        <p class="text-sm">
          Bids from {{ bidCountForDay }} student(s) are saved for this day. Nothing to upload,
          go on to the next step.
        </p>
        <UButton
          label="Replace bid file"
          icon="i-heroicons-arrow-path"
          size="xs"
          color="neutral"
          variant="ghost"
          @click="replacingBids = true"
        />
      </div>

      <template v-if="showBidUpload">
      <div v-if="replacingBids" class="space-y-2">
        <UAlert
          color="warning"
          variant="subtle"
          title="Replacing the bid file"
          description="Students in the new file get their details updated and their choices replaced. Students not in the file are kept as they are. Teams that already exist won't change until you generate again."
        />
        <UButton label="Cancel" size="xs" color="neutral" variant="ghost" @click="cancelReplaceBids" />
      </div>

      <UFormField label="Bid Response CSV">
        <UFileUpload
          v-model="bidFile"
          accept=".csv"
          label="Drop CSV here or click to browse"
          :disabled="!semesterId"
        />
      </UFormField>
      <p v-if="!semesterId" class="text-sm text-gray-500">Select a semester in step 1 first.</p>

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
          :title="`${parseErrors.length} error(s) found. Upload aborted.`"
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
      </template>

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

    <section v-if="activeSection === 3" class="space-y-4">
      <h2 class="text-lg font-semibold">3. Lock 3200 Students</h2>

      <p class="text-sm text-gray-500">
        Optional. Place specific 3200 students into a team ahead of time; locked students
        are kept as is by Team Generation (step 4). Skip this and everyone is assigned by
        Team Generation.
      </p>

      <p v-if="!semesterId" class="text-sm text-gray-500">Select a semester in step 1 first.</p>

      <div v-if="semesterId" class="grid grid-cols-2 gap-4">
        <UFormField label="Min 3200 per Project">
          <UInputNumber v-model="minUpperclassPerProject" :min="0" class="w-full" />
        </UFormField>
        <UFormField label="Max 3200 per Project">
          <UInputNumber v-model="maxUpperclassPerProject" :min="minUpperclassPerProject || 1" class="w-full" />
        </UFormField>
      </div>
      <p v-if="semesterId" class="text-sm text-gray-500">
        These apply to Generate Teams too. Max stops one popular project absorbing all the
        3200s. Min is 1 by default (every project gets at least one 3200); set it to 0 if
        there aren't enough 3200 students to go around.
      </p>

      <div
        v-if="semesterId"
        class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-800"
      >
        <p class="text-sm">
          {{ students3200ForDay.length }} 3200 student(s) this day
          <span class="text-gray-500">· {{ locked3200Count }} locked</span>
        </p>
        <UButton
          :label="show3200Locking ? 'Hide 3200 students' : 'Show 3200 students'"
          :icon="show3200Locking ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
          size="xs"
          color="neutral"
          variant="soft"
          @click="show3200Locking = !show3200Locking"
        />
      </div>

      <template v-if="semesterId && show3200Locking">
      <div class="flex flex-wrap items-end gap-2">
        <UButton
          label="Suggest Placements"
          icon="i-heroicons-light-bulb"
          color="neutral"
          variant="soft"
          :loading="suggesting"
          @click="suggestPlacements"
        />
        <UButton
          v-if="Object.keys(suggestions).length"
          label="Lock All Suggested"
          icon="i-heroicons-lock-closed"
          :loading="lockingAllSuggested"
          @click="lockAllSuggested"
        />
        <div class="ml-auto flex gap-2">
          <UButton
            label="Lock all"
            icon="i-heroicons-lock-closed"
            color="neutral"
            variant="soft"
            :disabled="!lockAllTargets.length || bulkLocking"
            :loading="bulkLocking"
            @click="lockAll3200"
          />
          <UButton
            label="Unlock all"
            icon="i-heroicons-lock-open"
            color="neutral"
            variant="soft"
            :disabled="!locked3200Count || bulkLocking"
            :loading="bulkLocking"
            @click="unlockAll3200"
          />
        </div>
      </div>
      <p class="text-sm text-gray-500">
        "Suggest Placements" runs the algorithm on just the unlocked 3200 students,
        guaranteeing each one their 1st or 2nd choice whenever possible, and pre-fills
        the team below with a reason. Review it, then lock individually or all at once.
      </p>

      <UAlert
        v-if="suggestError"
        color="error"
        variant="subtle"
        title="Could not compute suggestions"
        :description="suggestError"
      />
      <UAlert
        v-if="usedFallbackThirdChoice"
        color="warning"
        variant="subtle"
        title="Some students required their 3rd choice"
        description="Capacity didn't allow 1st/2nd choice for everyone. Check which students show a 3rd-choice reason below before locking."
      />

      <UAlert
        v-if="lockError"
        color="error"
        variant="subtle"
        title="Lock/unlock failed"
        :description="lockError"
      />

      <p
        v-if="semesterId && !students3200ForDay.length"
        class="text-sm text-gray-500"
      >
        No 3200 students enrolled for this semester/day.
      </p>

      <ul v-else-if="semesterId" class="space-y-2">
        <li
          v-for="student in students3200ForDay"
          :key="student.id"
          class="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-200 p-2 text-sm dark:border-gray-800"
        >
          <div>
            <div class="font-medium">
              {{ student.firstName }} {{ student.lastName }} ({{ student.netID }})
            </div>
            <div v-if="!lockedMembershipFor(student) && selectionLabel(student)" class="text-primary-500">
              {{ selectionLabel(student) }}
            </div>
            <div
              v-else-if="!lockedMembershipFor(student) && noChoiceStudentIds.has(student.id)"
              class="text-amber-500"
            >
              No bid submitted. Needs manual placement.
            </div>
          </div>

          <div v-if="lockedMembershipFor(student)" class="flex items-center gap-2">
            <UBadge color="primary" variant="subtle">
              Locked: {{ lockedMembershipFor(student)!.Team.Project.name }}
            </UBadge>
            <UButton
              label="Unlock"
              size="xs"
              color="neutral"
              variant="soft"
              :loading="lockingKey === lockedMembershipFor(student)!.id"
              @click="unlockMembership(lockedMembershipFor(student)!.id)"
            />
          </div>
          <div v-else class="flex items-center gap-2">
            <USelect
              v-model="lockSelections[student.id]"
              :items="teamOptionsFor(student)"
              placeholder="Choose team"
              class="w-64"
            />
            <UButton
              label="Lock"
              size="xs"
              :disabled="!lockSelections[student.id]"
              :loading="lockingKey === student.id"
              @click="lockStudent(student.id)"
            />
          </div>
        </li>
      </ul>
      </template>
    </section>

    <section v-if="activeSection === 4" class="space-y-4">
      <h2 class="text-lg font-semibold">4. Team Generation</h2>


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

      <p class="text-sm text-gray-500">
        3200-per-project range is set in step 3 (currently
        {{ minUpperclassPerProject }} to {{ maxUpperclassPerProject }}) and applies here too.
      </p>

      <UButton
        label="Generate Teams"
        icon="i-heroicons-sparkles"
        :loading="generating"
        :disabled="!canGenerate || generating"
        @click="generateTeams"
      />
      <p v-if="!canGenerate" class="text-sm text-gray-500">
        Select a semester/day with at least one team in step 1 first.
      </p>

      <UAlert
        v-if="generateError"
        color="error"
        variant="subtle"
        title="Team generation failed"
        :description="generateError"
      />

      <p v-if="teamsHaveMembers && !generated" class="text-sm text-gray-500">
        Teams already exist for this day, so you can go straight on to arranging them.
        Generating again re-solves every student who isn't locked.
      </p>

      <UAlert
        v-if="generated"
        color="success"
        variant="subtle"
        title="Teams generated"
        description="Arrange them in the next step. Members of teams you lock there stay put if you come back and generate again; only everyone else is re-solved. A locked team with spare seats can still receive new students."
      />
    </section>

    <section v-if="activeSection === 5" class="space-y-6">
      <div class="space-y-1">
        <h2 class="text-lg font-semibold">5. Arrange Teams</h2>
        <p class="text-sm text-gray-500">
          Set aside the teams you want to work on, then drag students between them, or click
          a student to compare: click one student to see their major, full ranking and what
          each move would mean, then click a student on another team to preview a swap.
          Nothing is saved until you confirm. A moved student keeps their lock state.
        </p>
      </div>

      <div
        v-if="improveTeam"
        ref="improvePanel"
        class="scroll-mt-20 space-y-3 rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-800"
      >
        <div class="flex items-start justify-between gap-2">
          <div>
            <h3 class="font-medium">Improve {{ improveTeam.projectName }}</h3>
            <p class="text-xs text-gray-500">
              For each student, the best team they ranked higher that they can actually get
              onto. Nobody is ever moved somewhere they ranked lower. Applying a fix sets both
              teams aside so you can see the result.
            </p>
          </div>
          <UButton
            icon="i-heroicons-x-mark"
            aria-label="Close"
            size="xs"
            color="neutral"
            variant="ghost"
            @click="improveTeamId = null"
          />
        </div>

        <p v-if="!improveReview.length" class="text-gray-500">This team has no members yet.</p>
        <ul v-else class="space-y-2">
          <li
            v-for="review in improveReview"
            :key="review.membershipId"
            class="space-y-1 rounded border border-gray-100 p-2 dark:border-gray-800"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="flex items-center gap-1">
                <UIcon v-if="review.locked" name="i-heroicons-lock-closed" class="text-gray-400" />
                <span class="font-medium">{{ studentName(review.studentId) }}</span>
                <span class="text-gray-500">· {{ majorOf(review.studentId) }}</span>
                <UBadge v-if="boardIs3200(review.studentId)" color="neutral" variant="subtle" size="sm">
                  3200
                </UBadge>
              </span>
              <span class="flex items-center gap-1 text-xs text-gray-500">
                here
                <UBadge :color="rankColor(review.rank)" variant="subtle" size="sm">
                  {{ rankText(review.rank) }}
                </UBadge>
              </span>
            </div>

            <p v-if="review.locked" class="text-xs text-gray-500">Locked, left as is.</p>
            <p v-else-if="review.rank === 1" class="text-xs text-gray-500">
              Already on their 1st choice.
            </p>
            <div
              v-else-if="review.fix"
              class="flex flex-wrap items-center justify-between gap-2 text-xs"
            >
              <div class="space-y-0.5">
                <div class="flex flex-wrap items-center gap-1">
                  → {{ review.fix.to.projectName }}
                  <UBadge :color="rankColor(review.fix.rank)" variant="subtle" size="sm">
                    {{ rankText(review.fix.rank) }}
                  </UBadge>
                  <span class="text-gray-500">
                    {{
                      review.fix.kind === 'move'
                        ? 'has room'
                        : review.fix.full
                          ? 'full, so swap'
                          : 'swap, to keep team sizes and the 3200 range'
                    }}
                  </span>
                </div>
                <div v-if="review.fix.kind === 'swap'" class="text-gray-500">
                  with {{ studentName(review.fix.withStudentId) }} ·
                  {{ majorOf(review.fix.withStudentId) }}
                  ({{ rankText(review.fix.withBefore) }} there →
                  {{ rankText(review.fix.withAfter) }} here)
                </div>
              </div>
              <UButton
                :label="review.fix.kind === 'move' ? 'Move' : 'Swap'"
                size="xs"
                :disabled="boardBusy"
                @click="applyFix(review)"
              />
            </div>
            <div v-else-if="review.blocked.length" class="space-y-0.5 text-xs text-gray-500">
              <div>No fix. Teams they ranked higher:</div>
              <ul class="space-y-0.5 pl-3">
                <li v-for="b in review.blocked" :key="b.rank">
                  <span class="text-gray-700 dark:text-gray-300">{{ b.name }}</span>
                  ({{ rankText(b.rank) }}): {{ b.reason }}
                </li>
              </ul>
            </div>
            <p v-else-if="!boardChoiceList(review.studentId).length" class="text-xs text-amber-500">
              No bid submitted, so there's nothing to compare. Place them by hand.
            </p>
            <p v-else class="text-xs text-gray-500">
              No fix: they didn't rank any team higher than this one.
            </p>
          </li>
        </ul>
      </div>

      <UAlert
        v-if="boardError"
        color="error"
        variant="subtle"
        title="Could not move student"
        :description="boardError"
      />
      <UAlert
        v-if="teamLockError"
        color="error"
        variant="subtle"
        title="Could not update team lock"
        :description="teamLockError"
      />

      <div
        :class="[
          'space-y-3 rounded-lg border p-3 transition-colors',
          boardDropTarget === 'workbench'
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/40'
            : canDropTeamOn('workbench')
              ? 'border-dashed border-primary-400'
              : 'border-gray-200 dark:border-gray-800',
          boardBusy ? 'opacity-60' : '',
        ]"
        @dragover="onAreaDragOver($event, 'workbench')"
        @dragleave="boardDropTarget === 'workbench' && (boardDropTarget = null)"
        @drop.prevent="onAreaDrop('workbench')"
      >
        <div class="flex items-center justify-between gap-2">
          <h3 class="font-medium">
            Workbench
            <span class="font-normal text-gray-500">({{ workbenchTeams.length }})</span>
          </h3>
          <UButton
            v-if="workbenchTeams.length"
            label="Put all back"
            size="xs"
            color="neutral"
            variant="ghost"
            @click="workbenchTeamIds = []"
          />
        </div>

        <div
          v-if="comparePicks.length"
          class="space-y-3 rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-900/60"
        >
          <template v-if="swapPreview">
            <div class="flex items-center justify-between gap-2">
              <h4 class="font-medium">Swap preview</h4>
              <UButton label="Cancel" size="xs" color="neutral" variant="ghost" @click="comparePicks = []" />
            </div>
            <div class="grid gap-3 md:grid-cols-2">
              <div
                v-for="side in [swapPreview.a, swapPreview.b]"
                :key="side.studentId"
                class="space-y-2 rounded border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-900"
              >
                <div>
                  <span class="font-medium">{{ studentName(side.studentId) }}</span>
                  <span class="text-gray-500"> · {{ majorOf(side.studentId) }}</span>
                  <UBadge v-if="boardIs3200(side.studentId)" color="neutral" variant="subtle" size="sm" class="ml-1">
                    3200
                  </UBadge>
                </div>
                <div class="flex flex-wrap items-center gap-1 text-xs">
                  {{ side.from.projectName }}
                  <UBadge :color="rankColor(side.before)" variant="subtle" size="sm">{{ rankText(side.before) }}</UBadge>
                  →
                  {{ side.to.projectName }}
                  <UBadge :color="rankColor(side.after)" variant="solid" size="sm">{{ rankText(side.after) }}</UBadge>
                </div>
                <ol class="space-y-0.5 text-xs">
                  <li v-if="!compareChoices(side.studentId, []).length" class="text-amber-500">
                    No bid submitted.
                  </li>
                  <li
                    v-for="choice in compareChoices(side.studentId, [side.from.id, side.to.id])"
                    :key="choice.rank"
                    :class="choice.inPlay ? 'font-medium' : 'text-gray-500'"
                  >
                    {{ choice.rank }}. {{ choice.name }}
                  </li>
                </ol>
              </div>
            </div>
            <ul v-if="swapPreview.warnings.length" class="space-y-0.5 text-xs text-amber-600 dark:text-amber-400">
              <li v-for="w in swapPreview.warnings" :key="w" class="flex items-start gap-1">
                <UIcon name="i-heroicons-exclamation-triangle" class="mt-0.5 shrink-0" />
                {{ w }}
              </li>
            </ul>
            <p v-else class="text-xs text-gray-500">
              Nobody ends up on a lower-ranked team, and team sizes and the 3200 range hold.
            </p>
            <UButton label="Confirm swap" size="sm" :disabled="boardBusy" @click="confirmSwap" />
          </template>

          <template v-else-if="comparePicks[0]">
            <div class="flex items-start justify-between gap-2">
              <div>
                <span class="font-medium">{{ studentName(comparePicks[0].studentId) }}</span>
                <span class="text-gray-500"> · {{ majorOf(comparePicks[0].studentId) }}</span>
                <UBadge v-if="boardIs3200(comparePicks[0].studentId)" color="neutral" variant="subtle" size="sm" class="ml-1">
                  3200
                </UBadge>
                <p class="text-xs text-gray-500">
                  Click a student on another Workbench team to preview a swap.
                </p>
              </div>
              <UButton label="Clear" size="xs" color="neutral" variant="ghost" @click="comparePicks = []" />
            </div>
            <div class="grid gap-3 md:grid-cols-2">
              <ol class="space-y-0.5 text-xs">
                <li v-if="!compareChoices(comparePicks[0].studentId, []).length" class="text-amber-500">
                  No bid submitted.
                </li>
                <li
                  v-for="choice in compareChoices(comparePicks[0].studentId, workbenchTeamIds)"
                  :key="choice.rank"
                  :class="choice.inPlay ? 'font-medium' : 'text-gray-500'"
                >
                  {{ choice.rank }}. {{ choice.name }}
                  <span v-if="choice.inPlay" class="font-normal text-gray-500">(on Workbench)</span>
                </li>
              </ol>
              <ul class="space-y-2">
                <li v-for="option in compareMoveOptions" :key="option.to.id" class="space-y-1">
                  <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span class="flex flex-wrap items-center gap-1">
                      Move to {{ option.to.projectName }}:
                      <UBadge :color="rankColor(option.before)" variant="subtle" size="sm">{{ rankText(option.before) }}</UBadge>
                      →
                      <UBadge :color="rankColor(option.after)" variant="solid" size="sm">{{ rankText(option.after) }}</UBadge>
                    </span>
                    <UButton
                      label="Move"
                      size="xs"
                      color="neutral"
                      variant="soft"
                      :disabled="boardBusy"
                      @click="confirmCompareMove(option.to.id)"
                    />
                  </div>
                  <ul v-if="option.warnings.length" class="space-y-0.5 text-xs text-amber-600 dark:text-amber-400">
                    <li v-for="w in option.warnings" :key="w" class="flex items-start gap-1">
                      <UIcon name="i-heroicons-exclamation-triangle" class="mt-0.5 shrink-0" />
                      {{ w }}
                    </li>
                  </ul>
                </li>
                <li v-if="!compareMoveOptions.length" class="text-xs text-gray-500">
                  Set aside another team to compare moves.
                </li>
              </ul>
            </div>
          </template>
        </div>

        <p v-if="!workbenchTeams.length" class="py-8 text-center text-sm text-gray-500">
          Drag a team here, or use Set aside on it, to work on it side by side with others.
        </p>

        <div v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div
            v-for="team in workbenchTeams"
            :key="team.id"
            draggable="true"
            :class="[
              'space-y-2 rounded-lg border bg-white p-3 text-sm dark:bg-gray-900',
              boardDropTarget === team.id
                ? 'border-primary-500 ring-2 ring-primary-500'
                : 'border-gray-200 dark:border-gray-800',
              boardDrag?.kind === 'team' && boardDrag.teamId === team.id ? 'opacity-40' : '',
            ]"
            @dragstart="onBoardDragStart($event, { kind: 'team', teamId: team.id })"
            @dragend="onBoardDragEnd"
            @dragover="onTeamDragOver($event, team.id)"
            @dragleave="boardDropTarget === team.id && (boardDropTarget = null)"
            @drop.prevent.stop="onTeamDrop(team.id)"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="font-medium">{{ team.projectName }}</div>
                <div class="text-xs text-gray-500">
                  <span :class="team.memberCount > config.max_team_size ? 'text-red-500' : ''">
                    {{ team.memberCount }}/{{ config.max_team_size }} members
                  </span>
                  ·
                  <span
                    :class="boardCount3200(team.id) < minUpperclassPerProject ? 'text-red-500' : ''"
                  >
                    {{ boardCount3200(team.id) }} × 3200
                  </span>
                </div>
              </div>
              <UBadge
                v-if="boardDrag?.kind === 'student' && canDropStudentOn(team.id)"
                :color="rankColor(boardRank(boardDrag.studentId, team.projectId))"
                variant="solid"
                size="md"
              >
                {{ rankText(boardRank(boardDrag.studentId, team.projectId)) }}
              </UBadge>
              <div v-else class="flex shrink-0 items-center gap-1">
                <UButton
                  v-if="team.memberCount > 0"
                  label="Improve"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  @click="openImprove(team.id)"
                />
                <UButton
                  v-if="team.memberCount > 0"
                  label="Lock"
                  icon="i-heroicons-lock-closed"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  :loading="lockingTeamKey === team.id"
                  @click="lockFromBoard(team.id, true)"
                />
                <UButton
                  icon="i-heroicons-x-mark"
                  aria-label="Put back"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  @click="putBack(team.id)"
                />
              </div>
            </div>

            <ul class="space-y-1">
              <li
                v-for="m in membershipsForTeam(team.id)"
                :key="m.id"
                draggable="true"
                :class="[
                  'cursor-pointer rounded border px-2 py-1 active:cursor-grabbing',
                  isPicked(m.studentId)
                    ? 'border-primary-500 ring-1 ring-primary-500'
                    : 'border-gray-100 hover:border-primary-300 dark:border-gray-800',
                  boardDrag?.kind === 'student' && boardDrag.studentId === m.studentId
                    ? 'opacity-40'
                    : '',
                ]"
                @dragstart.stop="
                  onBoardDragStart($event, {
                    kind: 'student',
                    studentId: m.studentId,
                    fromTeamId: team.id,
                  })
                "
                @dragend.stop="onBoardDragEnd"
                @click.stop="pickForCompare(m.studentId, team.id)"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="flex min-w-0 flex-wrap items-center gap-x-1">
                    <UIcon v-if="m.locked" name="i-heroicons-lock-closed" class="text-gray-400" />
                    <span>{{ m.Student.firstName }} {{ m.Student.lastName }}</span>
                    <span class="text-xs text-gray-500">· {{ majorOf(m.studentId) }}</span>
                    <UBadge v-if="boardIs3200(m.studentId)" color="neutral" variant="subtle" size="sm">
                      3200
                    </UBadge>
                  </span>
                  <span class="flex shrink-0 items-center gap-1 text-xs text-gray-500">
                    <template v-if="otherWorkbenchTeam(team.id)">here</template>
                    <UBadge
                      :color="rankColor(boardRank(m.studentId, team.projectId))"
                      variant="subtle"
                      size="sm"
                    >
                      {{ rankText(boardRank(m.studentId, team.projectId)) }}
                    </UBadge>
                    <template v-if="otherWorkbenchTeam(team.id)">
                      · there
                      <UBadge
                        :color="rankColor(boardRank(m.studentId, otherWorkbenchTeam(team.id)!.projectId))"
                        variant="subtle"
                        size="sm"
                      >
                        {{ rankText(boardRank(m.studentId, otherWorkbenchTeam(team.id)!.projectId)) }}
                      </UBadge>
                    </template>
                  </span>
                </div>
              </li>
              <li v-if="!team.memberCount" class="text-xs text-gray-400">
                No members yet. Drag students in from another Workbench team.
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div
        :class="[
          'space-y-3 rounded-lg p-3 transition-colors',
          boardDropTarget === 'grid'
            ? 'bg-primary-50 ring-1 ring-primary-500 dark:bg-primary-950/40'
            : canDropTeamOn('grid')
              ? 'ring-1 ring-primary-400'
              : '',
        ]"
        @dragover="onAreaDragOver($event, 'grid')"
        @dragleave="boardDropTarget === 'grid' && (boardDropTarget = null)"
        @drop.prevent="onAreaDrop('grid')"
      >
        <h3 class="font-medium">
          All teams <span class="font-normal text-gray-500">({{ gridTeams.length }})</span>
        </h3>
        <p v-if="!gridTeams.length" class="text-sm text-gray-500">
          Every team is on the Workbench.
        </p>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          <div
            v-for="team in gridTeams"
            :key="team.id"
            :draggable="!isTeamLocked(team.id)"
            :class="[
              'flex flex-col justify-between gap-2 rounded-lg border p-3 text-sm sm:min-h-56',
              isTeamLocked(team.id)
                ? 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/60'
                : 'cursor-grab border-gray-200 bg-white hover:border-gray-300 active:cursor-grabbing dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700',
              boardDrag?.kind === 'team' && boardDrag.teamId === team.id ? 'opacity-40' : '',
            ]"
            @dragstart="onBoardDragStart($event, { kind: 'team', teamId: team.id })"
            @dragend="onBoardDragEnd"
          >
            <div class="min-w-0 space-y-1">
              <div class="line-clamp-2 font-medium">{{ team.projectName }}</div>
              <div class="text-xs text-gray-500">
                <span :class="team.memberCount > config.max_team_size ? 'text-red-500' : ''">
                  {{ team.memberCount }}/{{ config.max_team_size }}
                </span>
                ·
                <span
                  :class="boardCount3200(team.id) < minUpperclassPerProject ? 'text-red-500' : ''"
                >
                  {{ boardCount3200(team.id) }} × 3200
                </span>
              </div>
              <ul class="space-y-0.5 text-xs">
                <li
                  v-for="m in membershipsForTeam(team.id)"
                  :key="m.id"
                  class="flex items-center justify-between gap-1"
                >
                  <span class="flex min-w-0 items-center gap-1">
                    <span class="truncate text-gray-600 dark:text-gray-400">
                      {{ m.Student.firstName }} {{ m.Student.lastName[0] }}.
                    </span>
                    <UBadge
                      v-if="boardIs3200(m.studentId)"
                      color="neutral"
                      variant="subtle"
                      size="xs"
                      class="shrink-0"
                    >
                      3200
                    </UBadge>
                  </span>
                  <UBadge
                    :color="rankColor(boardRank(m.studentId, team.projectId))"
                    variant="subtle"
                    size="sm"
                    class="shrink-0"
                  >
                    {{ rankText(boardRank(m.studentId, team.projectId)) }}
                  </UBadge>
                </li>
                <li v-if="!team.memberCount" class="text-gray-500">No members yet</li>
              </ul>
            </div>

            <div v-if="isTeamLocked(team.id)" class="flex items-center justify-between gap-1">
              <span class="flex items-center gap-1 text-xs font-medium">
                <UIcon name="i-heroicons-lock-closed" class="text-primary-500" />
                Locked
              </span>
              <UButton
                label="Unlock"
                size="xs"
                color="neutral"
                variant="ghost"
                :loading="lockingTeamKey === team.id"
                @click="lockFromBoard(team.id, false)"
              />
            </div>
            <div v-else class="flex items-center justify-between gap-1">
              <UButton
                label="Set aside"
                icon="i-heroicons-arrow-up"
                size="xs"
                color="neutral"
                variant="soft"
                @click="setAside(team.id)"
              />
              <UButton
                v-if="team.memberCount > 0"
                label="Improve"
                size="xs"
                color="neutral"
                variant="ghost"
                @click="openImprove(team.id)"
              />
              <UButton
                v-if="team.memberCount > 0"
                icon="i-heroicons-lock-closed"
                aria-label="Lock team"
                size="xs"
                color="neutral"
                variant="ghost"
                :loading="lockingTeamKey === team.id"
                @click="lockFromBoard(team.id, true)"
              />
            </div>
          </div>
        </div>
      </div>
    </section>

    <div
      class="flex items-center justify-between gap-2 border-t border-gray-200 pt-4 dark:border-gray-800"
    >
      <UButton
        v-if="activeSection > 1"
        label="Back"
        icon="i-heroicons-arrow-left"
        color="neutral"
        variant="soft"
        @click="activeSection--"
      />
      <span v-else />
      <div v-if="activeSection < STEP_COUNT" class="flex items-center gap-3">
        <span v-if="nextBlocker" class="text-sm text-gray-500">{{ nextBlocker }}</span>
        <UButton
          label="Next"
          trailing-icon="i-heroicons-arrow-right"
          :disabled="!!nextBlocker"
          @click="goNext"
        />
      </div>
    </div>
  </UContainer>
</template>
