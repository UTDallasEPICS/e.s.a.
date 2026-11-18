<script setup lang="ts">
  import { ref, computed, watch } from 'vue'
  import {
    projects,
    partners,
    students,
    semesters,
    teams,
    officialProjectRosters,
    getPartnerById,
    getSemesterLabel,
  } from '../data'
  import type { Project, ProjectSemesterDetail } from '../data'
  import StatusBadge from './StatusBadge.vue'
  import type { PinnedItem } from '../types'
  import {
    addProject,
    removeProject,
    updateProject,
    removeProjectAssignments,
  } from '../contentStore'

  const semesterStatusDraft = ref<Record<string, Project['status']>>({})
  const semesterNoteDraft = ref<Record<string, string>>({})
  const semFilter = useState<string>('epics-selected-semester', () => 'FA26')
  const statusFilter = ref('all')
  const partnerFilter = ref('all')
  const projectSearchDraft = ref('')
  const projectSearch = ref('')
  const expanded = ref<string | null>(null)
  const selectedSemester = ref<Record<string, string>>({})
  const showAddForm = ref(false)
  const showContinuationForm = ref(false)
  const selectedProjects = ref<string[]>([])
  const confirmingRemoval = ref(false)
  const editingProjectId = ref<string | null>(null)
  const selectedRosterAssignments = ref<Record<string, string[]>>({})
  const confirmingRosterRemoval = ref<string | null>(null)
  const rosterRemovalNote = ref('')
  const editingSkillsKey = ref<string | null>(null)
  const skillDraft = ref('')
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
  const blankProject = (): NewProject => ({
    projectNumber: '',
    name: '',
    partnerId: partners[0]?.id ?? '',
    status: 'New',
    semesterId: 'SP26',
    mentorName: '',
    mentorEmail: '',
  })
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
  const continuations = ref<ContinuationDraft[]>([])
  const props = defineProps<{
    initialProjectId?: string | null
    initialSemesterId?: string | null
    pinnedItems: PinnedItem[]
  }>()
  const emit = defineEmits<{ openStudent: [studentId: string]; togglePin: [item: PinnedItem] }>()

  watch(
    [() => props.initialProjectId, () => props.initialSemesterId],
    ([projectId, semesterId]) => {
      if (!projectId) return
      expanded.value = projectId
      const project = projects.find((item) => item.id === projectId)
      selectedSemester.value[projectId] =
        semesterId && project?.semesters.includes(semesterId)
          ? semesterId
          : (project?.semesters[project.semesters.length - 1] ?? '')
    },
    { immediate: true }
  )

  const filtered = computed(() =>
    projects.filter((p) => {
      const query = projectSearch.value.trim().toLowerCase()
      const partner = getPartnerById(p.partnerId)
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
      if (query && !searchableText.includes(query)) return false
      if (semFilter.value !== 'all' && !p.semesters.includes(semFilter.value)) return false
      if (statusFilter.value !== 'all' && p.status !== statusFilter.value) return false
      if (partnerFilter.value !== 'all' && p.partnerId !== partnerFilter.value) return false
      return true
    })
  )

  const currentPage = ref(1)
  const projectsPerPage = 10

  const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / projectsPerPage)))

  const paginatedProjects = computed(() => {
    const start = (currentPage.value - 1) * projectsPerPage
    return filtered.value.slice(start, start + projectsPerPage)
  })

  watch([projectSearch, semFilter, statusFilter, partnerFilter], () => {
    currentPage.value = 1
  })

  function applyProjectSearch() {
    projectSearch.value = projectSearchDraft.value.trim()
    selectedProjects.value = []
    confirmingRemoval.value = false
  }

  function clearProjectSearch() {
    projectSearchDraft.value = ''
    projectSearch.value = ''
  }

  function projectStudents(projectId: string, semesterId?: string) {
    const memberships = teams.filter(
      (team) => team.projectId === projectId && (!semesterId || team.semesterId === semesterId)
    )
    const studentIds = new Set(memberships.flatMap((team) => team.studentIds))
    return students.filter((student) => studentIds.has(student.id))
  }

  function peerLeadId(projectId: string, semesterId: string) {
    return teams.find((team) => team.projectId === projectId && team.semesterId === semesterId)
      ?.peerLeadId
  }

  function openProject(projectId: string, projectSemesters: string[]) {
    const isOpening = expanded.value !== projectId
    expanded.value = isOpening ? projectId : null

    if (isOpening) {
      selectedSemester.value[projectId] =
        semFilter.value !== 'all' && projectSemesters.includes(semFilter.value)
          ? semFilter.value
          : (projectSemesters[projectSemesters.length - 1] ?? '')
    }
  }

  function selectedRoster(projectId: string) {
    return selectedRosterAssignments.value[projectId] ?? []
  }

  function toggleRosterAssignment(projectId: string, key: string) {
    const selected = selectedRoster(projectId)
    selectedRosterAssignments.value[projectId] = selected.includes(key)
      ? selected.filter((item) => item !== key)
      : [...selected, key]
    confirmingRosterRemoval.value = null
  }

  function rosterAssignmentKeys(project: Project, semesterId: string) {
    const official = (officialProjectRosters[project.id] ?? []).map(
      (student) => `official:${student.name}`
    )
    const tracked = projectStudents(project.id, semesterId).map(
      (student) => `student:${student.id}`
    )
    return [...official, ...tracked]
  }

  function toggleAllRosterAssignments(project: Project, semesterId: string) {
    const keys = rosterAssignmentKeys(project, semesterId)
    const allSelected =
      keys.length > 0 && keys.every((key) => selectedRoster(project.id).includes(key))
    selectedRosterAssignments.value[project.id] = allSelected ? [] : keys
    confirmingRosterRemoval.value = null
  }

  function confirmRosterAssignmentsRemoval(project: Project, semesterId: string) {
    const selected = selectedRoster(project.id)
    if (!selected.length) return
    removeProjectAssignments(project.id, semesterId, selected, rosterRemovalNote.value.trim())
    selectedRosterAssignments.value[project.id] = []
    confirmingRosterRemoval.value = null
    rosterRemovalNote.value = ''
  }

  function currentSemester(projectId: string, projectSemesters: string[]) {
    return selectedSemester.value[projectId] ?? projectSemesters[projectSemesters.length - 1]
  }

  function projectSkills(projectId: string, semesterId: string) {
    return Array.from(
      new Set(projectStudents(projectId, semesterId).flatMap((student) => student.skills))
    ).slice(0, 8)
  }

  function teamSkillsForSemester(project: Project, semesterId: string) {
    const savedSkills = semesterDetail(project, semesterId)?.teamSkills
    return savedSkills?.length ? savedSkills : projectSkills(project.id, semesterId)
  }

  function rosterCount(projectId: string) {
    return officialProjectRosters[projectId]?.length ?? projectStudents(projectId).length
  }

  function semesterDetail(project: Project, semesterId: string) {
    return project.semesterDetails?.find((detail) => detail.semesterId === semesterId)
  }

  function getProjectSemesterStatus(project: Project, semesterId: string): Project['status'] {
    const savedStatus = semesterDetail(project, semesterId)?.status

    // Preserve explicitly recorded special statuses.
    if (savedStatus === 'Paused' || savedStatus === 'Completed' || savedStatus === 'Dropped') {
      return savedStatus
    }

    const orderedSemesters = [...project.semesters].sort((a, b) => {
      const getOrder = (id: string) => {
        const year = Number(id.slice(-2))
        const term = id.slice(0, -2)
        const termOrder: Record<string, number> = {
          SP: 1,
          SU: 2,
          FA: 3,
        }

        return year * 10 + (termOrder[term] ?? 0)
      }

      return getOrder(a) - getOrder(b)
    })

    const firstSemester = orderedSemesters[0]
    const lastSemester = orderedSemesters[orderedSemesters.length - 1]

    // Apply the project's overall special status only to its last semester.
    if (
      semesterId === lastSemester &&
      (project.status === 'Paused' ||
        project.status === 'Completed' ||
        project.status === 'Dropped')
    ) {
      return project.status
    }

    return semesterId === firstSemester ? 'New' : 'In Progress'
  }

  function contactForSemester(project: Project, semesterId: string) {
    const detail = semesterDetail(project, semesterId)
    const partner = getPartnerById(project.partnerId)
    return {
      name: detail?.contactName || partner?.contact || '',
      email: detail?.contactEmail || partner?.email || '',
      phone: detail?.contactPhone || partner?.phone || '',
    }
  }

  function mentorForSemester(project: Project, semesterId: string) {
    const detail = semesterDetail(project, semesterId)
    return {
      name: detail?.mentorName || project.mentorName || '',
      email: detail?.mentorEmail || project.mentorEmail || '',
    }
  }

  function isPinned(projectId: string) {
    return props.pinnedItems.some((item) => item.key === `project:${projectId}`)
  }

  function confirmAddProject() {
    const validProjects = newProjects.value.filter(
      (project) => project.name.trim() && project.partnerId
    )
    if (!validProjects.length) return
    validProjects.forEach((project, index) => {
      const projectNumber = Number.parseInt(project.projectNumber, 10)
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
    newProjects.value = [blankProject()]
    showAddForm.value = false
  }

  function nextSemesterFor(project: Project) {
    const indexes = project.semesters.map((semesterId) =>
      semesters.findIndex((semester) => semester.id === semesterId)
    )
    const latestIndex = Math.max(-1, ...indexes)
    return semesters[latestIndex + 1] ?? semesters[latestIndex]
  }

  function isExistingContinuationSemester(projectId: string, semesterId: string) {
    return (
      projects.find((project) => project.id === projectId)?.semesters.includes(semesterId) ?? false
    )
  }

  function continuationDraftFor(projectId: string): ContinuationDraft | null {
    const project = projects.find((item) => item.id === projectId)
    if (!project) return null
    const nextSemester = nextSemesterFor(project)
    const latestSemesterId = project.semesters[project.semesters.length - 1]
    const previousContact = contactForSemester(project, latestSemesterId)
    const previousMentor = mentorForSemester(project, latestSemesterId)
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

  function prepareContinuation(index: number, projectId: string) {
    const draft = continuationDraftFor(projectId)
    if (draft) continuations.value[index] = draft
  }

  function loadSelectedContinuations() {
    const ids = selectedProjects.value.length
      ? selectedProjects.value
      : ([projects[0]?.id].filter(Boolean) as string[])
    continuations.value = ids
      .map(continuationDraftFor)
      .filter((draft): draft is ContinuationDraft => Boolean(draft))
  }

  function addContinuationRow() {
    const unusedProject =
      projects.find(
        (project) => !continuations.value.some((draft) => draft.projectId === project.id)
      ) ?? projects[0]
    if (!unusedProject) return
    const draft = continuationDraftFor(unusedProject.id)
    if (draft) continuations.value.push(draft)
  }

  function openAddForm() {
    showAddForm.value = !showAddForm.value
    showContinuationForm.value = false
  }

  function openContinuationForm() {
    showContinuationForm.value = !showContinuationForm.value
    showAddForm.value = false
    if (showContinuationForm.value) loadSelectedContinuations()
  }

  function startSelectedContinuations() {
    if (!selectedProjects.value.length) return
    showContinuationForm.value = true
    showAddForm.value = false
    loadSelectedContinuations()
  }

  function confirmContinuations() {
    let lastUpdated: ContinuationDraft | null = null
    continuations.value.forEach((continuation) => {
      const project = projects.find((item) => item.id === continuation.projectId)
      if (!project || !continuation.semesterId) return
      const detail: ProjectSemesterDetail = {
        semesterId: continuation.semesterId,
        contactName: continuation.contactName.trim(),
        contactEmail: continuation.contactEmail.trim(),
        contactPhone: continuation.contactPhone.trim(),
        mentorName: continuation.mentorName.trim(),
        mentorEmail: continuation.mentorEmail.trim(),
      }
      const existingDetails: ProjectSemesterDetail[] =
        project.semesterDetails ??
        project.semesters.map((semesterId) => {
          const contact = contactForSemester(project, semesterId)
          const mentor = mentorForSemester(project, semesterId)
          return {
            semesterId,
            contactName: contact.name,
            contactEmail: contact.email,
            contactPhone: contact.phone,
            mentorName: mentor.name,
            mentorEmail: mentor.email,
          }
        })
      updateProject(project.id, {
        status: 'In Progress',
        semesters: Array.from(new Set([...project.semesters, detail.semesterId])),
        semesterDetails: [
          ...existingDetails.filter((existing) => existing.semesterId !== detail.semesterId),
          detail,
        ],
      })
      selectedSemester.value[project.id] = detail.semesterId
      lastUpdated = continuation
    })
    if (lastUpdated) expanded.value = lastUpdated.projectId
    selectedProjects.value = []
    continuations.value = []
    showContinuationForm.value = false
  }

  function confirmRemoveProject(projectId: string) {
    const project = projects.find((item) => item.id === projectId)
    if (project && isPinned(projectId)) {
      emit('togglePin', {
        key: `project:${project.id}`,
        type: 'project',
        id: project.id,
        title: project.name,
        subtitle: getPartnerById(project.partnerId)?.name ?? '',
      })
    }
    removeProject(projectId)
    if (expanded.value === projectId) expanded.value = null
  }

  const allFilteredSelected = computed(
    () =>
      filtered.value.length > 0 &&
      filtered.value.every((project) => selectedProjects.value.includes(project.id))
  )

  function toggleAllFiltered() {
    if (allFilteredSelected.value) {
      const filteredIds = new Set(filtered.value.map((project) => project.id))
      selectedProjects.value = selectedProjects.value.filter((id) => !filteredIds.has(id))
    } else {
      selectedProjects.value = Array.from(
        new Set([...selectedProjects.value, ...filtered.value.map((project) => project.id)])
      )
    }
    confirmingRemoval.value = false
  }

  function confirmRemoveSelectedProjects() {
    selectedProjects.value.forEach(confirmRemoveProject)
    selectedProjects.value = []
    confirmingRemoval.value = false
  }

  function beginEdit(project: Project) {
    const partner = getPartnerById(project.partnerId)
    editingProjectId.value = project.id
    editDraft.value = {
      name: project.name,
      partnerId: project.partnerId,
      status: project.status,
      description: project.description,
      semesterDetails: project.semesters.map((semesterId) => {
        const existing = semesterDetail(project, semesterId)
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

  function addSemesterDetail() {
    if (!editDraft.value) return
    const used = new Set(editDraft.value.semesterDetails.map((detail) => detail.semesterId))
    const latestIndex = Math.max(
      -1,
      ...editDraft.value.semesterDetails.map((detail) =>
        semesters.findIndex((semester) => semester.id === detail.semesterId)
      )
    )
    const nextSemester =
      semesters.slice(latestIndex + 1).find((semester) => !used.has(semester.id)) ??
      semesters.find((semester) => !used.has(semester.id))
    if (!nextSemester) return
    const partner = getPartnerById(editDraft.value.partnerId)
    editDraft.value.semesterDetails.push({
      semesterId: nextSemester.id,
      contactName: partner?.contact ?? '',
      contactEmail: partner?.email ?? '',
      contactPhone: partner?.phone ?? '',
      mentorName: '',
      mentorEmail: '',
    })
  }

  function confirmSaveProject() {
    if (!editingProjectId.value || !editDraft.value || !editDraft.value.name.trim()) return
    const uniqueDetails = Array.from(
      new Map(editDraft.value.semesterDetails.map((detail) => [detail.semesterId, detail])).values()
    )
    updateProject(editingProjectId.value, {
      name: editDraft.value.name.trim(),
      partnerId: editDraft.value.partnerId,
      status: editDraft.value.status,
      description: editDraft.value.description.trim(),
      semesters: uniqueDetails.map((detail) => detail.semesterId),
      semesterDetails: uniqueDetails,
    })
    editingProjectId.value = null
    editDraft.value = null
  }

  function beginSkillEdit(project: Project, semesterId: string) {
    editingSkillsKey.value = `${project.id}:${semesterId}`
    skillDraft.value = teamSkillsForSemester(project, semesterId).join(', ')
  }

  function confirmSaveSkills(project: Project, semesterId: string) {
    const skills = Array.from(
      new Set(
        skillDraft.value
          .split(',')
          .map((skill) => skill.trim())
          .filter(Boolean)
      )
    )
    const existing = semesterDetail(project, semesterId)
    const contact = contactForSemester(project, semesterId)
    const mentor = mentorForSemester(project, semesterId)
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
    updateProject(project.id, {
      semesterDetails: [
        ...(project.semesterDetails ?? []).filter((item) => item.semesterId !== semesterId),
        detail,
      ],
    })
    editingSkillsKey.value = null
    skillDraft.value = ''
  }
  function saveSemesterStatus(
    project: Project,
    semesterId: string,
    status: Project['status'],
    statusNote: string
  ) {
    const existing = semesterDetail(project, semesterId)
    const contact = contactForSemester(project, semesterId)
    const mentor = mentorForSemester(project, semesterId)

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
        v-for="pr in paginatedProjects"
        :key="pr.id"
        class="stat-card"
        style="padding: 0; overflow: hidden; cursor: pointer"
        @click="openProject(pr.id, pr.semesters)"
      >
        <div style="padding: 14px 20px; display: flex; align-items: center; gap: 16px">
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
                        : pr.semesters[pr.semesters.length - 1]
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
                v-for="student in officialProjectRosters[pr.id]"
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
                  <button class="record-link" @click="emit('openStudent', student.id)">
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
                  !officialProjectRosters[pr.id]?.length &&
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
