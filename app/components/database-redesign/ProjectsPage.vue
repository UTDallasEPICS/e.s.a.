<script setup lang="ts">
  /**
   * Purpose
   * Let staff find projects and manage semester details and rosters.
   *
   * Inputs
   * - Project records, team assignments, filters, and edits entered by the user.
   *
   * Outputs
   * - Project cards, expanded semester details, and updated records.
   *
   * Pseudocode
   * Apply the project filters → show a page of matching projects → open the chosen semester → apply validated edits.
   */
  import {
    latestProjectSemester,
    projectStatusForSemester as getProjectSemesterStatus,
  } from '../projectSemesterStatus'
  import { ref, computed, watch, nextTick } from 'vue'
  import {
    projects,
    partners,
    students,
    semesters,
    teams,
    officialProjectRosters,
    getOfficialProjectRoster,
    getPartnerById,
    getStudentForSemester,
    getSemesterLabel,
  } from '../data'
  import type { Project, ProjectSemesterDetail } from '../data'
  import StatusBadge from './StatusBadge.vue'
  import type { PinnedItem } from '../types'
  import { addProject, removeProject, updateProject, removeProjectAssignments } from '../contentStore'

  // Store semesterStatusDraft as state so Vue reacts when it changes.
  const semesterStatusDraft = ref<Record<string, Project['status']>>({})
  // Store semesterNoteDraft as state so Vue reacts when it changes.
  const semesterNoteDraft = ref<Record<string, string>>({})
  // Use useState to initialize semFilter.
  const semFilter = useState<string>('epics-selected-semester', () => 'FA26')
  // Store statusFilter as state so Vue reacts when it changes.
  const statusFilter = ref('all')
  // Store partnerFilter as state so Vue reacts when it changes.
  const partnerFilter = ref('all')
  // Store projectSearchDraft as state so Vue reacts when it changes.
  const projectSearchDraft = ref('')
  // Store projectSearch as state so Vue reacts when it changes.
  const projectSearch = ref('')
  // Store expanded as state so Vue reacts when it changes.
  const expanded = ref<string | null>(null)
  // Store selectedSemester as state so Vue reacts when it changes.
  const selectedSemester = ref<Record<string, string>>({})
  // Store showAddForm as state so Vue reacts when it changes.
  const showAddForm = ref(false)
  // Store showContinuationForm as state so Vue reacts when it changes.
  const showContinuationForm = ref(false)
  // Store selectedProjects as state so Vue reacts when it changes.
  const selectedProjects = ref<string[]>([])
  // Store confirmingRemoval as state so Vue reacts when it changes.
  const confirmingRemoval = ref(false)
  // Store editingProjectId as state so Vue reacts when it changes.
  const editingProjectId = ref<string | null>(null)
  // Store selectedRosterAssignments as state so Vue reacts when it changes.
  const selectedRosterAssignments = ref<Record<string, string[]>>({})
  // Store confirmingRosterRemoval as state so Vue reacts when it changes.
  const confirmingRosterRemoval = ref<string | null>(null)
  // Store rosterRemovalNote as state so Vue reacts when it changes.
  const rosterRemovalNote = ref('')
  // Store editingSkillsKey as state so Vue reacts when it changes.
  const editingSkillsKey = ref<string | null>(null)
  // Store skillDraft as state so Vue reacts when it changes.
  const skillDraft = ref('')
  // Store editDraft as state so Vue reacts when it changes.
  const editDraft = ref<{
    name: string
    partnerId: string
    status: Project['status']
    description: string
    semesterDetails: ProjectSemesterDetail[]
  } | null>(null)
  type NewProject = {
    projectNumber: string
    name: string
    partnerId: string
    status: Project['status']
    semesterId: string
    mentorName: string
    mentorEmail: string
  }
  // Define blankProject for the steps below.
  const blankProject = (): NewProject => ({
    projectNumber: '',
    name: '',
    partnerId: partners[0]?.id ?? '',
    status: 'New',
    semesterId: semFilter.value === 'all' ? 'FA26' : semFilter.value,
    mentorName: '',
    mentorEmail: '',
  })
  // Store newProjects as state so Vue reacts when it changes.
  const newProjects = ref<NewProject[]>([blankProject()])
  type ContinuationDraft = {
    projectId: string
    semesterId: string
    contactName: string
    contactEmail: string
    contactPhone: string
    mentorName: string
    mentorEmail: string
  }
  // Store continuations as state so Vue reacts when it changes.
  const continuations = ref<ContinuationDraft[]>([])
  // Use defineProps to initialize props.
  const props = defineProps<{
    initialProjectId?: string | null
    initialSemesterId?: string | null
    pinnedItems: PinnedItem[]
  }>()
  // Use defineEmits to initialize emit.
  const emit = defineEmits<{
    openStudent: [studentId: string, semesterId?: string]
    togglePin: [item: PinnedItem]
  }>()

  // Recalculate filtered when the values it reads change.
  const filtered = computed(() =>
    projects
      .filter((p) => {
        // Use projectSearch.value.trim().toLowerCase to initialize query.
        const query = projectSearch.value.trim().toLowerCase()
        // Use getPartnerById to initialize partner.
        const partner = getPartnerById(p.partnerId)
        // Use [ p.name, p.description, p.projectNumber?.toString() ?? '', p.projectNumber ? `#${p.projectNumber}`  to initialize searchableText.
        const searchableText = [
          p.name,
          p.description,
          p.projectNumber?.toString() ?? '',
          p.projectNumber ? `#${p.projectNumber}` : '',
          partner?.name ?? '',
          partner?.contact ?? '',
          partner?.email ?? '',
          p.mentorName ?? '',
          p.mentorEmail ?? '',
          ...p.semesters.map(getSemesterLabel),
        ]
          .join(' ')
          .toLowerCase()
        // Check whether query && !searchableText.includes(query) before running this branch.
        if (query && !searchableText.includes(query)) return false
        // Check whether semFilter.value !== 'all' && !p.semesters.includes(semFilter.value) before running this branch.
        if (semFilter.value !== 'all' && !p.semesters.includes(semFilter.value)) return false
        // Check whether statusFilter.value !== 'all' && getProjectSemesterStatus(p, semFilter.value) !== statusFilter.value before running this branch.
        if (
          statusFilter.value !== 'all' &&
          getProjectSemesterStatus(p, semFilter.value) !== statusFilter.value
        )
          // Pass false back to the caller.
          return false
        // Check whether partnerFilter.value !== 'all' && p.partnerId !== partnerFilter.value before running this branch.
        if (partnerFilter.value !== 'all' && p.partnerId !== partnerFilter.value) return false
        // Pass true back to the caller.
        return true
      })
      .sort(
        (a, b) =>
          a.name.localeCompare(b.name, 'en', { sensitivity: 'base', numeric: true }) ||
          a.id.localeCompare(b.id)
      )
  )

  // Store currentPage as state so Vue reacts when it changes.
  const currentPage = ref(1)
  // Define projectsPerPage for the steps below.
  const projectsPerPage = 10

  // Recalculate totalPages when the values it reads change.
  const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / projectsPerPage)))

  // Recalculate paginatedProjects when the values it reads change.
  const paginatedProjects = computed(() => {
    // Define start for the steps below.
    const start = (currentPage.value - 1) * projectsPerPage
    // Pass filtered.value.slice(start, start + projectsPerPage) back to the caller.
    return filtered.value.slice(start, start + projectsPerPage)
  })

  // Run the callback when the watched values change.
  watch([projectSearch, semFilter, statusFilter, partnerFilter], () => {
    // Update currentPage.value with the value on the right.
    currentPage.value = 1
  })

  // Run the callback when the watched values change.
  watch(
    [() => props.initialProjectId, () => props.initialSemesterId],
    async ([projectId, semesterId]) => {
      // Check whether !projectId before running this branch.
      if (!projectId) return
      // Use projects.find to initialize project.
      const project = projects.find((item) => item.id === projectId)
      // Check whether !project before running this branch.
      if (!project) return
      // Update projectSearch.value with the value on the right.
      projectSearch.value = ''
      // Update projectSearchDraft.value with the value on the right.
      projectSearchDraft.value = ''
      // Update statusFilter.value with the value on the right.
      statusFilter.value = 'all'
      // Update partnerFilter.value with the value on the right.
      partnerFilter.value = 'all'
      // Define targetSemester for the steps below.
      const targetSemester =
        semesterId && project.semesters.includes(semesterId)
          ? semesterId
          : semFilter.value !== 'all' && project.semesters.includes(semFilter.value)
            ? semFilter.value
            : (project.semesters.at(-1) ?? 'all')
      // Update semFilter.value with the value on the right.
      semFilter.value = targetSemester
      // Update selectedSemester.value[projectId] with the value on the right.
      selectedSemester.value[projectId] = targetSemester
      // Update expanded.value with the value on the right.
      expanded.value = projectId
      await nextTick()
      // Use filtered.value.findIndex to initialize index.
      const index = filtered.value.findIndex((item) => item.id === projectId)
      // Update currentPage.value with the value on the right.
      currentPage.value = index >= 0 ? Math.floor(index / projectsPerPage) + 1 : 1
      await nextTick()
      // Call document .getElementById(`project-${projectId}`) ?.scrollIntoView to run this step.
      document
        .getElementById(`project-${projectId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
    { immediate: true }
  )

  // Define the helper that will apply project search.
  function applyProjectSearch() {
    // Update projectSearch.value with the value on the right.
    projectSearch.value = projectSearchDraft.value.trim()
    // Update selectedProjects.value with the value on the right.
    selectedProjects.value = []
    // Update confirmingRemoval.value with the value on the right.
    confirmingRemoval.value = false
  }

  // Define the helper that will clear project search.
  function clearProjectSearch() {
    // Update projectSearchDraft.value with the value on the right.
    projectSearchDraft.value = ''
    // Update projectSearch.value with the value on the right.
    projectSearch.value = ''
  }

  // Define the helper that will project students.
  function projectStudents(projectId: string, semesterId?: string) {
    // Use teams.filter to initialize memberships.
    const memberships = teams.filter(
      (team) => team.projectId === projectId && (!semesterId || team.semesterId === semesterId)
    )
    // Define studentIds for the steps below.
    const studentIds = new Set(memberships.flatMap((team) => team.studentIds))
    // Pass students .map((student) => getStudentForSemester(student, semesterId ?? 'all')) .filter((student) => back to the caller.
    return students
      .map((student) => getStudentForSemester(student, semesterId ?? 'all'))
      .filter((student) => studentIds.has(student.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base', numeric: true }))
  }

  // Define the helper that will peer lead id.
  function peerLeadId(projectId: string, semesterId: string) {
    // Pass teams.find((team) => team.projectId === projectId && team.semesterId === semesterId) ?.peerLeadId back to the caller.
    return teams.find((team) => team.projectId === projectId && team.semesterId === semesterId)
      ?.peerLeadId
  }

  // Define the helper that will open project.
  function openProject(projectId: string, projectSemesters: string[]) {
    // Define isOpening for the steps below.
    const isOpening = expanded.value !== projectId
    // Update expanded.value with the value on the right.
    expanded.value = isOpening ? projectId : null

    // Check whether isOpening before running this branch.
    if (isOpening) {
      // Update selectedSemester.value[projectId] with the value on the right.
      selectedSemester.value[projectId] =
        semFilter.value !== 'all' && projectSemesters.includes(semFilter.value)
          ? semFilter.value
          : (projectSemesters[projectSemesters.length - 1] ?? '')
    }
  }

  // Define the helper that will selected roster.
  function selectedRoster(projectId: string) {
    // Pass selectedRosterAssignments.value[projectId] ?? [] back to the caller.
    return selectedRosterAssignments.value[projectId] ?? []
  }

  // Define the helper that will toggle roster assignment.
  function toggleRosterAssignment(projectId: string, key: string) {
    // Use selectedRoster to initialize selected.
    const selected = selectedRoster(projectId)
    // Update selectedRosterAssignments.value[projectId] with the value on the right.
    selectedRosterAssignments.value[projectId] = selected.includes(key)
      ? selected.filter((item) => item !== key)
      : [...selected, key]
    // Update confirmingRosterRemoval.value with the value on the right.
    confirmingRosterRemoval.value = null
  }

  // Define the helper that will roster assignment keys.
  function rosterAssignmentKeys(project: Project, semesterId: string) {
    // Use getOfficialProjectRoster(project.id, semesterId).map to initialize official.
    const official = getOfficialProjectRoster(project.id, semesterId).map(
      (student) => `official:${student.name}`
    )
    // Use projectStudents(project.id, semesterId).map to initialize tracked.
    const tracked = projectStudents(project.id, semesterId).map((student) => `student:${student.id}`)
    // Pass [...official, ...tracked] back to the caller.
    return [...official, ...tracked]
  }

  // Define the helper that will toggle all roster assignments.
  function toggleAllRosterAssignments(project: Project, semesterId: string) {
    // Use rosterAssignmentKeys to initialize keys.
    const keys = rosterAssignmentKeys(project, semesterId)
    // Define allSelected for the steps below.
    const allSelected =
      keys.length > 0 && keys.every((key) => selectedRoster(project.id).includes(key))
    // Update selectedRosterAssignments.value[project.id] with the value on the right.
    selectedRosterAssignments.value[project.id] = allSelected ? [] : keys
    // Update confirmingRosterRemoval.value with the value on the right.
    confirmingRosterRemoval.value = null
  }

  // Define the helper that will confirm roster assignments removal.
  function confirmRosterAssignmentsRemoval(project: Project, semesterId: string) {
    // Use selectedRoster to initialize selected.
    const selected = selectedRoster(project.id)
    // Check whether !selected.length before running this branch.
    if (!selected.length) return
    // Call removeProjectAssignments to run this step.
    removeProjectAssignments(project.id, semesterId, selected, rosterRemovalNote.value.trim())
    // Update selectedRosterAssignments.value[project.id] with the value on the right.
    selectedRosterAssignments.value[project.id] = []
    // Update confirmingRosterRemoval.value with the value on the right.
    confirmingRosterRemoval.value = null
    // Update rosterRemovalNote.value with the value on the right.
    rosterRemovalNote.value = ''
  }

  // Define the helper that will current semester.
  function currentSemester(projectId: string, projectSemesters: string[]) {
    // Pass selectedSemester.value[projectId] ?? projectSemesters[projectSemesters.length - 1] back to the caller.
    return selectedSemester.value[projectId] ?? projectSemesters[projectSemesters.length - 1]
  }

  // Define the helper that will project skills.
  function projectSkills(projectId: string, semesterId: string) {
    // Pass Array.from( new Set(projectStudents(projectId, semesterId).flatMap((student) => student.skills)) ).s back to the caller.
    return Array.from(
      new Set(projectStudents(projectId, semesterId).flatMap((student) => student.skills))
    ).slice(0, 8)
  }

  // Define the helper that will team skills for semester.
  function teamSkillsForSemester(project: Project, semesterId: string) {
    // Define savedSkills for the steps below.
    const savedSkills = semesterDetail(project, semesterId)?.teamSkills
    // Pass savedSkills?.length ? savedSkills : projectSkills(project.id, semesterId) back to the caller.
    return savedSkills?.length ? savedSkills : projectSkills(project.id, semesterId)
  }

  // Define the helper that will roster count.
  function rosterCount(projectId: string) {
    // Pass semFilter.value === 'all' ? (officialProjectRosters[projectId]?.length ?? projectStudents(projectId) back to the caller.
    return semFilter.value === 'all'
      ? (officialProjectRosters[projectId]?.length ?? projectStudents(projectId).length)
      : getOfficialProjectRoster(projectId, semFilter.value).length +
          projectStudents(projectId, semFilter.value).length
  }

  // Define the helper that will semester detail.
  function semesterDetail(project: Project, semesterId: string) {
    // Pass project.semesterDetails?.find((detail) => detail.semesterId === semesterId) back to the caller.
    return project.semesterDetails?.find((detail) => detail.semesterId === semesterId)
  }

  // Define the helper that will contact for semester.
  function contactForSemester(project: Project, semesterId: string) {
    // Use semesterDetail to initialize detail.
    const detail = semesterDetail(project, semesterId)
    // Use getPartnerById to initialize partner.
    const partner = getPartnerById(project.partnerId)
    // Pass { name: detail?.contactName ?? partner?.contact ?? '', email: detail?.contactEmail ?? partner?.email back to the caller.
    return {
      name: detail?.contactName ?? partner?.contact ?? '',
      email: detail?.contactEmail ?? partner?.email ?? '',
      phone: detail?.contactPhone ?? partner?.phone ?? '',
    }
  }

  // Define the helper that will mentor for semester.
  function mentorForSemester(project: Project, semesterId: string) {
    // Use semesterDetail to initialize detail.
    const detail = semesterDetail(project, semesterId)
    // Pass { name: detail?.mentorName ?? project.mentorName ?? '', email: detail?.mentorEmail ?? project.mentor back to the caller.
    return {
      name: detail?.mentorName ?? project.mentorName ?? '',
      email: detail?.mentorEmail ?? project.mentorEmail ?? '',
    }
  }

  // Define the helper that will is pinned.
  function isPinned(projectId: string) {
    // Pass props.pinnedItems.some((item) => item.key === `project:${projectId}`) back to the caller.
    return props.pinnedItems.some((item) => item.key === `project:${projectId}`)
  }

  // Define the helper that will confirm add project.
  function confirmAddProject() {
    // Use newProjects.value.filter to initialize validProjects.
    const validProjects = newProjects.value.filter(
      (project) => project.name.trim() && project.partnerId
    )
    // Check whether !validProjects.length before running this branch.
    if (!validProjects.length) return
    // Call validProjects.forEach to run this step.
    validProjects.forEach((project, index) => {
      // Use Number.parseInt to initialize projectNumber.
      const projectNumber = Number.parseInt(project.projectNumber, 10)
      // Call addProject to run this step.
      addProject({
        id: `CUSTOM-PR-${Date.now()}-${index}`,
        projectNumber: Number.isNaN(projectNumber) ? undefined : projectNumber,
        name: project.name.trim(),
        partnerId: project.partnerId,
        status: project.status,
        description: 'Coordinator-added project',
        semesters: [project.semesterId],
        mentorName: project.mentorName.trim() || undefined,
        mentorEmail: project.mentorEmail.trim() || undefined,
      })
    })
    // Update newProjects.value with the value on the right.
    newProjects.value = [blankProject()]
    // Update showAddForm.value with the value on the right.
    showAddForm.value = false
  }

  // Define the helper that will next semester for.
  function nextSemesterFor(project: Project) {
    // Use project.semesters.map to initialize indexes.
    const indexes = project.semesters.map((semesterId) =>
      semesters.findIndex((semester) => semester.id === semesterId)
    )
    // Use Math.max to initialize latestIndex.
    const latestIndex = Math.max(-1, ...indexes)
    // Pass semesters[latestIndex + 1] ?? semesters[latestIndex] back to the caller.
    return semesters[latestIndex + 1] ?? semesters[latestIndex]
  }

  // Define the helper that will is existing continuation semester.
  function isExistingContinuationSemester(projectId: string, semesterId: string) {
    // Pass ( projects.find((project) => project.id === projectId)?.semesters.includes(semesterId) ?? false ) back to the caller.
    return (
      projects.find((project) => project.id === projectId)?.semesters.includes(semesterId) ?? false
    )
  }

  // Define the helper that will continuation draft for.
  function continuationDraftFor(projectId: string): ContinuationDraft | null {
    // Use projects.find to initialize project.
    const project = projects.find((item) => item.id === projectId)
    // Check whether !project before running this branch.
    if (!project) return null
    // Use nextSemesterFor to initialize nextSemester.
    const nextSemester = nextSemesterFor(project)
    // Define latestSemesterId for the steps below.
    const latestSemesterId = project.semesters[project.semesters.length - 1]
    // Use contactForSemester to initialize previousContact.
    const previousContact = contactForSemester(project, latestSemesterId)
    // Use mentorForSemester to initialize previousMentor.
    const previousMentor = mentorForSemester(project, latestSemesterId)
    // Pass { projectId: project.id, semesterId: nextSemester?.id ?? latestSemesterId, contactName: previousCont back to the caller.
    return {
      projectId: project.id,
      semesterId: nextSemester?.id ?? latestSemesterId,
      contactName: previousContact.name,
      contactEmail: previousContact.email,
      contactPhone: previousContact.phone,
      mentorName: previousMentor.name,
      mentorEmail: previousMentor.email,
    }
  }

  // Define the helper that will prepare continuation.
  function prepareContinuation(index: number, projectId: string) {
    // Use continuationDraftFor to initialize draft.
    const draft = continuationDraftFor(projectId)
    // Check whether draft before running this branch.
    if (draft) continuations.value[index] = draft
  }

  // Define the helper that will load selected continuations.
  function loadSelectedContinuations() {
    // Define ids for the steps below.
    const ids = selectedProjects.value.length
      ? selectedProjects.value
      : ([projects[0]?.id].filter(Boolean) as string[])
    // Update continuations.value with the value on the right.
    continuations.value = ids
      .map(continuationDraftFor)
      .filter((draft): draft is ContinuationDraft => Boolean(draft))
  }

  // Define the helper that will add continuation row.
  function addContinuationRow() {
    // Define unusedProject for the steps below.
    const unusedProject =
      projects.find(
        (project) => !continuations.value.some((draft) => draft.projectId === project.id)
      ) ?? projects[0]
    // Check whether !unusedProject before running this branch.
    if (!unusedProject) return
    // Use continuationDraftFor to initialize draft.
    const draft = continuationDraftFor(unusedProject.id)
    // Check whether draft before running this branch.
    if (draft) continuations.value.push(draft)
  }

  // Define the helper that will open add form.
  function openAddForm() {
    // Update showAddForm.value with the value on the right.
    showAddForm.value = !showAddForm.value
    // Update showContinuationForm.value with the value on the right.
    showContinuationForm.value = false
  }

  // Define the helper that will open continuation form.
  function openContinuationForm() {
    // Update showContinuationForm.value with the value on the right.
    showContinuationForm.value = !showContinuationForm.value
    // Update showAddForm.value with the value on the right.
    showAddForm.value = false
    // Check whether showContinuationForm.value before running this branch.
    if (showContinuationForm.value) loadSelectedContinuations()
  }

  // Define the helper that will start selected continuations.
  function startSelectedContinuations() {
    // Check whether !selectedProjects.value.length before running this branch.
    if (!selectedProjects.value.length) return
    // Update showContinuationForm.value with the value on the right.
    showContinuationForm.value = true
    // Update showAddForm.value with the value on the right.
    showAddForm.value = false
    // Call loadSelectedContinuations to run this step.
    loadSelectedContinuations()
  }

  // Define the helper that will confirm continuations.
  function confirmContinuations() {
    // Define lastUpdated for the steps below.
    let lastUpdated: ContinuationDraft | null = null
    // Call continuations.value.forEach to run this step.
    continuations.value.forEach((continuation) => {
      // Use projects.find to initialize project.
      const project = projects.find((item) => item.id === continuation.projectId)
      // Check whether !project || !continuation.semesterId before running this branch.
      if (!project || !continuation.semesterId) return
      // Define detail for the steps below.
      const detail: ProjectSemesterDetail = {
        semesterId: continuation.semesterId,
        contactName: continuation.contactName.trim(),
        contactEmail: continuation.contactEmail.trim(),
        contactPhone: continuation.contactPhone.trim(),
        mentorName: continuation.mentorName.trim(),
        mentorEmail: continuation.mentorEmail.trim(),
      }
      // Define existingDetails for the steps below.
      const existingDetails: ProjectSemesterDetail[] =
        project.semesterDetails ??
        project.semesters.map((semesterId) => {
          // Use contactForSemester to initialize contact.
          const contact = contactForSemester(project, semesterId)
          // Use mentorForSemester to initialize mentor.
          const mentor = mentorForSemester(project, semesterId)
          // Pass { semesterId, contactName: contact.name, contactEmail: contact.email, contactPhone: contact.phone, m back to the caller.
          return {
            semesterId,
            contactName: contact.name,
            contactEmail: contact.email,
            contactPhone: contact.phone,
            mentorName: mentor.name,
            mentorEmail: mentor.email,
          }
        })
      // Call updateProject to run this step.
      updateProject(project.id, {
        status: 'In Progress',
        semesters: Array.from(new Set([...project.semesters, detail.semesterId])),
        semesterDetails: [
          ...existingDetails.filter((existing) => existing.semesterId !== detail.semesterId),
          detail,
        ],
      })
      // Update selectedSemester.value[project.id] with the value on the right.
      selectedSemester.value[project.id] = detail.semesterId
      // Update lastUpdated with the value on the right.
      lastUpdated = continuation
    })
    // Check whether lastUpdated before running this branch.
    if (lastUpdated) expanded.value = lastUpdated.projectId
    // Update selectedProjects.value with the value on the right.
    selectedProjects.value = []
    // Update continuations.value with the value on the right.
    continuations.value = []
    // Update showContinuationForm.value with the value on the right.
    showContinuationForm.value = false
  }

  // Define the helper that will confirm remove project.
  function confirmRemoveProject(projectId: string) {
    // Use projects.find to initialize project.
    const project = projects.find((item) => item.id === projectId)
    // Check whether project && isPinned(projectId) before running this branch.
    if (project && isPinned(projectId)) {
      // Call emit to run this step.
      emit('togglePin', {
        key: `project:${project.id}`,
        type: 'project',
        id: project.id,
        title: project.name,
        subtitle: getPartnerById(project.partnerId)?.name ?? '',
      })
    }
    // Call removeProject to run this step.
    removeProject(projectId)
    // Check whether expanded.value === projectId before running this branch.
    if (expanded.value === projectId) expanded.value = null
  }

  // Recalculate allFilteredSelected when the values it reads change.
  const allFilteredSelected = computed(
    () =>
      filtered.value.length > 0 &&
      filtered.value.every((project) => selectedProjects.value.includes(project.id))
  )

  // Define the helper that will toggle all filtered.
  function toggleAllFiltered() {
    // Check whether allFilteredSelected.value before running this branch.
    if (allFilteredSelected.value) {
      // Define filteredIds for the steps below.
      const filteredIds = new Set(filtered.value.map((project) => project.id))
      // Update selectedProjects.value with the value on the right.
      selectedProjects.value = selectedProjects.value.filter((id) => !filteredIds.has(id))
    } else {
      // Update selectedProjects.value with the value on the right.
      selectedProjects.value = Array.from(
        new Set([...selectedProjects.value, ...filtered.value.map((project) => project.id)])
      )
    }
    // Update confirmingRemoval.value with the value on the right.
    confirmingRemoval.value = false
  }

  // Define the helper that will confirm remove selected projects.
  function confirmRemoveSelectedProjects() {
    // Call selectedProjects.value.forEach to run this step.
    selectedProjects.value.forEach(confirmRemoveProject)
    // Update selectedProjects.value with the value on the right.
    selectedProjects.value = []
    // Update confirmingRemoval.value with the value on the right.
    confirmingRemoval.value = false
  }

  // Define the helper that will begin edit.
  function beginEdit(project: Project) {
    // Use getPartnerById to initialize partner.
    const partner = getPartnerById(project.partnerId)
    // Update editingProjectId.value with the value on the right.
    editingProjectId.value = project.id
    // Update editDraft.value with the value on the right.
    editDraft.value = {
      name: project.name,
      partnerId: project.partnerId,
      status: project.status,
      description: project.description,
      semesterDetails: project.semesters.map((semesterId) => {
        // Use semesterDetail to initialize existing.
        const existing = semesterDetail(project, semesterId)
        // Pass { semesterId, contactName: existing?.contactName || partner?.contact || '', contactEmail: existing?. back to the caller.
        return {
          semesterId,
          contactName: existing?.contactName || partner?.contact || '',
          contactEmail: existing?.contactEmail || partner?.email || '',
          contactPhone: existing?.contactPhone || partner?.phone || '',
          mentorName: existing?.mentorName || project.mentorName || '',
          mentorEmail: existing?.mentorEmail || project.mentorEmail || '',
        }
      }),
    }
  }

  // Define the helper that will add semester detail.
  function addSemesterDetail() {
    // Check whether !editDraft.value before running this branch.
    if (!editDraft.value) return
    // Define used for the steps below.
    const used = new Set(editDraft.value.semesterDetails.map((detail) => detail.semesterId))
    // Use Math.max to initialize latestIndex.
    const latestIndex = Math.max(
      -1,
      ...editDraft.value.semesterDetails.map((detail) =>
        semesters.findIndex((semester) => semester.id === detail.semesterId)
      )
    )
    // Define nextSemester for the steps below.
    const nextSemester =
      semesters.slice(latestIndex + 1).find((semester) => !used.has(semester.id)) ??
      semesters.find((semester) => !used.has(semester.id))
    // Check whether !nextSemester before running this branch.
    if (!nextSemester) return
    // Use getPartnerById to initialize partner.
    const partner = getPartnerById(editDraft.value.partnerId)
    // Call editDraft.value.semesterDetails.push to run this step.
    editDraft.value.semesterDetails.push({
      semesterId: nextSemester.id,
      contactName: partner?.contact ?? '',
      contactEmail: partner?.email ?? '',
      contactPhone: partner?.phone ?? '',
      mentorName: '',
      mentorEmail: '',
    })
  }

  // Define the helper that will confirm save project.
  function confirmSaveProject() {
    // Check whether !editingProjectId.value || !editDraft.value || !editDraft.value.name.trim() before running this branch.
    if (!editingProjectId.value || !editDraft.value || !editDraft.value.name.trim()) return
    // Use Array.from to initialize uniqueDetails.
    const uniqueDetails = Array.from(
      new Map(editDraft.value.semesterDetails.map((detail) => [detail.semesterId, detail])).values()
    )
    // Call updateProject to run this step.
    updateProject(editingProjectId.value, {
      name: editDraft.value.name.trim(),
      partnerId: editDraft.value.partnerId,
      status: editDraft.value.status,
      description: editDraft.value.description.trim(),
      semesters: uniqueDetails.map((detail) => detail.semesterId),
      semesterDetails: uniqueDetails,
    })
    // Update editingProjectId.value with the value on the right.
    editingProjectId.value = null
    // Update editDraft.value with the value on the right.
    editDraft.value = null
  }

  // Define the helper that will begin skill edit.
  function beginSkillEdit(project: Project, semesterId: string) {
    // Update editingSkillsKey.value with the value on the right.
    editingSkillsKey.value = `${project.id}:${semesterId}`
    // Update skillDraft.value with the value on the right.
    skillDraft.value = teamSkillsForSemester(project, semesterId).join(', ')
  }

  // Define the helper that will confirm save skills.
  function confirmSaveSkills(project: Project, semesterId: string) {
    // Use Array.from to initialize skills.
    const skills = Array.from(
      new Set(
        skillDraft.value
          .split(',')
          .map((skill) => skill.trim())
          .filter(Boolean)
      )
    )
    // Use semesterDetail to initialize existing.
    const existing = semesterDetail(project, semesterId)
    // Use contactForSemester to initialize contact.
    const contact = contactForSemester(project, semesterId)
    // Use mentorForSemester to initialize mentor.
    const mentor = mentorForSemester(project, semesterId)
    // Define detail for the steps below.
    const detail: ProjectSemesterDetail = {
      semesterId,
      contactName: existing?.contactName ?? contact.name,
      contactEmail: existing?.contactEmail ?? contact.email,
      contactPhone: existing?.contactPhone ?? contact.phone,
      mentorName: existing?.mentorName ?? mentor.name,
      mentorEmail: existing?.mentorEmail ?? mentor.email,
      teamSkills: skills,
      status: existing?.status,
      statusNote: existing?.statusNote,
    }
    // Call updateProject to run this step.
    updateProject(project.id, {
      semesterDetails: [
        ...(project.semesterDetails ?? []).filter((item) => item.semesterId !== semesterId),
        detail,
      ],
    })
    // Update editingSkillsKey.value with the value on the right.
    editingSkillsKey.value = null
    // Update skillDraft.value with the value on the right.
    skillDraft.value = ''
  }
  // Define the helper that will save semester status.
  function saveSemesterStatus(
    project: Project,
    semesterId: string,
    status: Project['status'],
    statusNote: string
  ) {
    // Use semesterDetail to initialize existing.
    const existing = semesterDetail(project, semesterId)
    // Use contactForSemester to initialize contact.
    const contact = contactForSemester(project, semesterId)
    // Use mentorForSemester to initialize mentor.
    const mentor = mentorForSemester(project, semesterId)

    // Define detail for the steps below.
    const detail: ProjectSemesterDetail = {
      semesterId,
      contactName: existing?.contactName ?? contact.name,
      contactEmail: existing?.contactEmail ?? contact.email,
      contactPhone: existing?.contactPhone ?? contact.phone,
      mentorName: existing?.mentorName ?? mentor.name,
      mentorEmail: existing?.mentorEmail ?? mentor.email,
      teamSkills: existing?.teamSkills,
      status,
      statusNote,
    }

    // Call updateProject to run this step.
    updateProject(project.id, {
      semesterDetails: [
        ...(project.semesterDetails ?? []).filter((item) => item.semesterId !== semesterId),
        detail,
      ],
    })
  }
</script>

<template>
  <div style="padding: 28px 32px">
    <div class="section-title-row">
      <h1 class="font-display" style="font-size: 20px; font-weight: 700; color: #1a3a1a">
        Projects
      </h1>
      <div class="title-actions">
        <button class="secondary-button" @click="openContinuationForm">
          {{ showContinuationForm ? 'Cancel Continuation' : 'Continue Existing Project' }}
        </button>
        <button class="primary-button" @click="openAddForm">
          {{ showAddForm ? 'Cancel' : 'Add New Project' }}
        </button>
      </div>
    </div>

    <form v-if="showAddForm" class="stat-card add-record-form" @submit.prevent="confirmAddProject">
      <div class="form-heading">
        <div>
          <h2>Add Project</h2>
          <p>Review the project information before confirming the new record.</p>
        </div>
      </div>
      <div v-for="(project, index) in newProjects" :key="index" class="bulk-entry-row">
        <div class="bulk-entry-heading">
          <strong>Project {{ index + 1 }}</strong>
          <button
            v-if="newProjects.length > 1"
            class="remove-button"
            type="button"
            @click="newProjects.splice(index, 1)"
          >
            Remove Row
          </button>
        </div>
        <div class="form-grid">
          <label
            ><span>Project Number</span
            ><input v-model="project.projectNumber" type="text" placeholder="Optional"
          /></label>
          <label
            ><span>Project Title</span><input v-model="project.name" type="text" required
          /></label>
          <label>
            <span>Community Partner</span>
            <select v-model="project.partnerId">
              <option v-for="partner in partners" :key="partner.id" :value="partner.id">
                {{ partner.name }}
              </option>
            </select>
          </label>
          <label>
            <span>Semester</span>
            <select v-model="project.semesterId">
              <option v-for="semester in semesters" :key="semester.id" :value="semester.id">
                {{ semester.label }}
              </option>
            </select>
          </label>
          <label>
            <span>Status</span>
            <select v-model="project.status">
              <option value="New">New</option>
              <option value="In Progress">In Progress</option>
              <option value="Paused">Paused</option>
              <option value="Completed">Completed</option>
              <option value="Dropped">Dropped</option>
            </select>
          </label>
          <label
            ><span>Project Mentor</span
            ><input v-model="project.mentorName" type="text" placeholder="Optional"
          /></label>
          <label
            ><span>Mentor Email</span
            ><input v-model="project.mentorEmail" type="text" placeholder="Optional"
          /></label>
        </div>
      </div>
      <div class="add-row-bar">
        <button class="secondary-button" type="button" @click="newProjects.push(blankProject())">
          Add Another Project
        </button>
      </div>
      <div class="confirmation-bar">
        <span
          >This action will add {{ newProjects.length }} project record{{
            newProjects.length === 1 ? '' : 's'
          }}.</span
        >
        <button class="confirm-button" type="submit">
          Confirm Add {{ newProjects.length }} Project{{ newProjects.length === 1 ? '' : 's' }}
        </button>
      </div>
    </form>

    <form
      v-if="showContinuationForm"
      class="stat-card add-record-form"
      @submit.prevent="confirmContinuations"
    >
      <div class="form-heading">
        <div>
          <h2>Continue Existing Projects</h2>
          <p>
            Choose projects from the list checkboxes or use the dropdown in each row. Multiple
            continuations can be saved together.
          </p>
        </div>
      </div>
      <div class="continuation-source-bar">
        <span>{{ selectedProjects.length }} projects currently selected from the list</span>
        <button
          v-if="selectedProjects.length"
          class="secondary-button"
          type="button"
          @click="loadSelectedContinuations"
        >
          Load Selected Projects
        </button>
      </div>
      <div v-for="(continuation, index) in continuations" :key="index" class="bulk-entry-row">
        <div class="bulk-entry-heading">
          <strong>Continuation {{ index + 1 }}</strong>
          <button
            v-if="continuations.length > 1"
            class="remove-button"
            type="button"
            @click="continuations.splice(index, 1)"
          >
            Remove Row
          </button>
        </div>
        <div class="form-grid">
          <label>
            <span>Existing Project</span>
            <select
              v-model="continuation.projectId"
              @change="prepareContinuation(index, continuation.projectId)"
            >
              <option v-for="project in projects" :key="project.id" :value="project.id">
                {{ project.projectNumber ? `#${project.projectNumber} · ` : '' }}{{ project.name }}
              </option>
            </select>
          </label>
          <label>
            <span>Continuation Semester</span>
            <select v-model="continuation.semesterId">
              <option
                v-for="semester in semesters"
                :key="semester.id"
                :value="semester.id"
                :disabled="isExistingContinuationSemester(continuation.projectId, semester.id)"
              >
                {{ semester.label
                }}{{
                  isExistingContinuationSemester(continuation.projectId, semester.id)
                    ? ' · Already included'
                    : ''
                }}
              </option>
            </select>
          </label>
          <label
            ><span>Partner Contact</span><input v-model="continuation.contactName" type="text"
          /></label>
          <label
            ><span>Contact Email</span><input v-model="continuation.contactEmail" type="text"
          /></label>
          <label
            ><span>Contact Phone</span><input v-model="continuation.contactPhone" type="text"
          /></label>
          <label
            ><span>Project Mentor</span><input v-model="continuation.mentorName" type="text"
          /></label>
          <label
            ><span>Mentor Email</span><input v-model="continuation.mentorEmail" type="text"
          /></label>
        </div>
      </div>
      <div class="add-row-bar">
        <button class="secondary-button" type="button" @click="addContinuationRow">
          Add Another Continuation
        </button>
      </div>
      <div class="continuation-note">
        <strong>No duplicate projects will be created.</strong>
        Each selected semester is added to its existing project timeline.
      </div>
      <div class="confirmation-bar">
        <span
          >Confirm {{ continuations.length }} project continuation{{
            continuations.length === 1 ? '' : 's'
          }}
          together.</span
        >
        <button class="confirm-button" type="submit">
          Confirm {{ continuations.length }} Continuation{{ continuations.length === 1 ? '' : 's' }}
        </button>
      </div>
    </form>

    <div class="filter-bar" style="margin-bottom: 16px">
      <input
        v-model="projectSearchDraft"
        type="search"
        placeholder="Search title, number, partner, or mentor…"
        style="width: 280px"
        @input="applyProjectSearch"
        @keydown.enter.prevent="applyProjectSearch"
      />
      <button class="primary-button compact-filter-button" @click="applyProjectSearch">
        Search
      </button>
      <button
        v-if="projectSearch"
        class="secondary-button compact-filter-button"
        @click="clearProjectSearch"
      >
        Clear
      </button>
      <select v-model="semFilter">
        <option value="all">All Semesters</option>
        <option v-for="s in semesters" :key="s.id" :value="s.id">{{ s.label }}</option>
      </select>
      <select v-model="statusFilter">
        <option value="all">All Statuses</option>
        <option value="New">New</option>
        <option value="In Progress">In Progress</option>
        <option value="Paused">Paused</option>
        <option value="Completed">Completed</option>
        <option value="Dropped">Dropped</option>
      </select>
      <select v-model="partnerFilter">
        <option value="all">All Partners</option>
        <option v-for="p in partners" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
      <span style="color: #5a6b52; font-size: 12px; margin-left: auto"
        >{{ filtered.length }} projects</span
      >
    </div>

    <p class="muted-cell" style="margin:0 0 14px">Sorted by project name A–Z</p>
    <div class="bulk-toolbar">
      <div class="bulk-selection">
        <button class="secondary-button" @click="toggleAllFiltered">
          {{ allFilteredSelected ? 'Deselect All Results' : 'Select All Results' }}
        </button>
        <span>{{ selectedProjects.length }} selected</span>
      </div>
      <div v-if="selectedProjects.length" class="bulk-actions">
        <template v-if="confirmingRemoval">
          <span
            >Remove {{ selectedProjects.length }} selected project{{
              selectedProjects.length === 1 ? '' : 's'
            }}?</span
          >
          <button class="danger-button" @click="confirmRemoveSelectedProjects">
            Confirm Remove
          </button>
          <button class="cancel-button" @click="confirmingRemoval = false">Cancel</button>
        </template>
        <template v-else>
          <button class="secondary-button" @click="startSelectedContinuations">
            Continue Selected
          </button>
          <button class="cancel-button" @click="selectedProjects = []">Clear Selection</button>
          <button class="remove-button" @click="confirmingRemoval = true">Remove Selected</button>
        </template>
      </div>
    </div>

    <div style="display: flex; flex-direction: column; gap: 12px">
      <div
        v-for="pr in paginatedProjects" :id="`project-${pr.id}`"
        :key="pr.id"
        class="stat-card"
        style="padding: 0; overflow: hidden; cursor: pointer"
        @click="openProject(pr.id, pr.semesters)"
      >
        <div :class="{ 'new-project-heading': getProjectSemesterStatus(pr, expanded === pr.id ? currentSemester(pr.id, pr.semesters) : semFilter !== 'all' ? semFilter : latestProjectSemester(pr)) === 'New' }" style="padding: 14px 20px; display: flex; align-items: center; gap: 16px">
          <div class="project-selection" @click.stop>
            <input
              v-model="selectedProjects"
              type="checkbox"
              :value="pr.id"
              :aria-label="`Select ${pr.name}`"
            />
          </div>
          <div style="flex: 1">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px">
              <span style="font-weight: 700; font-size: 14px; color: #1a3a1a">
                <span v-if="pr.projectNumber" class="mono" style="color: #c45c1a"
                  >#{{ pr.projectNumber }}</span
                >
                {{ pr.name }}
              </span>
              <StatusBadge
                :status="
                  getProjectSemesterStatus(
                    pr,
                    expanded === pr.id
                      ? currentSemester(pr.id, pr.semesters)
                      : semFilter !== 'all' && pr.semesters.includes(semFilter)
                        ? semFilter
                        : latestProjectSemester(pr)
                  )
                "
              />
              <button
                class="pin-button"
                :class="{ active: isPinned(pr.id) }"
                @click.stop="
                  emit('togglePin', {
                    key: `project:${pr.id}`,
                    type: 'project',
                    id: pr.id,
                    title: pr.name,
                    subtitle: getPartnerById(pr.partnerId)?.name ?? '',
                  })
                "
              >
                {{ isPinned(pr.id) ? 'Pinned' : 'Pin' }}
              </button>
              <button class="secondary-button compact-button" @click.stop="beginEdit(pr)">
                Edit Project
              </button>
            </div>
            <div style="font-size: 12px; color: #5a6b52">
              {{ getPartnerById(pr.partnerId)?.name }} · {{ pr.description }}
            </div>
          </div>
          <div style="display: flex; gap: 20px; align-items: center">
            <div style="text-align: center">
              <div class="mono" style="font-weight: 700; font-size: 18px; color: #c45c1a">
                {{ pr.semesters.length }}
              </div>
              <div style="font-size: 10.5px; color: #5a6b52">semesters</div>
            </div>

            <span style="color: #5a6b52; font-size: 18px">
              {{ expanded === pr.id ? '▲' : '▼' }}
            </span>
          </div>
        </div>
        <form
          v-if="editingProjectId === pr.id && editDraft"
          class="project-edit-panel"
          @click.stop
          @submit.prevent="confirmSaveProject"
        >
          <div class="form-heading edit-heading">
            <div>
              <h2>Edit {{ pr.name }}</h2>
              <p>Update the current project or add semester-specific contacts for a future term.</p>
            </div>
            <button
              class="cancel-button"
              type="button"
              @click="
                editingProjectId = null;
                editDraft = null
              "
            >
              Close
            </button>
          </div>
          <div class="form-grid">
            <label
              ><span>Project Title</span><input v-model="editDraft.name" type="text" required
            /></label>
            <label>
              <span>Community Partner</span>
              <select v-model="editDraft.partnerId">
                <option v-for="partner in partners" :key="partner.id" :value="partner.id">
                  {{ partner.name }}
                </option>
              </select>
            </label>
            <label>
              <span>Status</span>
              <select v-model="editDraft.status">
                <option value="New">New</option>
                <option value="In Progress">In Progress</option>
                <option value="Paused">Paused</option>
                <option value="Completed">Completed</option>
                <option value="Dropped">Dropped</option>
              </select>
            </label>
            <label class="form-span-full"
              ><span>Description</span><input v-model="editDraft.description" type="text"
            /></label>
          </div>
          <div class="semester-editor">
            <div class="semester-editor-heading">
              <div>
                <h3>Semester contacts and mentors</h3>
                <p>Contacts are stored by semester so historical information remains intact.</p>
              </div>
              <button class="secondary-button" type="button" @click="addSemesterDetail">
                Add Next Semester
              </button>
            </div>
            <div
              v-for="(detail, index) in editDraft.semesterDetails"
              :key="`${detail.semesterId}-${index}`"
              class="semester-contact-row"
            >
              <label>
                <span>Semester</span>
                <select v-model="detail.semesterId">
                  <option v-for="semester in semesters" :key="semester.id" :value="semester.id">
                    {{ semester.label }}
                  </option>
                </select>
              </label>
              <label
                ><span>Partner Contact</span><input v-model="detail.contactName" type="text"
              /></label>
              <label
                ><span>Contact Email</span><input v-model="detail.contactEmail" type="text"
              /></label>
              <label
                ><span>Contact Phone</span><input v-model="detail.contactPhone" type="text"
              /></label>
              <label
                ><span>Project Mentor</span><input v-model="detail.mentorName" type="text"
              /></label>
              <label
                ><span>Mentor Email</span><input v-model="detail.mentorEmail" type="text"
              /></label>
              <button
                v-if="editDraft.semesterDetails.length > 1"
                class="remove-button semester-remove"
                type="button"
                @click="editDraft.semesterDetails.splice(index, 1)"
              >
                Remove Semester
              </button>
            </div>
          </div>
          <div class="confirmation-bar">
            <span>Confirm to save the project and all semester-specific contact changes.</span>
            <button class="confirm-button" type="submit">Confirm Save Changes</button>
          </div>
        </form>
        <div v-if="expanded === pr.id" class="project-detail" @click.stop>
          <div class="semester-tabs" aria-label="Choose project semester">
            <button
              v-for="semesterId in pr.semesters"
              :key="semesterId"
              class="semester-tab"
              :class="{ active: currentSemester(pr.id, pr.semesters) === semesterId }"
              @click="selectedSemester[pr.id] = semesterId"
            >
              {{ getSemesterLabel(semesterId) }}
            </button>
          </div>
          <div style="padding: 16px 0">
            <div class="detail-label">Semester Status</div>

            <select
              style="
                width: 220px;
                max-width: 100%;
                padding: 10px 12px;
                border: 1px solid #cbd5c0;
                border-radius: 8px;
                background: #ffffff;
                color: #1a3a1a;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
              "
              :value="
                semesterStatusDraft[`${pr.id}-${currentSemester(pr.id, pr.semesters)}`] ??
                semesterDetail(pr, currentSemester(pr.id, pr.semesters))?.status ??
                ''
              "
              @change="
                semesterStatusDraft[`${pr.id}-${currentSemester(pr.id, pr.semesters)}`] = (
                  $event.target as HTMLSelectElement
                ).value as Project['status']
              "
            >
              <option value="" disabled>Select status</option>
              <option value="New">New</option>
              <option value="In Progress">In Progress</option>
              <option value="Paused">Paused</option>
              <option value="Completed">Completed</option>
              <option value="Dropped">Dropped</option>
            </select>

            <div class="detail-label" style="margin-top: 12px">Status Notes</div>

            <textarea
              :value="
                semesterNoteDraft[`${pr.id}-${currentSemester(pr.id, pr.semesters)}`] ??
                semesterDetail(pr, currentSemester(pr.id, pr.semesters))?.statusNote ??
                ''
              "
              @input="
                semesterNoteDraft[`${pr.id}-${currentSemester(pr.id, pr.semesters)}`] = (
                  $event.target as HTMLTextAreaElement
                ).value
              "
              placeholder="Optional notes about this semester's status"
              rows="3"
              style="
                width: 100%;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 6px;
                margin-top: 6px;
                background: #ffffff;
                color: #1a3a1a;
                caret-color: #1a3a1a;
              "
            ></textarea>

            <button
              class="secondary-button"
              style="margin-top: 12px"
              @click="
                saveSemesterStatus(
                  pr,
                  currentSemester(pr.id, pr.semesters),
                  (semesterStatusDraft[`${pr.id}-${currentSemester(pr.id, pr.semesters)}`] ??
                    semesterDetail(pr, currentSemester(pr.id, pr.semesters))?.status)!,
                  semesterNoteDraft[`${pr.id}-${currentSemester(pr.id, pr.semesters)}`] ??
                    semesterDetail(pr, currentSemester(pr.id, pr.semesters))?.statusNote ??
                    ''
                )
              "
            >
              Save Semester Status
            </button>
          </div>

          <div class="project-detail-grid">
            <div class="project-roster">
              <div class="roster-heading">
                <div>
                  <div class="detail-label">
                    Student roster · {{ getSemesterLabel(currentSemester(pr.id, pr.semesters)) }}
                  </div>
                  <div class="muted-cell">{{ selectedRoster(pr.id).length }} selected</div>
                </div>
                <button
                  class="secondary-button compact-button"
                  @click="toggleAllRosterAssignments(pr, currentSemester(pr.id, pr.semesters))"
                >
                  Select / Deselect All
                </button>
              </div>
              <div
                v-for="student in getOfficialProjectRoster(pr.id, currentSemester(pr.id, pr.semesters))"
                :key="student.name"
                class="roster-row"
              >
                <input
                  type="checkbox"
                  :checked="selectedRoster(pr.id).includes(`official:${student.name}`)"
                  :aria-label="`Select ${student.name}`"
                  @change="toggleRosterAssignment(pr.id, `official:${student.name}`)"
                />
                <div>
                  <div class="strong-cell">{{ student.name }}</div>
                  <div class="muted-cell">{{ student.major }}</div>
                </div>
              </div>
              <div
                v-for="student in projectStudents(pr.id, currentSemester(pr.id, pr.semesters))"
                :key="student.id"
                class="roster-row"
              >
                <input
                  type="checkbox"
                  :checked="selectedRoster(pr.id).includes(`student:${student.id}`)"
                  :aria-label="`Select ${student.name}`"
                  @change="toggleRosterAssignment(pr.id, `student:${student.id}`)"
                />
                <div>
                  <button class="record-link" @click="emit('openStudent', student.id, currentSemester(pr.id, pr.semesters))">
                    {{ student.name }}
                  </button>
                  <div class="muted-cell">{{ student.major }}</div>
                </div>
                <span
                  v-if="student.id === peerLeadId(pr.id, currentSemester(pr.id, pr.semesters))"
                  class="badge badge-returning"
                  >Peer Lead</span
                >
              </div>
              <div
                v-if="
                  !getOfficialProjectRoster(pr.id, currentSemester(pr.id, pr.semesters)).length &&
                  !projectStudents(pr.id, currentSemester(pr.id, pr.semesters)).length
                "
                class="empty-cell"
              >
                No student assignments recorded for this semester.
              </div>
              <div v-if="selectedRoster(pr.id).length" class="roster-removal-actions">
                <template v-if="confirmingRosterRemoval === pr.id">
                  <input
                    v-model="rosterRemovalNote"
                    type="text"
                    placeholder="Reason, such as moved to another project or withdrew"
                  />
                  <button
                    class="danger-button"
                    @click="
                      confirmRosterAssignmentsRemoval(pr, currentSemester(pr.id, pr.semesters))
                    "
                  >
                    Confirm Remove from Project
                  </button>
                  <button class="cancel-button" @click="confirmingRosterRemoval = null">
                    Cancel
                  </button>
                </template>
                <template v-else>
                  <button class="remove-button" @click="confirmingRosterRemoval = pr.id">
                    Remove {{ selectedRoster(pr.id).length }} from This Project
                  </button>
                </template>
              </div>
            </div>
            <div>
              <div class="detail-label">Community partner contact</div>
              <div class="strong-cell">
                {{ contactForSemester(pr, currentSemester(pr.id, pr.semesters)).name }}
              </div>
              <div class="muted-cell">
                {{ contactForSemester(pr, currentSemester(pr.id, pr.semesters)).email }}
              </div>
              <div class="muted-cell">
                {{ contactForSemester(pr, currentSemester(pr.id, pr.semesters)).phone }}
              </div>
              <div class="verified-note">
                Contact for {{ getSemesterLabel(currentSemester(pr.id, pr.semesters)) }}
              </div>
            </div>
            <div>
              <template v-if="mentorForSemester(pr, currentSemester(pr.id, pr.semesters)).name">
                <div class="detail-label">Project mentor</div>
                <div class="strong-cell">
                  {{ mentorForSemester(pr, currentSemester(pr.id, pr.semesters)).name }}
                </div>
                <div class="muted-cell">
                  {{ mentorForSemester(pr, currentSemester(pr.id, pr.semesters)).email }}
                </div>
              </template>
              <div class="team-skills-section">
                <div class="team-skills-heading">
                  <div class="detail-label">Team skills</div>
                  <button
                    class="text-button"
                    @click="beginSkillEdit(pr, currentSemester(pr.id, pr.semesters))"
                  >
                    {{
                      teamSkillsForSemester(pr, currentSemester(pr.id, pr.semesters)).length
                        ? 'Edit Skills'
                        : 'Add Skills'
                    }}
                  </button>
                </div>
                <div
                  v-if="editingSkillsKey === `${pr.id}:${currentSemester(pr.id, pr.semesters)}`"
                  class="skill-editor"
                >
                  <input
                    v-model="skillDraft"
                    type="text"
                    placeholder="Enter skills separated by commas"
                    @keydown.enter.prevent="
                      confirmSaveSkills(pr, currentSemester(pr.id, pr.semesters))
                    "
                  />
                  <div class="confirm-actions">
                    <button
                      class="confirm-button"
                      @click="confirmSaveSkills(pr, currentSemester(pr.id, pr.semesters))"
                    >
                      Confirm Save Skills
                    </button>
                    <button
                      class="cancel-button"
                      @click="
                        editingSkillsKey = null;
                        skillDraft = ''
                      "
                    >
                      Cancel
                    </button>
                  </div>
                  <span>Example: React, Python, CAD, Data Analysis</span>
                </div>
              </div>
              <div class="skill-list">
                <span
                  v-for="skill in teamSkillsForSemester(pr, currentSemester(pr.id, pr.semesters))"
                  :key="skill"
                  class="badge skill-badge"
                >
                  {{ skill }}
                </span>
                <span
                  v-if="!teamSkillsForSemester(pr, currentSemester(pr.id, pr.semesters)).length"
                  class="muted-cell"
                >
                  No skills added for this semester.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-if="!filtered.length" class="stat-card project-no-results">
        <strong>No projects found</strong>
        <span>Try a different project title, number, partner, mentor, or filter selection.</span>
        <button v-if="projectSearch" class="secondary-button" @click="clearProjectSearch">
          Clear Search
        </button>
      </div>
    </div>

    <!-- Projects Pagination -->
    <div
      v-if="filtered.length > 0"
      style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 16px;
        padding: 12px 4px;
      "
    >
      <span style="font-size: 13px; color: #5a6b52">
        <template v-if="filtered.length === 0"> No projects found </template>
        <template v-else>
          Showing
          {{ (currentPage - 1) * projectsPerPage + 1 }}–{{
            Math.min(currentPage * projectsPerPage, filtered.length)
          }}
          of {{ filtered.length }} projects (Page {{ currentPage }} of {{ totalPages }})
        </template>
      </span>

      <div style="display: flex; gap: 8px">
        <button class="secondary-button" :disabled="currentPage === 1" @click="currentPage--">
          Previous
        </button>

        <button
          class="secondary-button"
          :disabled="currentPage === totalPages"
          @click="currentPage++"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.new-project-heading { background: color-mix(in srgb, #e98a40 14%, var(--card, #fff)); }
.new-project-heading :is(button.secondary-button, button.pin-button) {
  background: color-mix(in srgb, #e98a40 18%, var(--card, #fff));
  border-color: color-mix(in srgb, #b85d20 38%, var(--border, #cdd8c5));
  color: var(--foreground);
}
.new-project-heading :is(button.secondary-button, button.pin-button):is(:hover, .active, :focus-visible) {
  background: color-mix(in srgb, #e98a40 32%, var(--card, #fff));
}
</style>
