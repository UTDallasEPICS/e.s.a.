<script setup lang="ts">
  import { downloadCsv } from '~/utils/csvExport'
  import { formatSemester, semesterOrder, titleCase } from '~/utils/labels'
  import CreateSemesterModal from '~/components/modals/CreateSemesterModal.vue'
  import type { CommandPaletteGroup, CommandPaletteItem, TableColumn } from '@nuxt/ui'
  import { MEETING_DAY_OPTIONS } from '~/utils/options'
  import type { ProjectRead } from '#server/services/projectService'
  import type { StudentRead } from '#server/services/studentService'
  import type { TeamVersionList, TeamVersionRead } from '#server/services/teamVersionService'

  type MeetingDay = 'WEDNESDAY' | 'THURSDAY'

  // ── Semester & meeting day ───────────────────────────────────────────────────

  // Where staff are on the page (semester, step, day) is kept in the URL, e.g.
  // ?semester=…&step=teams&day=thursday, so a refresh reopens the same view. The
  // initial values are read from it here; see "Keep your place" for the write side.
  const route = useRoute()
  const router = useRouter()
  const queryText = (value: unknown) => (typeof value === 'string' && value ? value : undefined)

  const semesterId = ref<string | undefined>(queryText(route.query.semester))
  const meetingDay = ref<MeetingDay>(route.query.day === 'thursday' ? 'THURSDAY' : 'WEDNESDAY')

  const { semesters, createSemester } = useSemesters()
  const semesterName = computed(() => {
    const semester = semesters.value.find((s) => s.id === semesterId.value)
    return semester ? formatSemester(semester) : ''
  })
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

  function teamsFor(day: MeetingDay) {
    return projectsForSemester.value.flatMap((project) =>
      project.Teams.filter(
        (t) => t.semesterId === semesterId.value && t.meetingDay === day
      ).map((team) => ({
        id: team.id,
        projectId: project.id,
        projectName: project.name,
        partnerName: project.Partner.name,
        memberCount: team.Memberships.length,
      }))
    )
  }
  const teamsForDay = computed(() => teamsFor(meetingDay.value))

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

  const {
    data: studentsForSemester,
    status: studentsStatus,
    refresh: refreshStudentsForSemester,
  } = useFetch<
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

  function seasonCode(season: string) {
    if (season === 'SPRING') return 'S'
    if (season === 'SUMMER') return 'U'
    if (season === 'FALL') return 'F'
    return season[0]
  }

  const CHOICE_COLUMN_COUNT = 6

  // Export works at any point, so a draft can be shared on purpose. Until the
  // day's board is a final version it asks first and names the file "(draft)",
  // and every row says whether that student is locked, so a draft can't be
  // mistaken for the final teams.
  async function exportTeams(day: MeetingDay) {
    const semester = semesters.value.find((s) => s.id === semesterId.value)
    if (!semester) return

    const isFinal = day === meetingDay.value && boardIsFinal.value
    if (
      !isFinal &&
      !(await confirm({
        title: `Version ${boardVersion.value} isn't final`,
        description:
          'These teams can still change. The file will be marked as a draft. Make a version final first to export the final teams.',
        confirmLabel: 'Export draft',
        confirmColor: 'primary',
      }))
    )
      return

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
        'Locked',
      ],
    ]

    for (const project of projectsForSemester.value) {
      const teamLabel =
        projectLabelById.get(project.id) ?? `${term} - ${project.Partner.name}: ${project.name}`

      for (const team of project.Teams) {
        // A project can run in several semesters; only this semester's team counts.
        if (team.semesterId !== semesterId.value || team.meetingDay !== day) continue

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
            membership.locked ? 'Yes' : 'No',
          ])
        }
      }
    }

    const dayLabel = day === 'WEDNESDAY' ? 'Wed' : 'Thu'
    const draft = isFinal ? '' : ' (draft)'
    downloadCsv(`${dayLabel} Teams - ${selectedSemesterLabel.value}${draft}.csv`, rows)
  }

  // ── Bid file upload ──────────────────────────────────────────────────────────

  // Each day's bid file is uploaded in its own BidDayUpload card (Bid Files step), so
  // both days can be imported without switching the meeting day.
  async function refreshAfterBidImport() {
    await Promise.all([
      refreshProjectsForSemester(),
      refreshAllProjects(),
      refreshStudentsForSemester(),
    ])
  }

  // ── Step-by-step page layout ─────────────────────────────────────────────────

  // One step on screen at a time — the others aren't rendered at all. The steps
  // run down the left rail and Next/Back sit on the right rail. Staff can always
  // go back to any step they've reached, but can only move forward with Next, and
  // Next waits until the data that step exists for is actually there (not until
  // a particular button was clicked): bids already imported on an earlier visit
  // count. Steps 1 and 2 cover both meeting days; Manage Teams (lock 3200s,
  // generate, arrange) works on one day at a time, picked with the "Working on"
  // toggle. Picking a semester jumps ahead (see selectSemester).
  const STEP_KEYS = ['semester', 'bids', 'teams', 'finalize'] as const
  const STEP_COUNT = STEP_KEYS.length
  const MANAGE_STEP = 3
  const FINALIZE_STEP = 4
  const stepFromQuery = semesterId.value
    ? Math.max(1, STEP_KEYS.indexOf(route.query.step as (typeof STEP_KEYS)[number]) + 1)
    : 1
  const activeSection = ref(stepFromQuery)
  const furthestStep = ref(stepFromQuery)
  const steps = computed(() =>
    [
      { title: 'Semester', icon: 'i-heroicons-calendar' },
      { title: 'Bid Files', icon: 'i-heroicons-arrow-up-tray' },
      { title: 'Manage Teams', icon: 'i-heroicons-squares-2x2' },
      { title: 'Finalize', icon: 'i-heroicons-flag' },
    ].map((step, i) => ({ ...step, disabled: i + 1 > furthestStep.value }))
  )

  // ── Step 1: semester table ───────────────────────────────────────────────────

  // Where each semester stands on a day, read off its teams: bid import creates
  // the (empty) teams, Generate fills them, and locking finalizes them. Staff call
  // a finalized (fully locked) team a "project" and one still being worked on a
  // "team", so the counts use those words.
  function semesterDayStatus(id: string, day: MeetingDay) {
    const teams = allProjects.value.flatMap((p) =>
      p.Teams.filter((t) => t.semesterId === id && t.meetingDay === day)
    )
    if (!teams.length) return { label: 'No bids yet', ready: false, final: false }
    const members = teams.map((t) => t.Memberships.filter((m) => !m.isMentor))
    const students = members.reduce((sum, m) => sum + m.length, 0)
    if (!students) return { label: 'Bids in, teams not built', ready: true, final: false }
    const projects = members.filter((m) => m.length && m.every((x) => x.locked)).length
    const inProgress = teams.length - projects
    const parts = [
      projects && `${projects} project${projects === 1 ? '' : 's'}`,
      inProgress && `${inProgress} team${inProgress === 1 ? '' : 's'}`,
      `${students} students`,
    ].filter(Boolean)
    return { label: parts.join(' · '), ready: true, final: !inProgress }
  }

  const semesterRows = computed(() =>
    [...semesters.value]
      .sort((a, b) => semesterOrder(b) - semesterOrder(a))
      .map((s) => ({
        id: s.id,
        name: formatSemester(s),
        WEDNESDAY: semesterDayStatus(s.id, 'WEDNESDAY'),
        THURSDAY: semesterDayStatus(s.id, 'THURSDAY'),
      }))
  )
  type SemesterRow = (typeof semesterRows.value)[number]

  const semesterColumns: TableColumn<SemesterRow>[] = [
    { accessorKey: 'name', header: 'Semester' },
    { id: 'WEDNESDAY', header: 'Wednesday' },
    { id: 'THURSDAY', header: 'Thursday' },
    { id: 'select', header: '' },
  ]

  // Picking a semester opens Bid Files so staff can check the files first. When
  // bids are already in, Manage Teams is unlocked too, one click away.
  function selectSemester(row: SemesterRow) {
    semesterId.value = row.id
    furthestStep.value = row.WEDNESDAY.ready || row.THURSDAY.ready ? MANAGE_STEP : 2
    activeSection.value = 2
  }

  // Coming back to the table, refresh it: Generate and bid imports elsewhere
  // change the counts.
  watch(activeSection, (step) => {
    if (step === 1) refreshAllProjects()
  })

  const overlay = useOverlay()
  const createSemesterModal = overlay.create(CreateSemesterModal)
  async function addSemester() {
    const semester = await createSemesterModal.open().result
    if (semester) await createSemester(semester)
  }

  // The ESA menu (Database, Team Formation, …) slides out from the ≡ button.
  const navOpen = ref(false)
  const colorMode = useColorMode()

  function bidCountFor(day: MeetingDay) {
    return studentsForSemester.value.filter(
      (s) =>
        s.Enrollments.some((e) => e.semesterId === semesterId.value && e.meetingDay === day) &&
        s.Choices.some((c) => c.semesterId === semesterId.value)
    ).length
  }
  const bidCountForDay = computed(() => bidCountFor(meetingDay.value))

  // Manage Teams' day switch: each day with its bid count.
  const dayTabs = computed(() =>
    MEETING_DAY_OPTIONS.map((d) => ({
      label: d.label,
      value: d.value,
      badge: { label: String(bidCountFor(d.value)), color: 'neutral' as const, variant: 'subtle' as const },
    }))
  )

  // Bid Files rows: a day still waiting for its file goes on top; otherwise
  // Wednesday, then Thursday.
  const bidDayOrder = computed(() =>
    [...MEETING_DAY_OPTIONS].sort(
      (a, b) => Number(bidCountFor(a.value) > 0) - Number(bidCountFor(b.value) > 0)
    )
  )

  // Start steps 3–5 on a day that actually has bids, so a Thursday-only semester
  // doesn't open on an empty Wednesday.
  watch(
    () => [semesterId.value, bidCountFor('WEDNESDAY'), bidCountFor('THURSDAY')] as const,
    ([, wed, thu]) => {
      if (!bidCountForDay.value && (wed || thu)) meetingDay.value = wed ? 'WEDNESDAY' : 'THURSDAY'
    }
  )
  const teamsHaveMembers = computed(() => teamsForDay.value.some((t) => t.memberCount > 0))

  // True once any team on either day has a student on it, so Finalize has something to review.
  const anyTeamBuilt = computed(() =>
    projectsForSemester.value.some((p) =>
      p.Teams.some((t) => t.semesterId === semesterId.value && t.Memberships.some((m) => !m.isMentor))
    )
  )

  // Why Next is blocked on the current step, or null when it's free to go.
  const nextBlocker = computed(() => {
    if (activeSection.value === 1 && !semesterId.value) return 'Pick a semester first.'
    if (activeSection.value === 2 && !bidCountFor('WEDNESDAY') && !bidCountFor('THURSDAY'))
      return 'Upload a bid file first.'
    if (activeSection.value === MANAGE_STEP && !anyTeamBuilt.value) return 'Build teams first.'
    return null
  })

  function goNext() {
    if (nextBlocker.value || activeSection.value >= STEP_COUNT) return
    activeSection.value++
    furthestStep.value = Math.max(furthestStep.value, activeSection.value)
  }

  // A link to a semester that's gone (deleted, or another database) falls back to
  // the semester table instead of an empty page. Checked once mounted, so the
  // server's render and the browser's first render still match.
  onMounted(() =>
    watch(
      semesters,
      (list) => {
        if (list?.length && semesterId.value && !list.some((s) => s.id === semesterId.value)) {
          semesterId.value = undefined
          activeSection.value = furthestStep.value = 1
        }
      },
      { immediate: true }
    )
  )

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

  // A student with no bid gets one project written in as their Choice 1 at import
  // (server/utils/noBid.ts), so the solver places them by major. That's a placement,
  // not a preference, so everywhere on this page they read as having no choices.
  const NO_BID_TAG = '[No bid]'
  function isNoBid(student: StudentRead | undefined) {
    return !!student?.Enrollments.find(
      (e) => e.semesterId === semesterId.value
    )?.comments.startsWith(NO_BID_TAG)
  }

  function bidChoicesFor(student: StudentRead | undefined) {
    if (!student || isNoBid(student)) return []
    return student.Choices.filter((c) => c.semesterId === semesterId.value)
  }

  function choiceLabelsFor(student: StudentRead) {
    return bidChoicesFor(student)
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
        'Regenerate will leave them where they are.',
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
        "They stay on the team they're on now, just no longer locked, so Regenerate can " +
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
        skillTieBreak?: SkillTieBreakInfo
      }>('/api/team-formation/suggest-locks', {
        method: 'POST',
        body: {
          semesterId: semesterId.value,
          day: meetingDay.value,
          maxTeamSize: config.max_team_size,
          maxUpperclassPerProject: maxUpperclassPerProject.value,
          skillProvider: skillProvider.value,
        },
      })
      for (const key of Object.keys(suggestions)) delete suggestions[key]
      for (const p of result.placements) {
        lockSelections[p.studentId] = p.teamId
        suggestions[p.studentId] = { teamId: p.teamId, reason: reasonFor(p) }
      }
      noChoiceStudentIds.value = new Set(result.noChoicesStudentIds)
      usedFallbackThirdChoice.value = result.usedFallbackThirdChoice
      lastSkillTieBreak.value = result.skillTieBreak ?? null
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

  // Optional Gemini skill tie-break. Off unless the server has a GEMINI_API_KEY and staff switch it
  // on under ⚙ → Skill tie-break. With it off (the default) skill fit is the local, fixed-rule TF-IDF.
  const geminiAvailable = ref(false)
  const geminiModelName = ref('')
  const useGemini = ref(false)
  // What the last Regenerate / 3200 suggestion actually did with Gemini, so a silent fall-back to the
  // built-in score is never a surprise.
  interface SkillTieBreakInfo {
    provider: 'tfidf' | 'gemini'
    model: string | null
    contestedProjects: number
    projectsScored: number
    studentsScored: number
    projectsFellBack: string[]
    error: string | null
  }
  const lastSkillTieBreak = ref<SkillTieBreakInfo | null>(null)
  const geminiTest = reactive<{ running: boolean; ok: boolean | null; message: string }>({
    running: false,
    ok: null,
    message: '',
  })
  async function testGemini() {
    geminiTest.running = true
    geminiTest.ok = null
    geminiTest.message = ''
    try {
      const r = await $fetch<{ ok: boolean; model: string; message: string; ms?: number }>(
        '/api/team-formation/gemini-test',
        { method: 'POST' }
      )
      geminiTest.ok = r.ok
      geminiTest.message = r.ok ? `${r.message} (${r.model}, ${r.ms} ms)` : `${r.message} (model: ${r.model})`
    } catch (e: any) {
      geminiTest.ok = false
      geminiTest.message = e?.data?.message ?? e?.message ?? 'Could not reach the server.'
    } finally {
      geminiTest.running = false
    }
  }
  const skillTieBreakSummary = computed(() => {
    const i = lastSkillTieBreak.value
    if (!i || i.provider !== 'gemini' && !i.error) return null
    if (i.contestedProjects === 0) return 'Gemini was on, but no project had more students than seats, so nothing needed scoring.'
    if (i.projectsScored === 0) return `Gemini was on but could not score anyone, so the built-in skill score was used.${i.error ? ` ${i.error}` : ''}`
    const base = `Gemini scored ${i.studentsScored} students across ${i.projectsScored} contested project${i.projectsScored === 1 ? '' : 's'}.`
    return i.projectsFellBack.length
      ? `${base} ${i.projectsFellBack.length} used the built-in score instead (${i.projectsFellBack.join(', ')}).${i.error ? ` ${i.error}` : ''}`
      : base
  })
  const skillProvider = computed(() => (useGemini.value && geminiAvailable.value ? 'gemini' : 'tfidf'))
  onMounted(async () => {
    try {
      const info = await $fetch<{ geminiAvailable: boolean; defaultProvider: string; model?: string }>(
        '/api/team-formation/skill-provider'
      )
      geminiAvailable.value = info.geminiAvailable
      geminiModelName.value = info.model ?? ''
      useGemini.value = info.geminiAvailable && info.defaultProvider === 'gemini'
    } catch {
      // Leave it off if the server can't say.
    }
  })

  // Tie-break report (who is competing for each project, and why the order is what it is).
  const tieBreakOpen = ref(false)

  const generating = ref(false)
  const generateError = ref<string | null>(null)
  const generated = ref(false)
  // Where each no-bid student ended up after the last run, and whether the solver
  // kept the project the importer placed them on.
  const noBidResults = ref<
    {
      id: string
      name: string
      netID: string
      major: string
      placedProject: string | null
      assignedProject: string | null
    }[]
  >([])
  watch([semesterId, meetingDay], () => (noBidResults.value = []))
  const noBidMovedCount = computed(
    () => noBidResults.value.filter((p) => p.assignedProject !== p.placedProject).length
  )
  const noBidSummary = computed(() => {
    const n = noBidResults.value.length
    const moved = noBidMovedCount.value
    const who = `${n} no-bid student${n === 1 ? '' : 's'}`
    if (!moved) return `${who} · ${n === 1 ? 'kept their' : 'all kept their'} placement`
    return `${who} · ${moved} moved from their placement`
  })

  const canGenerate = computed(() => !!semesterId.value && teamsForDay.value.length > 0)

  async function generateTeams() {
    if (!canGenerate.value || !semesterId.value) return
    generating.value = true
    generateError.value = null
    generated.value = false
    try {
      const result = await $fetch('/api/team-formation/generate', {
        method: 'POST',
        body: {
          semesterId: semesterId.value,
          day: meetingDay.value,
          skillProvider: skillProvider.value,
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
        refreshVersions(),
      ])
      noBidResults.value = result.noBidPlacements
      lastSkillTieBreak.value = result.skillTieBreak ?? null
      generated.value = true
    } catch (e: any) {
      generateError.value = e?.data?.message ?? e?.message ?? 'Team generation failed.'
    } finally {
      generating.value = false
    }
  }

  // Opening Manage Teams on a day that has bids but no students on any team yet
  // builds the teams straight away with the settings above. A day that already
  // has students on a team (even just locked 3200s) is left alone, so this never
  // undoes anyone's work. Each semester/day is tried once per visit, so a failed
  // run shows its error instead of retrying in a loop. Waits for both fetches to
  // finish so it never acts on the previous semester's data.
  // ⚙ Team settings popup. Regenerate closes it so the board, and the
  // "Teams generated" notice above it, are in view while the new teams come in.
  const settingsOpen = ref(false)
  function regenerate() {
    settingsOpen.value = false
    generateTeams()
  }

  // ── Versions (the VL button) ─────────────────────────────────────────────────
  // The board is always the version being worked on, and every move saves as it
  // happens. "Save as Version N" freezes a copy and starts N + 1. Going back to an
  // older version (and Regenerate) saves the board first, so nothing is lost.
  const versionList = ref<TeamVersionList | null>(null)
  const versionBusy = ref(false)
  const versionError = ref<string | null>(null)

  // A refresh can open straight on a semester (see "Keep your place"), so this first
  // runs during server rendering — useRequestFetch passes the login cookie along.
  const requestFetch = useRequestFetch()
  async function refreshVersions() {
    if (!semesterId.value) return (versionList.value = null)
    versionList.value = await requestFetch<TeamVersionList>('/api/team-formation/versions', {
      query: { semesterId: semesterId.value, meetingDay: meetingDay.value },
    })
  }
  watch([semesterId, meetingDay], refreshVersions, { immediate: true })

  async function saveVersion() {
    versionBusy.value = true
    versionError.value = null
    try {
      await $fetch('/api/team-formation/versions', {
        method: 'POST',
        body: {
          semesterId: semesterId.value,
          meetingDay: meetingDay.value,
          note: newVersionNote.value,
        },
      })
      newVersionNote.value = ''
      await refreshVersions()
    } catch (e: any) {
      versionError.value = e?.data?.message ?? e?.message ?? 'Failed to save the version.'
    } finally {
      versionBusy.value = false
    }
  }

  async function restoreVersion(version: TeamVersionRead) {
    const ok = await confirm({
      title: `Go back to Version ${version.number}?`,
      description: 'The board is saved as a version first, so you can come back to it.',
      confirmLabel: `Go back to Version ${version.number}`,
    })
    if (!ok) return
    versionBusy.value = true
    versionError.value = null
    try {
      await $fetch('/api/team-formation/versions/restore', {
        method: 'POST',
        body: { id: version.id },
      })
      generated.value = false
      noBidResults.value = []
      await Promise.all([
        refreshVersions(),
        refreshProjectsForSemester(),
        refreshAllProjects(),
        refreshStudentsForSemester(),
      ])
    } catch (e: any) {
      versionError.value = e?.data?.message ?? e?.message ?? 'Failed to go back to that version.'
    } finally {
      versionBusy.value = false
    }
  }

  // One version per day can be final: making it final puts it on the board with
  // every team locked, so they all become projects. "Not final" puts back the
  // locks that version had (see teamVersionService.markFinal).
  async function setFinal(version: TeamVersionRead, final: boolean) {
    const ok = await confirm(
      final
        ? {
            title: `Make Version ${version.number} final?`,
            description: version.matchesBoard
              ? 'Every team is locked, so they all become projects.'
              : `Version ${version.number} goes on the board and every team is locked, so they all become projects. The board is saved as a version first.`,
            confirmLabel: 'Make final',
            confirmColor: 'success',
          }
        : {
            title: `Version ${version.number} not final?`,
            description: 'Teams go back to the locks they had before it was made final.',
            confirmLabel: 'Not final',
            confirmColor: 'neutral',
          }
    )
    if (!ok) return
    versionBusy.value = true
    versionError.value = null
    try {
      await $fetch('/api/team-formation/versions/final', {
        method: 'POST',
        body: { id: version.id, final },
      })
      generated.value = false
      noBidResults.value = []
      workbenchTeamIds.value = []
      await Promise.all([
        refreshVersions(),
        refreshProjectsForSemester(),
        refreshAllProjects(),
        refreshStudentsForSemester(),
      ])
    } catch (e: any) {
      versionError.value = e?.data?.message ?? e?.message ?? 'Failed to update the final version.'
    } finally {
      versionBusy.value = false
    }
  }

  // Finalize step buttons. Making the board final saves it as a version first when it isn't
  // one yet (so it can always be undone), then reuses setFinal for the confirm + lock.
  async function finalizeBoard() {
    if (!boardIsSaved.value) {
      await saveVersion()
      if (versionError.value) return
    }
    const version = versionList.value?.versions.find((v) => v.matchesBoard)
    if (version) await setFinal(version, true)
  }
  async function undoFinalBoard() {
    const version = versionList.value?.versions.find((v) => v.isFinal && v.matchesBoard)
    if (version) await setFinal(version, false)
  }

  // The version history window: save the board with an optional description,
  // rename saved versions, and go back to one.
  const versionsOpen = ref(false)
  const newVersionNote = ref('')
  const editingVersionId = ref<string | null>(null)
  const editingNote = ref('')

  // The version the board is on: a saved one when the board matches it exactly
  // (e.g. right after going back, or a Regenerate that changed nothing), otherwise
  // the unsaved working version.
  const boardVersion = computed(
    () =>
      versionList.value?.versions.find((v) => v.matchesBoard)?.number ??
      versionList.value?.working ??
      1
  )
  const boardIsSaved = computed(() => !!versionList.value?.versions.some((v) => v.matchesBoard))
  const boardIsFinal = computed(
    () => !!versionList.value?.versions.some((v) => v.matchesBoard && v.isFinal)
  )

  function startDescribe(version: TeamVersionRead) {
    editingVersionId.value = version.id
    editingNote.value = version.note
  }

  async function describeVersion() {
    const id = editingVersionId.value
    const note = editingNote.value.trim()
    editingVersionId.value = null
    if (!id || !note) return
    versionError.value = null
    try {
      await $fetch(`/api/team-formation/versions/${id}`, { method: 'PATCH', body: { note } })
      await refreshVersions()
    } catch (e: any) {
      versionError.value = e?.data?.message ?? e?.message ?? 'Failed to save the description.'
    }
  }

  async function deleteVersion(version: TeamVersionRead) {
    const ok = await confirm({
      title: `Delete Version ${version.number}?`,
      description: version.matchesBoard
        ? 'The board stays as it is. It just stops being saved as this version.'
        : "This can't be undone.",
      confirmLabel: 'Delete',
    })
    if (!ok) return
    versionError.value = null
    try {
      await $fetch(`/api/team-formation/versions/${version.id}`, { method: 'DELETE' })
      await refreshVersions()
    } catch (e: any) {
      versionError.value = e?.data?.message ?? e?.message ?? 'Failed to delete the version.'
    }
  }

  function formatVersionTime(date: string | Date) {
    return new Date(date).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const autoGenerated = reactive(new Set<string>())
  const autoGenerating = ref(false)
  const dayHasStudents = computed(() =>
    teamsForDay.value.some((t) => membershipsForTeam(t.id).length > 0)
  )
  watch(
    () =>
      activeSection.value === 3 &&
      projectsStatus.value === 'success' &&
      studentsStatus.value === 'success' &&
      canGenerate.value &&
      bidCountForDay.value > 0 &&
      !dayHasStudents.value &&
      !generating.value &&
      !autoGenerated.has(`${semesterId.value}:${meetingDay.value}`),
    async (shouldRun) => {
      if (!shouldRun) return
      autoGenerated.add(`${semesterId.value}:${meetingDay.value}`)
      autoGenerating.value = true
      await generateTeams()
      autoGenerating.value = false
    },
    { immediate: true }
  )

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

  // Restored from the URL (?bench=id,id) so a refresh brings the same teams back up.
  const workbenchTeamIds = ref<string[]>(queryText(route.query.bench)?.split(',') ?? [])
  watch([semesterId, meetingDay], () => (workbenchTeamIds.value = []))

  // ── Keep your place ──────────────────────────────────────────────────────────
  // Board moves already save as they happen; this writes the view itself back to
  // the URL (replace, so Back in the browser isn't filled with every click). The
  // day and the Workbench teams only matter on Manage Teams, so they're left off
  // elsewhere. Together with the saved moves, a refresh mid-edit loses nothing.
  const URL_KEYS = ['semester', 'step', 'day', 'bench']
  watch(
    [semesterId, activeSection, meetingDay, workbenchTeamIds],
    () => {
      const query = { ...route.query }
      for (const k of URL_KEYS) delete query[k]
      if (semesterId.value) {
        query.semester = semesterId.value
        query.step = STEP_KEYS[activeSection.value - 1]
        if (activeSection.value >= MANAGE_STEP) {
          query.day = meetingDay.value.toLowerCase()
          if (activeSection.value === MANAGE_STEP && workbenchTeamIds.value.length)
            query.bench = workbenchTeamIds.value.join(',')
        }
      }
      const same = URL_KEYS.every((k) => query[k] === route.query[k])
      if (!same) router.replace({ query })
    },
    { immediate: true }
  )

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
  // Spotlight: with one student clicked, the teams they ranked move to the front
  // of All teams in their order (1st choice first) and the rest fade back.
  const spotlightRanks = computed(() => {
    if (comparePicks.value.length !== 1) return null
    const student = studentById.value.get(comparePicks.value[0]!.studentId)
    return new Map(bidChoicesFor(student).map((c) => [c.projectId, c.rank]))
  })
  const gridTeams = computed(() => {
    const rankOf = (projectId: string) => spotlightRanks.value?.get(projectId) ?? Infinity
    return teamsForDay.value
      .filter((t) => !onWorkbench(t.id))
      .sort(
        (a, b) =>
          rankOf(a.projectId) - rankOf(b.projectId) ||
          Number(isTeamLocked(a.id)) - Number(isTeamLocked(b.id))
      )
  })

  // ── Search (⌘K) ─────────────────────────────────────────────────────────────
  // A quick finder like Obsidian's: fuzzy-match any team or student on this day.
  // Picking a team brings it up to the Workbench; picking a student also selects
  // them, so their preferences bar and spotlight show at once. Locked teams can't
  // go on the Workbench, so their card is scrolled to and flashed instead.
  const searchOpen = ref(false)
  const workbenchEl = ref<HTMLElement | null>(null)
  const flashTeamId = ref<string | null>(null)

  defineShortcuts({
    meta_k: () => {
      if (activeSection.value === 3 && dayHasStudents.value) searchOpen.value = !searchOpen.value
    },
  })

  function showTeam(teamId: string) {
    searchOpen.value = false
    if (isTeamLocked(teamId)) {
      flashTeamId.value = teamId
      nextTick(() =>
        document
          .getElementById(`team-card-${teamId}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      )
      setTimeout(() => flashTeamId.value === teamId && (flashTeamId.value = null), 1600)
      return
    }
    setAside(teamId)
    nextTick(() => workbenchEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function showStudent(studentId: string, teamId: string) {
    showTeam(teamId)
    if (!isTeamLocked(teamId)) comparePicks.value = [{ studentId, teamId }]
  }

  // Obsidian-style matching: the typed letters must appear in order, gaps allowed
  // ("lthr" finds "Leather"). Hits at the start of a word, and runs of letters in a
  // row, score higher, so the most likely result comes first. Null means no match.
  const searchTerm = ref('')
  watch(searchOpen, (open) => open && (searchTerm.value = ''))
  function fuzzyScore(query: string, text: string): number | null {
    const q = query.toLowerCase().replace(/\s+/g, '')
    const t = text.toLowerCase()
    let from = 0
    let prev = -2
    let score = 0
    for (const ch of q) {
      const i = t.indexOf(ch, from)
      if (i < 0) return null
      score += 1
      if (i === prev + 1) score += 3
      if (i === 0) score += 5
      else if (/[\s\-(.]/.test(t[i - 1]!)) score += 2
      prev = i
      from = i + 1
    }
    return score - t.length * 0.01
  }

  type SearchItem = CommandPaletteItem & { keys: string[] }
  function topMatches(items: SearchItem[], limit: number) {
    const query = searchTerm.value.trim()
    if (!query) return { items: items.slice(0, limit), best: 0 }
    const ranked = items
      .map((item) => ({
        item,
        score: Math.max(...item.keys.map((k) => fuzzyScore(query, k) ?? -Infinity)),
      }))
      .filter((r) => r.score > -Infinity)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
    return { items: ranked.map((r) => r.item), best: ranked[0]?.score ?? -Infinity }
  }

  const searchTeams = computed<SearchItem[]>(() =>
    teamsForDay.value.map((t) => ({
        label: t.projectName,
        suffix: `${isTeamLocked(t.id) ? 'Project · ' : ''}${membershipsForTeam(t.id).length} students`,
        icon: isTeamLocked(t.id) ? 'i-heroicons-lock-closed' : 'i-heroicons-squares-2x2',
        keys: [t.projectName],
        onSelect: () => showTeam(t.id),
      }))
  )
  const searchStudents = computed<SearchItem[]>(() =>
    teamsForDay.value.flatMap((t) =>
      membershipsForTeam(t.id).map((m) => ({
        label: `${m.Student.firstName} ${m.Student.lastName}`,
        suffix: t.projectName,
        icon: 'i-heroicons-user',
        keys: [`${m.Student.firstName} ${m.Student.lastName}`, m.Student.netID],
        onSelect: () => showStudent(m.studentId, t.id),
      }))
    )
  )
  // The section holding the best match goes first, so Enter picks the likeliest
  // result. ignoreFilter: the palette's own matching is off; topMatches does it.
  const searchGroups = computed<CommandPaletteGroup<CommandPaletteItem>[]>(() => {
    const teams = topMatches(searchTeams.value, 6)
    const students = searchTerm.value.trim()
      ? topMatches(searchStudents.value, 8)
      : { items: [], best: -Infinity }
    return [
      { id: 'teams', label: 'Teams', ignoreFilter: true, ...teams },
      { id: 'students', label: 'Students', ignoreFilter: true, ...students },
    ]
      .filter((g) => g.items.length)
      .sort((a, b) => b.best - a.best)
  })

  // A pill in the preferences bar brings that choice's team up to the Workbench.
  function bringUpProject(projectId: string) {
    const team = teamsForDay.value.find((t) => t.projectId === projectId)
    if (team) setAside(team.id)
  }

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

  // One student's padlock on the Workbench, for anyone, 3200 or not. Generate Teams
  // leaves a locked student where they are. Both ways go through the lock route
  // with their current team, so unlocking keeps them on it (the DELETE route would
  // take them off). Locking the last open student locks the whole team, which then
  // goes back to the grid like the team Lock button.
  const lockingStudentKey = ref<string | null>(null)
  async function toggleStudentLock(studentId: string, teamId: string, locked: boolean) {
    lockingStudentKey.value = studentId
    teamLockError.value = null
    try {
      await $fetch('/api/team-formation/lock', {
        method: 'POST',
        body: { teamId, studentId, locked, replaceLocked: true },
      })
      await Promise.all([refreshProjectsForSemester(), refreshStudentsForSemester()])
      if (isTeamLocked(teamId)) putBack(teamId)
    } catch (e: any) {
      teamLockError.value = e?.data?.message ?? e?.message ?? 'Failed to update student lock.'
    } finally {
      lockingStudentKey.value = null
    }
  }

  const studentById = computed(() => new Map(studentsForSemester.value.map((s) => [s.id, s])))

  function boardRank(studentId: string, projectId: string) {
    return bidChoicesFor(studentById.value.get(studentId)).find((c) => c.projectId === projectId)
      ?.rank
  }

  function boardIs3200(studentId: string) {
    const enrollment = studentById.value
      .get(studentId)
      ?.Enrollments.find((e) => e.semesterId === semesterId.value)
    return enrollment?.class === 'EPCS_3200'
  }

  function boardIsNoBid(studentId: string) {
    return isNoBid(studentById.value.get(studentId))
  }

  function boardCount3200(teamId: string) {
    return membershipsForTeam(teamId).filter((m) => boardIs3200(m.studentId)).length
  }

  // 3200 view: the cards in All teams list only their 3200 students, with a count
  // of everyone else, so the whole board can be scanned for 3200 coverage at once.
  // The Workbench keeps full rosters, since that's where students get moved.
  const only3200 = ref(false)
  function cardMembers(teamId: string, projectId: string) {
    const members = membershipsForTeam(teamId)
    if (only3200.value) return members.filter((m) => boardIs3200(m.studentId))
    if (notTop3.value) return members.filter((m) => isOffChoice(m.studentId, projectId))
    return members
  }

  // "Not top 3" view (mentor's idea): the cards list only students who aren't on
  // one of their top three picks (4th or lower, unranked, or no bid), and cards
  // with none of them fade back. Works like the 3200 view; only one is on at a time.
  const notTop3 = ref(false)
  function isOffChoice(studentId: string, projectId: string) {
    const rank = boardRank(studentId, projectId)
    return !rank || rank > 3
  }
  function offChoiceCountFor(team: { id: string; projectId: string }) {
    return membershipsForTeam(team.id).filter((m) => isOffChoice(m.studentId, team.projectId))
      .length
  }
  const offChoiceCount = computed(() =>
    teamsForDay.value.reduce((sum, t) => sum + offChoiceCountFor(t), 0)
  )
  function toggleCardView(view: '3200' | 'top3') {
    only3200.value = view === '3200' && !only3200.value
    notTop3.value = view === 'top3' && !notTop3.value
  }

  // Card warnings (mentor's idea): a team that's too small, too big, or short on
  // 3200s gets a ⚠ with the reasons. An empty team is a project nobody is on, so
  // it isn't flagged.
  function teamWarnings(teamId: string) {
    const size = membershipsForTeam(teamId).length
    if (!size) return []
    const warnings: string[] = []
    if (size < config.min_team_size) warnings.push(`Too small: ${size} of at least ${config.min_team_size}`)
    if (size > config.max_team_size) warnings.push(`Too big: ${size}, max ${config.max_team_size}`)
    const count3200 = boardCount3200(teamId)
    if (!count3200) warnings.push('No 3200 student')
    else if (count3200 < minUpperclassPerProject.value)
      warnings.push(`Only ${count3200} × 3200, needs ${minUpperclassPerProject.value}`)
    return warnings
  }
  function sizeWarn(teamId: string) {
    const size = membershipsForTeam(teamId).length
    return size > 0 && (size < config.min_team_size || size > config.max_team_size)
  }
  function warn3200(teamId: string) {
    return membershipsForTeam(teamId).length > 0 && boardCount3200(teamId) < minUpperclassPerProject.value
  }
  const warnedTeamCount = computed(() => teamsForDay.value.filter((t) => teamWarnings(t.id).length).length)

  function rankText(rank: number | undefined) {
    return rank ? ordinal(rank) : 'not ranked'
  }

  // Rank colour says how good a fit is: blue for 1st/2nd, amber for 3rd, grey for
  // anything lower or unranked. Red and green are kept for lock status (red locked,
  // green unlocked), so the two never read as the same thing.
  function rankColor(rank: number | undefined) {
    if (rank && rank <= 2) return 'info'
    if (rank === 3) return 'warning'
    return 'neutral'
  }

  // The student's full ranking, with Workbench teams flagged so staff can see at a
  // glance which of their preferences are actually on the table right now.
  function boardChoiceList(studentId: string) {
    const student = studentById.value.get(studentId)
    if (!student) return []
    const workbenchProjectIds = new Set(workbenchTeams.value.map((t) => t.projectId))
    return bidChoicesFor(student)
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
    return bidChoicesFor(studentById.value.get(studentId))
      .sort((a, b) => a.rank - b.rank)
      .map((c) => ({
        rank: c.rank,
        projectId: c.projectId,
        name: allProjects.value.find((p) => p.id === c.projectId)?.name ?? 'Unknown project',
        inPlay: projectIds.has(c.projectId),
      }))
  }

  // "Their Pref." from the whiteboard sketch: with exactly one student clicked, their
  // top four choices sit in a bar pinned under the toolbar, the one they're on now
  // marked, so their wishes stay in view while scrolling the board.
  const prefBar = computed(() => {
    if (comparePicks.value.length !== 1) return null
    const pick = comparePicks.value[0]!
    const student = studentById.value.get(pick.studentId)
    if (!student) return null
    const currentProjectId = teamById(pick.teamId)?.projectId
    return {
      name: `${student.firstName} ${student.lastName}`,
      choices: compareChoices(pick.studentId, workbenchTeamIds.value)
        .slice(0, 4)
        .map((c) => ({ ...c, current: c.projectId === currentProjectId })),
    }
  })

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
    const choices = bidChoicesFor(studentById.value.get(studentId))
      .filter((c) => c.rank < hereCost)
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
  <!-- On phones the two rails turn into a top bar (steps) and a bottom bar (back/next). -->
  <div class="flex min-h-screen flex-col sm:flex-row">
    <nav
      class="sticky top-0 z-30 flex shrink-0 items-center gap-3 print:hidden border-b border-gray-200 bg-default px-3 py-2 sm:h-screen sm:w-24 sm:flex-col sm:gap-6 sm:border-r sm:border-b-0 sm:px-0 sm:py-4 dark:border-gray-800"
      aria-label="Team formation steps"
    >
      <UButton
        icon="i-heroicons-bars-3"
        color="neutral"
        variant="ghost"
        size="lg"
        aria-label="Open menu"
        @click="navOpen = true"
      />
      <ol class="flex items-center sm:flex-col">
        <li v-for="(step, i) in steps" :key="step.title" class="flex items-center sm:flex-col">
          <div
            v-if="i > 0"
            :class="[
              'mx-1 h-0.5 w-4 sm:mx-0 sm:my-1 sm:h-10 sm:w-0.5',
              i + 1 <= furthestStep ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-800',
            ]"
          />
          <button
            type="button"
            :disabled="step.disabled"
            :aria-current="activeSection === i + 1 ? 'step' : undefined"
            class="group flex flex-col items-center gap-1 rounded-md p-1"
            @click="activeSection = i + 1"
          >
            <span
              :class="[
                'flex size-8 items-center justify-center rounded-full border-2 transition-colors sm:size-10',
                activeSection === i + 1
                  ? 'border-primary-500 bg-primary-500 text-white'
                  : step.disabled
                    ? 'border-gray-200 text-gray-300 dark:border-gray-800 dark:text-gray-700'
                    : 'border-primary-500 text-primary-500 group-hover:bg-primary-50 dark:group-hover:bg-primary-950',
              ]"
            >
              <UIcon :name="step.icon" class="size-4 sm:size-5" />
            </span>
            <span
              :class="[
                'text-center text-xs leading-tight',
                activeSection === i + 1
                  ? 'font-semibold text-primary-600 dark:text-primary-400'
                  : step.disabled
                    ? 'text-gray-400 dark:text-gray-600'
                    : 'text-gray-600 dark:text-gray-300',
              ]"
            >
              {{ step.title }}
            </span>
          </button>
        </li>
      </ol>
    </nav>

    <USlideover v-model:open="navOpen" side="left" title="ESA" class="max-w-64">
      <template #body>
        <div class="flex flex-col gap-2">
          <Navbar orientation="vertical" />
          <UButton
            :icon="colorMode.value === 'dark' ? 'i-heroicons-moon-20-solid' : 'i-heroicons-sun-20-solid'"
            :label="colorMode.value === 'dark' ? 'Dark mode' : 'Light mode'"
            color="neutral"
            variant="ghost"
            @click="colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'"
          />
        </div>
      </template>
    </USlideover>

  <UContainer
    :class="[
      'min-w-0 flex-1',
      activeSection === 3
        ? 'max-w-none space-y-3 py-3'
        : activeSection === 4
          ? 'max-w-6xl space-y-8 py-8'
          : 'max-w-4xl space-y-8 py-8',
    ]"
  >
    <section v-if="activeSection === 1" class="space-y-4">
      <h2 class="flex items-center gap-1.5 text-lg font-semibold">
        1. Semester
        <InfoTip
          text="Click a semester to work on it. A team is still being worked on. Once it's locked, it's a project. A red lock means every team that day is locked."
        />
      </h2>

      <UTable
        :data="semesterRows"
        :columns="semesterColumns"
        :loading="!semesters.length"
        class="rounded-lg border border-gray-200 dark:border-gray-800"
        :ui="{ tr: 'cursor-pointer' }"
        @select="(_e: Event, row: any) => selectSemester(row.original)"
      >
        <template #name-cell="{ row }">
          <span :class="row.original.id === semesterId ? 'font-semibold text-primary-600 dark:text-primary-400' : 'font-medium'">
            {{ row.original.name }}
          </span>
        </template>
        <template v-for="day in MEETING_DAY_OPTIONS" :key="day.value" #[`${day.value}-cell`]="{ row }">
          <span
            :class="
              row.original[day.value].final
                ? 'font-semibold'
                : row.original[day.value].ready
                  ? ''
                  : 'text-gray-400 dark:text-gray-500'
            "
          >
            <UIcon
              v-if="row.original[day.value].final"
              name="i-heroicons-lock-closed"
              class="me-1 align-[-2px] text-red-500"
            />
            {{ row.original[day.value].label }}
          </span>
        </template>
        <template #select-cell="{ row }">
          <div class="text-right">
            <UButton
              :label="row.original.id === semesterId ? 'Selected' : 'Select'"
              size="sm"
              :variant="row.original.id === semesterId ? 'solid' : 'soft'"
              @click.stop="selectSemester(row.original)"
            />
          </div>
        </template>
      </UTable>

      <UButton
        label="Add semester"
        icon="i-heroicons-plus"
        color="neutral"
        variant="soft"
        @click="addSemester"
      />
    </section>

    <section v-if="activeSection === 2" class="space-y-4">
      <h2 class="flex items-center gap-1.5 text-lg font-semibold">
        2. Bid Files
        <InfoTip text="One file per day. Click a row to see the file, or ↻ to replace it." />
      </h2>

      <p v-if="!semesterId" class="text-sm text-gray-500">Pick a semester first.</p>

      <div class="space-y-3">
        <BidDayUpload
          v-for="day in bidDayOrder"
          :key="`${semesterId}-${day.value}`"
          :semester-id="semesterId"
          :meeting-day="day.value"
          :saved-count="bidCountFor(day.value)"
          @imported="refreshAfterBidImport"
        />
      </div>
    </section>

    <div v-if="activeSection === 3" class="flex flex-wrap items-center gap-2">
      <h2 class="flex items-center gap-1.5 text-lg font-semibold">
        3. Manage Teams
        <InfoTip
          text="Bring teams up to the Workbench and drag students between them. Click a student to see their choices, then click someone on another team to try a swap. Nothing moves until you confirm."
        />
      </h2>
      <!-- Toolbar from the whiteboard sketch: 3200 view, versions, then ⚙. -->
      <div class="ms-auto flex flex-wrap items-center gap-2">
        <UButton
          v-if="dayHasStudents"
          label="Search"
          icon="i-heroicons-magnifying-glass"
          color="neutral"
          variant="soft"
          title="Find a team or student"
          @click="searchOpen = true"
        >
          <template #trailing>
            <UKbd value="meta" size="sm" class="hidden sm:inline-flex" />
            <UKbd value="K" size="sm" class="-ms-1 hidden sm:inline-flex" />
          </template>
        </UButton>
        <UButton
          v-if="dayHasStudents"
          label="3200"
          :icon="only3200 ? 'i-heroicons-eye' : 'i-heroicons-eye-slash'"
          :color="only3200 ? 'primary' : 'neutral'"
          :variant="only3200 ? 'solid' : 'soft'"
          :aria-pressed="only3200"
          title="Show only 3200 students on each card"
          @click="toggleCardView('3200')"
        />
        <UButton
          v-if="dayHasStudents"
          :label="`Not top 3 · ${offChoiceCount}`"
          icon="i-heroicons-funnel"
          :color="notTop3 ? 'primary' : 'neutral'"
          :variant="notTop3 ? 'solid' : 'soft'"
          :aria-pressed="notTop3"
          title="Show only students who aren't on one of their top 3 picks"
          @click="toggleCardView('top3')"
        />
        <UButton
          v-if="dayHasStudents"
          label="Tie-breaks"
          icon="i-heroicons-scale"
          color="neutral"
          variant="soft"
          title="Who is competing for each project, and why the order is what it is"
          @click="tieBreakOpen = true"
        />
        <UButton
          v-if="versionList && (dayHasStudents || versionList.versions.length)"
          :label="boardIsFinal ? `Version ${boardVersion} · Final` : `Version ${boardVersion}`"
          :icon="boardIsFinal ? 'i-heroicons-check-badge' : 'i-heroicons-clock'"
          :color="boardIsFinal ? 'success' : 'neutral'"
          variant="soft"
          title="Version history"
          :loading="versionBusy"
          @click="versionsOpen = true"
        />
        <UButton
          icon="i-heroicons-cog-6-tooth"
          color="neutral"
          variant="soft"
          aria-label="Team settings"
          title="Team settings"
          @click="settingsOpen = true"
        />
      </div>
    </div>

    <div
      v-if="activeSection === 3 && prefBar"
      class="sticky top-0 z-20 -mx-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-primary-500/40 bg-white/90 px-4 py-3 shadow-sm backdrop-blur dark:bg-gray-900/90"
    >
      <div class="min-w-0">
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Their preferences</p>
        <p class="truncate font-semibold">{{ prefBar.name }}</p>
      </div>
      <ol v-if="prefBar.choices.length" class="flex flex-wrap items-center gap-2">
        <li
          v-for="choice in prefBar.choices"
          :key="choice.rank"
          :class="[
            'flex max-w-52 items-center gap-2 rounded-full border py-1 ps-1 pe-3 text-sm',
            choice.current
              ? 'border-primary-500 bg-primary-500/10'
              : 'cursor-pointer border-gray-200 hover:border-primary-400 dark:border-gray-700',
          ]"
          :title="choice.current ? `${choice.name} (on this team now)` : `${choice.name}: click to bring up to the Workbench`"
          @click="!choice.current && bringUpProject(choice.projectId)"
        >
          <span
            :class="[
              'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
              choice.current
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200',
            ]"
          >
            {{ choice.rank }}
          </span>
          <span class="truncate">{{ choice.name }}</span>
        </li>
      </ol>
      <p v-else class="text-sm text-amber-500">No ranked choices (no bid).</p>
      <UButton
        icon="i-heroicons-x-mark"
        aria-label="Clear selected student"
        size="xs"
        color="neutral"
        variant="ghost"
        class="ms-auto"
        @click="comparePicks = []"
      />
    </div>

    <div
      v-if="activeSection === 3"
      class="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-800 dark:bg-gray-900/50"
    >
      <div class="flex items-center gap-3">
        <div
          class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-primary-500"
        >
          <UIcon name="i-heroicons-calendar" class="size-5" />
        </div>
        <div>
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Working on</p>
          <p class="font-semibold">{{ semesterName }}</p>
        </div>
      </div>
      <UTabs
        v-model="meetingDay"
        :items="dayTabs"
        :content="false"
        size="sm"
        aria-label="Meeting day"
      />
      <p class="text-sm text-gray-500">
        {{ teamsForDay.length }} teams · {{ bidCountForDay }} bids
      </p>
      <UButton
        v-if="teamsHaveMembers"
        label="Export"
        icon="i-heroicons-arrow-down-tray"
        size="sm"
        color="neutral"
        variant="outline"
        :title="`Export ${titleCase(meetingDay)} teams as CSV`"
        class="ms-auto"
        @click="exportTeams(meetingDay)"
      />
    </div>

    <div v-if="activeSection === 3" class="space-y-4 empty:hidden">
      <p v-if="!canGenerate" class="text-sm text-gray-500">
        No {{ titleCase(meetingDay) }} teams for this semester. Add them in the Database tab first.
      </p>

      <UAlert
        v-if="versionError"
        color="error"
        variant="subtle"
        title="Version change failed"
        :description="versionError"
      />

      <UAlert
        v-if="generateError"
        color="error"
        variant="subtle"
        title="Team generation failed"
        :description="generateError"
      />

      <UAlert
        v-if="generating && autoGenerating"
        color="neutral"
        variant="subtle"
        icon="i-heroicons-arrow-path"
        title="Building teams…"
        description="Using the default settings (⚙)."
      />

      <UAlert
        v-if="generated"
        color="success"
        variant="subtle"
        title="Teams built"
        description="Locked students stay put when you regenerate. A locked team with spare seats can still receive new students."
      />
      <UAlert
        v-if="generated && skillTieBreakSummary"
        :color="lastSkillTieBreak?.projectsScored ? 'info' : 'warning'"
        variant="subtle"
        icon="i-heroicons-sparkles"
        title="Skill tie-break"
        :description="skillTieBreakSummary"
      />

      <!-- One line after each build; turns yellow if the builder moved anyone. -->
      <UCollapsible v-if="generated && noBidResults.length" class="space-y-2">
        <UButton
          :label="noBidSummary"
          :color="noBidMovedCount ? 'warning' : 'neutral'"
          variant="soft"
          size="sm"
          icon="i-heroicons-user-minus"
          trailing-icon="i-heroicons-chevron-down"
          :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform' }"
        />
        <template #content>
          <ul class="space-y-1 text-sm">
            <li
              v-for="p in noBidResults"
              :key="p.id"
              class="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-200 p-2 dark:border-gray-800"
            >
              <span>{{ p.name }} <span class="text-gray-500">({{ p.major }})</span></span>
              <span class="flex items-center gap-2">
                <span>{{ p.assignedProject ?? 'Unassigned' }}</span>
                <UBadge
                  :color="p.assignedProject === p.placedProject ? 'neutral' : 'warning'"
                  variant="subtle"
                  :label="
                    p.assignedProject === p.placedProject
                      ? 'kept placement'
                      : `moved from ${p.placedProject ?? 'none'}`
                  "
                />
              </span>
            </li>
          </ul>
        </template>
      </UCollapsible>
    </div>

    <UModal v-model:open="searchOpen" :ui="{ content: 'sm:max-w-xl' }">
      <template #content>
        <UCommandPalette
          v-model:search-term="searchTerm"
          :groups="searchGroups"
          placeholder="Find a team or student…"
          close
          class="h-96"
          @update:open="searchOpen = $event"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="settingsOpen"
      description="Changes kick in when you regenerate."
      :ui="{ content: 'sm:max-w-2xl', description: 'sr-only', footer: 'justify-between gap-3' }"
    >
      <template #title>
        <span class="flex items-center gap-1.5">
          Team settings
          <InfoTip text="Changes kick in when you regenerate." />
        </span>
      </template>
      <template #body>
        <UTabs
          :items="[
            { label: 'Rules', icon: 'i-heroicons-adjustments-horizontal', slot: 'rules' },
            {
              label: `Lock 3200s (${students3200ForDay.length})`,
              icon: 'i-heroicons-lock-closed',
              slot: 'lock3200',
            },
          ]"
          class="w-full"
          :ui="{ content: 'pt-4' }"
        >
          <template #rules>
            <div class="space-y-6">
              <section class="space-y-2">
                <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500">Teams</h3>
                <div class="divide-y divide-gray-200 rounded-lg border border-gray-200 text-sm dark:divide-gray-800 dark:border-gray-800">
                  <div class="flex items-center justify-between gap-4 px-4 py-3">
                    <span class="flex items-center gap-1.5 font-medium">
                      Team size
                      <InfoTip text="The fewest and most students on one team." />
                    </span>
                    <div class="flex items-center gap-2">
                      <UInputNumber
                        v-model="config.min_team_size"
                        :min="1"
                        size="sm"
                        class="w-24"
                        aria-label="Smallest team size"
                      />
                      <span class="text-gray-500">to</span>
                      <UInputNumber
                        v-model="config.max_team_size"
                        :min="config.min_team_size"
                        size="sm"
                        class="w-24"
                        aria-label="Largest team size"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section class="space-y-2">
                <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500">3200 students</h3>
                <div class="divide-y divide-gray-200 rounded-lg border border-gray-200 text-sm dark:divide-gray-800 dark:border-gray-800">
                  <div class="flex items-center justify-between gap-4 px-4 py-3">
                    <span class="flex items-center gap-1.5 font-medium">
                      3200s per team
                      <InfoTip
                        text="The max keeps one popular project from taking all the 3200s. Set the min to 0 if there aren't enough 3200s to go around."
                      />
                    </span>
                    <div class="flex items-center gap-2">
                      <UInputNumber
                        v-model="minUpperclassPerProject"
                        :min="0"
                        :max="maxUpperclassPerProject"
                        size="sm"
                        class="w-24"
                        aria-label="Fewest 3200s on one team"
                      />
                      <span class="text-gray-500">to</span>
                      <UInputNumber
                        v-model="maxUpperclassPerProject"
                        :min="Math.max(1, minUpperclassPerProject)"
                        size="sm"
                        class="w-24"
                        aria-label="Most 3200s on one team"
                      />
                    </div>
                  </div>
                  <div class="flex items-center justify-between gap-4 px-4 py-3">
                    <span class="flex items-center gap-1.5 font-medium">
                      3200s choose first
                      <InfoTip
                        text="3200s get their top picks first, then everyone else fills in around them. Locked 3200s don't move."
                      />
                    </span>
                    <USwitch
                      v-model="config.prioritize_3200_first_choice"
                      aria-label="3200s choose first"
                    />
                  </div>
                </div>
              </section>

              <section class="space-y-2">
                <h3 class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Light extras
                  <InfoTip text="Small nudges for close calls. They never beat the rules above." />
                </h3>
                <div class="divide-y divide-gray-200 rounded-lg border border-gray-200 text-sm dark:divide-gray-800 dark:border-gray-800">
                  <div class="flex items-center justify-between gap-4 px-4 py-3">
                    <span class="flex items-center gap-1.5 font-medium">
                      Returning students go back
                      <InfoTip
                        text="If a student ranked the project they were on last time, they lean toward it."
                      />
                    </span>
                    <USwitch
                      v-model="config.prioritize_returning_students"
                      aria-label="Returning students go back"
                    />
                  </div>
                  <div class="flex items-center justify-between gap-4 px-4 py-3">
                    <span class="flex items-center gap-1.5 font-medium">
                      No one alone by gender
                      <InfoTip
                        text="Tries not to put just one man or just one woman on a team. It doesn't make teams 50/50."
                      />
                    </span>
                    <USwitch v-model="config.balance_gender" aria-label="No one alone by gender" />
                  </div>
                </div>
              </section>

              <section class="space-y-2">
                <h3 class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Skill tie-break
                  <InfoTip
                    text="When students want the same project, ties go to 3200 experience, then semesters, then how well their skills match the project's. It never moves anyone off their picks."
                  />
                </h3>
                <div class="divide-y divide-gray-200 rounded-lg border border-gray-200 text-sm dark:divide-gray-800 dark:border-gray-800">
                  <div class="flex items-center justify-between gap-4 px-4 py-3">
                    <span class="flex items-center gap-1.5 font-medium">
                      Score skills with Gemini
                      <InfoTip
                        :text="geminiAvailable
                          ? 'Asks Gemini to rate skill fit, only for students competing for a full project. If it fails, the built-in score is used.'
                          : 'Off. The server has no GEMINI_API_KEY, so the built-in score is used.'"
                      />
                    </span>
                    <USwitch
                      v-model="useGemini"
                      :disabled="!geminiAvailable"
                      aria-label="Score skills with Gemini"
                    />
                  </div>
                  <div class="flex flex-wrap items-center gap-3 px-4 py-3">
                    <UButton
                      label="Test Gemini"
                      icon="i-heroicons-bolt"
                      color="neutral"
                      variant="soft"
                      size="sm"
                      :loading="geminiTest.running"
                      :disabled="!geminiAvailable"
                      @click="testGemini"
                    />
                    <span v-if="geminiTest.ok !== null" class="text-xs" :class="geminiTest.ok ? 'text-green-600 dark:text-green-400' : 'text-red-500'">
                      {{ geminiTest.message }}
                    </span>
                    <span v-else-if="geminiAvailable" class="text-xs text-gray-500">
                      Model: {{ geminiModelName }}. Checks that your key works.
                    </span>
                    <span v-else class="text-xs text-gray-500">Add GEMINI_API_KEY to .env and restart to enable.</span>
                  </div>
                </div>
              </section>
            </div>
          </template>

          <template #lock3200>
            <div class="space-y-4">
              <div
                class="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50"
              >
                <p class="me-auto flex items-center gap-1.5 text-sm">
                  <span>
                    <span class="font-semibold">{{ students3200ForDay.length }}</span> students
                    <span class="text-gray-500">· {{ locked3200Count }} locked</span>
                  </span>
                  <InfoTip
                    text="Locked 3200s stay on their team when you regenerate. Suggest picks a 1st or 2nd choice for each unlocked 3200, for you to check before locking."
                  />
                </p>
                <UButton
                  label="Suggest"
                  icon="i-heroicons-light-bulb"
                  size="sm"
                  color="neutral"
                  variant="outline"
                  :loading="suggesting"
                  @click="suggestPlacements"
                />
                <UButton
                  v-if="Object.keys(suggestions).length"
                  label="Lock suggested"
                  icon="i-heroicons-lock-closed"
                  size="sm"
                  :loading="lockingAllSuggested"
                  @click="lockAllSuggested"
                />
                <UButton
                  label="Lock all"
                  icon="i-heroicons-lock-closed"
                  size="sm"
                  color="neutral"
                  variant="outline"
                  :disabled="!lockAllTargets.length || bulkLocking"
                  :loading="bulkLocking"
                  @click="lockAll3200"
                />
                <UButton
                  label="Unlock all"
                  icon="i-heroicons-lock-open"
                  size="sm"
                  color="neutral"
                  variant="outline"
                  :disabled="!locked3200Count || bulkLocking"
                  :loading="bulkLocking"
                  @click="unlockAll3200"
                />
              </div>

              <UAlert
                v-if="suggestError"
                color="error"
                variant="subtle"
                title="Couldn't make suggestions"
                :description="suggestError"
              />
              <UAlert
                v-if="usedFallbackThirdChoice"
                color="warning"
                variant="subtle"
                title="Some 3200s only got their 3rd choice"
                description="There wasn't room for everyone's 1st or 2nd. Check them before locking."
              />
              <UAlert
                v-if="lockError"
                color="error"
                variant="subtle"
                title="Couldn't lock or unlock"
                :description="lockError"
              />

              <p v-if="!students3200ForDay.length" class="text-sm text-gray-500">
                No 3200s on this day.
              </p>
              <ul
                v-else
                class="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800"
              >
                <li
                  v-for="student in students3200ForDay"
                  :key="student.id"
                  class="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
                >
                  <div>
                    <div class="font-medium">
                      {{ student.firstName }} {{ student.lastName }}
                      <span class="font-normal text-gray-500">· {{ student.netID }}</span>
                    </div>
                    <div v-if="!lockedMembershipFor(student) && selectionLabel(student)" class="text-xs text-primary-500">
                      {{ selectionLabel(student) }}
                    </div>
                    <div
                      v-else-if="!lockedMembershipFor(student) && noChoiceStudentIds.has(student.id)"
                      class="text-xs text-amber-500"
                    >
                      No bid. Place by hand.
                    </div>
                  </div>

                  <div v-if="lockedMembershipFor(student)" class="flex items-center gap-2">
                    <UBadge color="error" variant="subtle" icon="i-heroicons-lock-closed">
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
                      class="w-56"
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
            </div>
          </template>
        </UTabs>
      </template>
      <template #footer>
        <div class="ms-auto flex shrink-0 items-center gap-2">
          <InfoTip text="Locked students stay put. The board is saved as a version first, so you can go back to it." />
          <UButton label="Close" color="neutral" variant="ghost" @click="settingsOpen = false" />
          <UButton
            :label="teamsHaveMembers ? 'Regenerate' : 'Generate'"
            icon="i-heroicons-arrow-path"
            :loading="generating"
            :disabled="!canGenerate || generating"
            @click="regenerate"
          />
        </div>
      </template>
    </UModal>

    <TieBreakModal
      v-model:open="tieBreakOpen"
      :semester-id="semesterId"
      :day="meetingDay"
      :max-team-size="config.max_team_size"
      :day-label="meetingDay === 'WEDNESDAY' ? 'Wednesday' : 'Thursday'"
      :skill-provider="skillProvider"
    />

    <UModal
      v-model:open="versionsOpen"
      description="The board saves as you go. Save a version to come back to later."
      :ui="{ content: 'sm:max-w-xl', description: 'sr-only' }"
    >
      <template #title>
        <span class="flex items-center gap-1.5">
          Versions
          <InfoTip text="The board saves as you go. Save a version to come back to later. Make one final to lock every team as a project." />
        </span>
      </template>
      <template #body>
        <div class="space-y-4">
          <form class="flex gap-2" @submit.prevent="saveVersion">
            <UInput
              v-model="newVersionNote"
              placeholder="Describe this version (optional)"
              maxlength="80"
              class="flex-1"
              :disabled="boardIsSaved || !dayHasStudents"
            />
            <UButton
              type="submit"
              :label="boardIsSaved ? `Saved as Version ${boardVersion}` : `Save as Version ${boardVersion}`"
              :icon="boardIsSaved ? 'i-heroicons-check' : 'i-heroicons-bookmark'"
              :disabled="boardIsSaved || !dayHasStudents || versionBusy"
              :loading="versionBusy"
            />
          </form>

          <p v-if="!versionList?.versions.length" class="py-6 text-center text-sm text-gray-500">
            No saved versions yet.
          </p>
          <ul
            v-else
            class="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800"
          >
            <li
              v-for="v in versionList.versions"
              :key="v.id"
              :class="['flex items-center gap-3 px-4 py-3', v.matchesBoard ? 'bg-primary-500/5' : '']"
            >
              <span
                :class="[
                  'flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                  v.matchesBoard
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200',
                ]"
              >
                {{ v.number }}
              </span>
              <div class="min-w-0 flex-1">
                <form
                  v-if="editingVersionId === v.id"
                  class="flex gap-1"
                  @submit.prevent="describeVersion"
                >
                  <UInput
                    v-model="editingNote"
                    size="sm"
                    maxlength="80"
                    autofocus
                    class="flex-1"
                    aria-label="Version description"
                    @keydown.esc.stop="editingVersionId = null"
                  />
                  <UButton type="submit" icon="i-heroicons-check" size="sm" aria-label="Save description" />
                </form>
                <div v-else class="flex min-w-0 items-center gap-1.5">
                  <span class="truncate text-sm font-medium">{{ v.note }}</span>
                  <UBadge v-if="v.matchesBoard" label="Current" color="primary" variant="subtle" size="sm" />
                  <UBadge
                    v-if="v.isFinal"
                    label="Final"
                    icon="i-heroicons-check-badge"
                    color="success"
                    variant="subtle"
                    size="sm"
                  />
                  <UButton
                    icon="i-heroicons-pencil-square"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    aria-label="Edit description"
                    title="Edit description"
                    @click="startDescribe(v)"
                  />
                </div>
                <p class="text-xs text-gray-500">
                  Version {{ v.number }} · {{ formatVersionTime(v.createdAt) }} ·
                  {{ v.studentCount }} students
                </p>
              </div>
              <UButton
                v-if="!v.matchesBoard"
                label="Go back"
                icon="i-heroicons-arrow-uturn-left"
                size="sm"
                color="neutral"
                variant="outline"
                :disabled="versionBusy"
                @click="restoreVersion(v)"
              />
              <UButton
                :label="v.isFinal ? 'Not final' : 'Make final'"
                :icon="v.isFinal ? 'i-heroicons-lock-open' : 'i-heroicons-check-badge'"
                size="sm"
                :color="v.isFinal ? 'neutral' : 'success'"
                variant="outline"
                :title="v.isFinal ? 'Reopen: put back the locks this version had' : 'Lock every team as a project'"
                :disabled="versionBusy"
                @click="setFinal(v, !v.isFinal)"
              />
              <UButton
                icon="i-heroicons-trash"
                size="sm"
                color="error"
                variant="ghost"
                aria-label="Delete version"
                title="Delete version"
                :disabled="versionBusy"
                @click="deleteVersion(v)"
              />
            </li>
          </ul>
        </div>
      </template>
    </UModal>

    <section
      v-if="activeSection === 3 && teamsHaveMembers"
      class="space-y-3"
    >

      <div
        v-if="improveTeam"
        ref="improvePanel"
        class="scroll-mt-20 space-y-3 rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-800"
      >
        <div class="flex items-start justify-between gap-2">
          <div>
            <h3 class="flex items-center gap-1.5 font-medium">
              Improve {{ improveTeam.projectName }}
              <InfoTip
                text="Shows a team each student ranked higher and can actually get onto. Nobody is moved somewhere they ranked lower. A fix brings both teams up to the Workbench."
              />
            </h3>
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
                <UIcon v-if="review.locked" name="i-heroicons-lock-closed" class="text-red-500" />
                <span class="font-medium">{{ studentName(review.studentId) }}</span>
                <span class="text-gray-500">· {{ majorOf(review.studentId) }}</span>
                <UBadge v-if="boardIs3200(review.studentId)" color="neutral" variant="subtle" size="sm">
                  3200
                </UBadge>
                <UBadge v-if="boardIsNoBid(review.studentId)" color="neutral" variant="subtle" size="sm">
                  no bid
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
              No bid. Place by hand.
            </p>
            <p v-else class="text-xs text-gray-500">
              Nothing better: they didn't rank a team higher.
            </p>
          </li>
        </ul>
      </div>

      <UAlert
        v-if="boardError"
        color="error"
        variant="subtle"
        title="Couldn't move student"
        :description="boardError"
      />
      <UAlert
        v-if="teamLockError"
        color="error"
        variant="subtle"
        title="Couldn't lock or unlock team"
        :description="teamLockError"
      />

      <div
        ref="workbenchEl"
        :class="[
          'scroll-mt-24 space-y-3 rounded-lg border px-3 py-2 transition-colors',
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
          <h3 class="flex flex-wrap items-center gap-x-1.5 font-medium">
            Workbench
            <span class="font-normal text-gray-500">({{ workbenchTeams.length }})</span>
            <InfoTip text="Teams you're working on, side by side. × puts a team back. A student's padlock keeps them on their team when you regenerate." />
            <span v-if="!workbenchTeams.length" class="text-sm font-normal text-gray-500 sm:ms-2">
              Click or drag a team here.
            </span>
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
                  <UBadge v-if="boardIsNoBid(side.studentId)" color="neutral" variant="subtle" size="sm" class="ml-1">
                    no bid
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
              No problems with this swap.
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
                <UBadge v-if="boardIsNoBid(comparePicks[0].studentId)" color="neutral" variant="subtle" size="sm" class="ml-1">
                  no bid
                </UBadge>
                <p class="text-xs text-gray-500">
                  Click someone on another team to try a swap.
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
                  Bring up another team to see moves.
                </li>
              </ul>
            </div>
          </template>
        </div>

        <div
          v-if="workbenchTeams.length"
          class="grid gap-3 sm:grid-cols-[repeat(auto-fill,minmax(18rem,1fr))]"
        >
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
                  <span :class="sizeWarn(team.id) ? 'text-amber-500' : ''">
                    {{ team.memberCount }}/{{ config.max_team_size }} members
                  </span>
                  ·
                  <span :class="warn3200(team.id) ? 'text-amber-500' : ''">
                    {{ boardCount3200(team.id) }} × 3200
                  </span>
                  <span v-if="teamWarnings(team.id).length" class="block text-amber-500">
                    ⚠ {{ teamWarnings(team.id).join('. ') }}
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
                  icon="i-heroicons-lock-open"
                  title="Unlocked. Click to lock"
                  size="xs"
                  color="success"
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
                <div class="flex flex-wrap items-center justify-between gap-x-2 sm:flex-nowrap">
                  <span class="flex min-w-0 flex-wrap items-center gap-x-1">
                    <span>{{ m.Student.firstName }} {{ m.Student.lastName }}</span>
                    <span class="text-xs text-gray-500">· {{ majorOf(m.studentId) }}</span>
                    <UBadge v-if="boardIs3200(m.studentId)" color="neutral" variant="subtle" size="sm">
                      3200
                    </UBadge>
                    <UBadge v-if="boardIsNoBid(m.studentId)" color="neutral" variant="subtle" size="sm">
                      no bid
                    </UBadge>
                  </span>
                  <span class="ms-auto flex shrink-0 items-center gap-1 text-xs text-gray-500">
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
                    <UButton
                      :icon="m.locked ? 'i-heroicons-lock-closed' : 'i-heroicons-lock-open'"
                      :aria-label="m.locked ? 'Unlock student' : 'Lock student'"
                      :title="m.locked ? 'Locked. Click to unlock' : 'Unlocked. Click to lock'"
                      size="xs"
                      :color="m.locked ? 'error' : 'neutral'"
                      variant="ghost"
                      :loading="lockingStudentKey === m.studentId"
                      @click.stop="toggleStudentLock(m.studentId, team.id, !m.locked)"
                    />
                  </span>
                </div>
              </li>
              <li v-if="!team.memberCount" class="text-xs text-gray-400">
                Empty. Drag students in.
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div
        :class="[
          'space-y-2 rounded-lg px-2 py-1 transition-colors',
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
        <h3 class="flex items-center gap-1.5 font-medium">
          All teams <span class="font-normal text-gray-500">({{ gridTeams.length }})</span>
          <InfoTip
            text="Click a team to bring it up. The padlock locks it, which makes it a project. ⚠ means a team is too small, too big, or short on 3200s. Point at it to see why."
          />
          <span v-if="warnedTeamCount" class="ms-2 flex items-center gap-1 text-sm font-normal text-amber-500">
            <UIcon name="i-heroicons-exclamation-triangle" />
            {{ warnedTeamCount }} {{ warnedTeamCount === 1 ? 'team needs' : 'teams need' }} a look
          </span>
        </h3>
        <p v-if="!gridTeams.length" class="text-sm text-gray-500">
          Every team is on the Workbench.
        </p>
        <TransitionGroup
          tag="div"
          move-class="transition-transform duration-300"
          class="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]"
        >
          <div
            v-for="team in gridTeams"
            :id="`team-card-${team.id}`"
            :key="team.id"
            :draggable="!isTeamLocked(team.id)"
            :class="[
              'rounded-lg border p-2.5 text-sm',
              isTeamLocked(team.id)
                ? 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/60'
                : 'cursor-pointer border-gray-200 bg-white hover:border-primary-400 active:cursor-grabbing dark:border-gray-800 dark:bg-gray-900 dark:hover:border-primary-500',
              boardDrag?.kind === 'team' && boardDrag.teamId === team.id ? 'opacity-40' : '',
              spotlightRanks
                ? spotlightRanks.has(team.projectId)
                  ? 'ring-2 ring-primary-500'
                  : 'opacity-40'
                : notTop3 && !offChoiceCountFor(team)
                  ? 'opacity-40'
                  : '',
              flashTeamId === team.id ? 'animate-pulse ring-2 ring-primary-500' : '',
            ]"
            :title="isTeamLocked(team.id) ? undefined : 'Click to bring up to the Workbench'"
            @dragstart="onBoardDragStart($event, { kind: 'team', teamId: team.id })"
            @dragend="onBoardDragEnd"
            @click="!isTeamLocked(team.id) && setAside(team.id)"
          >
            <div class="min-w-0 space-y-1">
              <div class="flex items-start justify-between gap-1">
                <div class="min-w-0">
                  <UBadge
                    v-if="spotlightRanks?.has(team.projectId)"
                    :label="`${rankText(spotlightRanks.get(team.projectId))} choice`"
                    color="primary"
                    variant="solid"
                    size="sm"
                    class="mb-1"
                  />
                  <div class="line-clamp-1 font-medium" :title="team.projectName">
                    {{ team.projectName }}
                  </div>
                </div>
                <!-- Padlock: red and closed when locked, green and open when not; one click toggles. -->
                <UButton
                  v-if="team.memberCount > 0"
                  :icon="isTeamLocked(team.id) ? 'i-heroicons-lock-closed' : 'i-heroicons-lock-open'"
                  :color="isTeamLocked(team.id) ? 'error' : 'success'"
                  :aria-label="isTeamLocked(team.id) ? 'Locked. Unlock team' : 'Unlocked. Lock team'"
                  :title="isTeamLocked(team.id) ? 'Locked. Click to unlock' : 'Unlocked. Click to lock'"
                  size="xs"
                  variant="ghost"
                  class="-me-1.5 -mt-1 shrink-0"
                  :loading="lockingTeamKey === team.id"
                  @click.stop="lockFromBoard(team.id, !isTeamLocked(team.id))"
                />
              </div>
              <div class="flex min-h-6 items-center justify-between gap-1 text-xs text-gray-500">
                <span class="flex items-center gap-1">
                  <span :class="sizeWarn(team.id) ? 'text-amber-500' : ''">
                    {{ team.memberCount }}/{{ config.max_team_size }}
                  </span>
                  ·
                  <span :class="warn3200(team.id) ? 'text-amber-500' : ''">
                    {{ boardCount3200(team.id) }} × 3200
                  </span>
                  <span
                    v-if="teamWarnings(team.id).length"
                    class="flex text-amber-500"
                    :title="teamWarnings(team.id).join('. ')"
                    :aria-label="teamWarnings(team.id).join('. ')"
                  >
                    <UIcon name="i-heroicons-exclamation-triangle" class="size-3.5" />
                  </span>
                </span>
                <!-- Staff call a fully locked team a project; one still being worked on is a team. -->
                <template v-if="team.memberCount > 0">
                  <UBadge
                    v-if="isTeamLocked(team.id)"
                    label="Project"
                    icon="i-heroicons-check-badge"
                    color="success"
                    variant="subtle"
                    size="sm"
                  />
                  <UButton
                    v-else
                    label="Improve"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    class="-me-1.5"
                    @click.stop="openImprove(team.id)"
                  />
                </template>
              </div>
              <ul class="space-y-1 text-xs">
                <li
                  v-for="m in cardMembers(team.id, team.projectId)"
                  :key="m.id"
                  class="flex items-center justify-between gap-1"
                >
                  <span class="flex min-w-0 items-center gap-1">
                    <UIcon
                      v-if="m.locked && !isTeamLocked(team.id)"
                      name="i-heroicons-lock-closed"
                      class="shrink-0 text-red-500"
                    />
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
                    <UBadge
                      v-if="boardIsNoBid(m.studentId)"
                      color="neutral"
                      variant="subtle"
                      size="xs"
                      class="shrink-0"
                    >
                      no bid
                    </UBadge>
                  </span>
                  <UBadge
                    :color="rankColor(boardRank(m.studentId, team.projectId))"
                    variant="subtle"
                    size="xs"
                    class="shrink-0"
                  >
                    {{ rankText(boardRank(m.studentId, team.projectId)) }}
                  </UBadge>
                </li>
                <li v-if="!team.memberCount" class="text-gray-500">No members yet</li>
                <template v-else-if="only3200">
                  <li v-if="!boardCount3200(team.id)" class="text-amber-500">No 3200s</li>
                  <li class="text-gray-500">
                    +{{ membershipsForTeam(team.id).length - boardCount3200(team.id) }} others
                  </li>
                </template>
                <template v-else-if="notTop3">
                  <li v-if="!offChoiceCountFor(team)" class="text-gray-500">Everyone got a top 3 pick</li>
                  <li v-else-if="offChoiceCountFor(team) < team.memberCount" class="text-gray-500">
                    +{{ team.memberCount - offChoiceCountFor(team) }} in their top 3
                  </li>
                </template>
              </ul>
            </div>
          </div>
        </TransitionGroup>
      </div>
    </section>

    <FinalizeStep
      v-if="activeSection === FINALIZE_STEP"
      v-model:day="meetingDay"
      :semester-id="semesterId"
      :semester-name="semesterName"
      :min-team-size="config.min_team_size"
      :max-team-size="config.max_team_size"
      :min3200="minUpperclassPerProject"
      :board-version="boardVersion"
      :board-is-saved="boardIsSaved"
      :board-is-final="boardIsFinal"
      :busy="versionBusy"
      :version-error="versionError"
      @make-final="finalizeBoard"
      @undo-final="undoFinalBoard"
      @export-teams="exportTeams(meetingDay)"
      @go-manage="activeSection = MANAGE_STEP"
    />

  </UContainer>

    <nav
      class="sticky bottom-0 z-30 flex shrink-0 print:hidden flex-row-reverse items-center justify-between border-t border-gray-200 bg-default px-4 py-2 sm:top-0 sm:bottom-auto sm:h-screen sm:w-24 sm:flex-col sm:border-t-0 sm:border-l sm:px-0 sm:py-8 dark:border-gray-800"
      aria-label="Next and back"
    >
      <div class="flex flex-row-reverse items-center gap-2 px-2 text-center sm:flex-col">
        <template v-if="activeSection < STEP_COUNT">
          <UButton
            icon="i-heroicons-arrow-right"
            size="xl"
            class="rounded-full disabled:opacity-30 aria-disabled:opacity-30"
            :disabled="!!nextBlocker"
            aria-label="Next step"
            @click="goNext"
          />
          <span class="text-xs text-gray-500">{{ nextBlocker ?? 'Next' }}</span>
        </template>
      </div>
      <div v-if="activeSection > 1" class="flex items-center gap-2 sm:flex-col">
        <UButton
          icon="i-heroicons-arrow-left"
          size="xl"
          color="neutral"
          variant="soft"
          class="rounded-full"
          aria-label="Previous step"
          @click="activeSection--"
        />
        <span class="text-xs text-gray-500">Back</span>
      </div>
    </nav>
  </div>
</template>
