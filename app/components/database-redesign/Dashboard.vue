<script setup lang="ts">
import { computed, ref } from 'vue'
import { students, projects, semesters, teams, officialProjectRosters, getPartnerById, getSemesterLabel, getClassStanding } from '../data'
import StatusBadge from './StatusBadge.vue'
import type { PinnedItem } from '../types'

// Infer the project type directly from the existing project data.
type Project = (typeof projects)[number]

const props = defineProps<{ pinnedItems: PinnedItem[] }>()
const emit = defineEmits<{
  navigate: [page: string]
  openProject: [projectId: string, semesterId: string]
  openStudent: [studentId: string]
  openInsight: [insightId: string]
  togglePin: [item: PinnedItem]
}>()
const selectedSemester = useState<string>(
  'epics-selected-semester',
  () => 'FA26'
)

const searchQuery = ref('')

const selectedDashboardProjectId = ref<string | null>(null)

const selectedDashboardProject = computed(() =>
  projects.find(
    project => project.id === selectedDashboardProjectId.value
  ) ?? null
)

const popupSemester = ref('')

const popupTeamSkills = computed(() => {
  const project = selectedDashboardProject.value
  if (!project || !popupSemester.value) return []

  const savedSkills = project.semesterDetails?.find(
    detail => detail.semesterId === popupSemester.value
  )?.teamSkills

  if (savedSkills?.length) return savedSkills

  return Array.from(
    new Set(popupStudents.value.flatMap(student => student.skills))
  ).slice(0, 8)
})

const popupStudents = computed(() => {
  if (!selectedDashboardProject.value || !popupSemester.value) {
    return []
  }

  const studentIds = new Set(
    teams
      .filter(
        team =>
          team.projectId === selectedDashboardProject.value!.id &&
          team.semesterId === popupSemester.value
      )
      .flatMap(team => team.studentIds)
  )

  return students.filter(student => studentIds.has(student.id))
})

const filteredProjects = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  if (!query) return semesterProjects.value

  return semesterProjects.value.filter(project =>
    project.name.toLowerCase().includes(query) ||
    (getPartnerById(project.partnerId)?.name ?? '')
      .toLowerCase()
      .includes(query)
  )
})

const semesterStudents = computed(() =>
  selectedSemester.value === 'all'
    ? students.filter(student => student.participationStatus !== 'Exited Program')
    : students.filter(student =>
        student.participationStatus !== 'Exited Program' &&
        student.semesters.includes(selectedSemester.value)
      )
)
const semesterProjects = computed(() =>
  projects.filter(project =>
    selectedSemester.value === 'all' ||
    project.semesters.includes(selectedSemester.value)
  )
)
const returningStudents = computed(() =>
  semesterStudents.value.filter(student =>
    selectedSemester.value === 'all'
      ? student.semesters.length > 1
      : student.semesters.indexOf(selectedSemester.value) > 0
  )
)
const firstTimeStudents = computed(() =>
  selectedSemester.value === 'all'
    ? semesterStudents.value.filter(student => student.semesters.length === 1).length
    : semesterStudents.value.length - returningStudents.value.length
)
const returningPct = computed(() =>
  selectedSemester.value === 'SP26'
    ? Math.round((38 / officialSpringRoster.value.length) * 100)
    : semesterStudents.value.length
      ? Math.round((returningStudents.value.length / semesterStudents.value.length) * 100)
    : 0
)
const selectedSemesterLabel = computed(() =>
  selectedSemester.value === 'all' ? 'All semesters' : getSemesterLabel(selectedSemester.value)
)

// Semester IDs use SP, SU, FA followed by the two-digit year.
function semesterOrder(id: string): number {
  const year = Number(id.slice(-2))
  const term = id.slice(0, -2)
  const termOrder: Record<string, number> = { SP: 1, SU: 2, FA: 3 }
  return year * 10 + (termOrder[term] ?? 0)
}

function latestProjectSemester(project: Project): string {
  return [...project.semesters].sort((a, b) => semesterOrder(a) - semesterOrder(b)).at(-1) ?? ''
}

function getDashboardProjectStatusForSemester(
  project: Project,
  semesterId: string
): Project['status'] {
  // A recorded semester-specific special status takes priority.
  const savedStatus = project.semesterDetails?.find(
    detail => detail.semesterId === semesterId
  )?.status

  if (
    savedStatus === 'Paused' ||
    savedStatus === 'Completed' ||
    savedStatus === 'Dropped'
  ) {
    return savedStatus
  }

  const orderedSemesters = [...project.semesters].sort(
    (a, b) => semesterOrder(a) - semesterOrder(b)
  )
  const firstSemester = orderedSemesters[0]
  const lastSemester = orderedSemesters[orderedSemesters.length - 1]

  // Legacy overall special statuses apply only to the final semester.
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

function getDashboardProjectStatus(project: Project): Project['status'] {
  const semesterId = selectedSemester.value === 'all'
    ? latestProjectSemester(project)
    : selectedSemester.value

  return getDashboardProjectStatusForSemester(project, semesterId)
}

const officialSpringRoster = computed(() =>
  Array.from(
    new Map(
      Object.values(officialProjectRosters)
        .flat()
        .map(student => [student.name, student])
    ).values()
  )
)
const displayedStudents = computed(() =>
  selectedSemester.value === 'SP26'
    ? officialSpringRoster.value.map(student => ({ ...student, id: student.name, recordId: null as string | null }))
    : semesterStudents.value.map(student => ({ ...student, recordId: student.id }))
)
const enrollmentCount = computed(() =>
  selectedSemester.value === 'SP26' ? officialSpringRoster.value.length : semesterStudents.value.length
)

const newProjectsCount = computed(() => {
  if (selectedSemester.value === 'all') {
    return projects.length
  }

  return semesterProjects.value.filter(
    project =>
      getDashboardProjectStatusForSemester(
        project,
        selectedSemester.value
      ) === 'New'
  ).length
})

const activeProjectsCount = computed(() =>
  semesterProjects.value.filter(project => {
    if (selectedSemester.value === 'all') {
      return project.semesters.some(semesterId => {
        const status = getDashboardProjectStatusForSemester(project, semesterId)

        return (
          status === 'New' ||
          status === 'In Progress' ||
          status === 'Completed'
        )
      })
    }

    const status = getDashboardProjectStatus(project)

    return (
      status === 'New' ||
      status === 'In Progress' ||
      status === 'Completed'
    )
  }).length
)


const stats = computed(() => [
  { label: 'Enrolled Students', value: enrollmentCount.value, sub: selectedSemester.value === 'SP26' ? '5 course values not listed' : selectedSemesterLabel.value, tone: 'accent' },
  {
      label: 'Active Projects',
      value: activeProjectsCount.value,
      sub: selectedSemester.value === 'all'
        ? `${newProjectsCount.value} projects started across the program`
        : `${newProjectsCount.value} new this semester`,
      tone: 'green'
  },
  {
    label: 'EPCS 2200 Students',
    value: selectedSemester.value === 'SP26' ? 108 : firstTimeStudents.value,
    sub: 'Introductory EPICS course',
    tone: 'gold'
  },
  {
    label: selectedSemester.value === 'SP26' ? 'EPCS 3200 Students' : 'EPCS 3300 Students',
    value: selectedSemester.value === 'SP26' ? 38 : returningStudents.value.length,
    sub: `${returningPct.value}% of enrollment`,
    tone: 'teal'
  },
])

function isPinned(key: string) {
  return props.pinnedItems.some(item => item.key === key)
}

function openPinned(item: PinnedItem) {
  if (item.type === 'project') emit('openProject', item.id, 'SP26')
  else emit('openInsight', item.id)
}
</script>

<template>
  <div class="page-shell">
    <div class="page-header">
      <div>
        <h1 class="page-title">EPICS Program Dashboard</h1>
        <p class="page-subtitle">A semester-specific view of enrollment and project activity</p>
      </div>
      <div class="semester-controls">
        <button
          class="semester-all-button"
          :class="{ active: selectedSemester === 'all' }"
          @click="selectedSemester = 'all'"
        >
          All Semesters
        </button>
        <label class="semester-picker">
          <span>Dashboard semester</span>
          <select v-model="selectedSemester">
            <option value="all">All Semesters</option>
            <option v-for="semester in semesters" :key="semester.id" :value="semester.id">
              {{ semester.label }}
            </option>
          </select>
        </label>
      </div>
    </div>

  <div
    style="display: flex; gap: 12px; margin-bottom: 24px; align-items: center;"
  >
  <input
    v-model="searchQuery"
    type="search"
    placeholder="Search projects..."
    aria-label="Search dashboard projects"
    style="flex: 1; min-width: 0; padding: 12px 16px; border: 1px solid #ccc; border-radius: 8px; font-size: 14px;"
  />

  <button
    class="primary-button"
    @click="emit('navigate', 'chat')"
  >
    AI Search
  </button>
</div>
    <div class="dashboard-stats">
      <div v-for="stat in stats" :key="stat.label" class="stat-card metric-card">
        <div class="metric-value" :class="`metric-${stat.tone}`">{{ stat.value }}</div>
        <div class="metric-label">{{ stat.label }}</div>
        <div class="metric-sub">{{ stat.sub }}</div>
      </div>
    </div>

    <section v-if="pinnedItems.length > 0" class="stat-card pinned-section">
      <div class="panel-heading">
        <div>
          <h2>Pinned Items</h2>
          <p>Keep important projects and insights within reach</p>
        </div>
        <span class="pin-count">{{ pinnedItems.length }} pinned</span>
      </div>
      <div v-if="pinnedItems.length" class="pinned-grid">
        <div v-for="item in pinnedItems" :key="item.key" class="pinned-item">
          <button class="pinned-item-main" @click="openPinned(item)">
            <span class="pinned-type">{{ item.type }}</span>
            <span class="pinned-title">{{ item.title }}</span>
            <span class="muted-cell">{{ item.subtitle }}</span>
          </button>
          <button class="unpin-button" :aria-label="`Unpin ${item.title}`" @click="emit('togglePin', item)">Unpin</button>
        </div>
      </div>
      <div v-else class="pinned-empty">Use the Pin actions on projects and insight charts to add shortcuts here.</div>
    </section>

    <div class="dashboard-grid" style="grid-template-columns: 1fr;">
      <section class="stat-card dashboard-panel">
        <div class="panel-heading">
          <div>
            <h2>{{ selectedSemester === 'all' ? 'All Projects' : 'Projects This Semester' }}</h2>
            <p>{{ selectedSemesterLabel }} project roster</p>
          </div>
          <button class="text-button" @click="emit('navigate', 'projects')">View projects</button>
        </div>
        <table class="data-table">
          <thead><tr><th>Project</th><th>Community Partner</th><th>Status</th><th></th></tr></thead>
          <tbody>
            <tr v-for="project in filteredProjects.slice(0, 8)" :key="project.id">
              <td>
                <button
                  class="record-link"
                  @click="
                    selectedDashboardProjectId = project.id;
                    popupSemester =
                      selectedSemester !== 'all' && project.semesters.includes(selectedSemester)
                        ? selectedSemester
                        : project.semesters[project.semesters.length - 1] ?? ''
                  "
                  >
                  <span v-if="project.projectNumber" class="mono">#{{ project.projectNumber }}</span>
                  {{ project.name }}
                </button>
              </td>
              <td class="muted-cell">{{ getPartnerById(project.partnerId)?.name }}</td>
              <td><StatusBadge :status="getDashboardProjectStatus(project)" /></td>
              <td>
                <button
                  class="pin-button"
                  :class="{ active: isPinned(`project:${project.id}`) }"
                  @click="emit('togglePin', { key: `project:${project.id}`, type: 'project', id: project.id, title: project.name, subtitle: getPartnerById(project.partnerId)?.name ?? '' })"
                >
                  {{ isPinned(`project:${project.id}`) ? 'Pinned' : 'Pin' }}
                </button>
              </td>
            </tr>
            <tr v-if="!filteredProjects.length">
              <td colspan="4" class="empty-cell">No projects recorded for this selection.</td>
            </tr>
            <tr v-else-if="filteredProjects.length > 8">
              <td colspan="4" class="empty-cell">
                {{ filteredProjects.length - 8 }} more projects available in the Projects view.
              </td>
            </tr>
          </tbody>
        </table>
      </section>     
    </div>
    <div
  v-if="selectedDashboardProject"
  style="position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px"
  @click.self="selectedDashboardProjectId = null"
>
  <div
    role="dialog"
    aria-modal="true"
    aria-label="Project details"
    style="background:#ffffff;color:#1a3a1a;width:100%;max-width:850px;max-height:90vh;overflow-y:auto;border-radius:12px;padding:28px"
  >
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px">
      <div>
        <h2 style="font-size:22px;font-weight:700">
          {{ selectedDashboardProject.name }}
        </h2>
        <p style="color:#5a6b52;margin-top:6px">
          {{ getPartnerById(selectedDashboardProject.partnerId)?.name }}
        </p>
      </div>

      <button
        class="secondary-button"
        @click="selectedDashboardProjectId = null"
      >
        ✕ Close
      </button>
    </div>

    <p style="margin-top:20px">
      {{ selectedDashboardProject.description }}
    </p>

    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:24px">
      <button
        v-for="semesterId in selectedDashboardProject.semesters"
        :key="semesterId"
        class="secondary-button"
        :style="popupSemester === semesterId
          ? { background: '#1a3a1a', color: '#ffffff' }
          : {}"
        @click="popupSemester = semesterId"
      >
        {{ getSemesterLabel(semesterId) }}
      </button>
    </div>

    <div style="margin-top:24px">
      <h3 style="font-weight:700;margin-bottom:12px">
        Semester Status
      </h3>

      <StatusBadge
        :status="getDashboardProjectStatusForSemester(
          selectedDashboardProject,
          popupSemester
        )"
      />
    </div>

    <div style="margin-top:24px">
  <h3 style="font-weight:700;margin-bottom:12px">
    Student Roster · {{ getSemesterLabel(popupSemester) }}
  </h3>

  <div
    v-for="student in (officialProjectRosters[selectedDashboardProject.id] ?? [])"
    :key="`official-${student.name}`"
    style="padding:10px 0;border-bottom:1px solid #e2e8dc"
    >
    <div style="font-weight:600">{{ student.name }}</div>
    <div style="font-size:13px;color:#5a6b52">{{ student.major }}</div>
  </div>


  <div
    v-for="student in popupStudents"
    :key="student.id"
    style="padding:10px 0;border-bottom:1px solid #e2e8dc"
  >
    <div style="font-weight:600">{{ student.name }}</div>
    <div style="font-size:13px;color:#5a6b52">{{ student.major }}</div>
  </div>

  <p
      v-if="
    popupStudents.length === 0 &&
    !(officialProjectRosters[selectedDashboardProject.id]?.length)
    "
    style="color:#5a6b52"
  >
    No student assignments recorded for this semester.
  </p>
</div>

    <div style="margin-top:24px">
      <h3 style="font-weight:700;margin-bottom:8px">
        Status Notes
      </h3>

      <p style="color:#5a6b52">
        {{
          selectedDashboardProject.semesterDetails?.find(
            detail => detail.semesterId === popupSemester
          )?.statusNote || 'No status notes recorded.'
        }}
      </p>
    </div>

    <div style="margin-top:24px">
  <h3 style="font-weight:700;margin-bottom:8px">
    Community Partner Contact
  </h3>

  <div style="font-weight:600">
    {{
      selectedDashboardProject.semesterDetails?.find(
        detail => detail.semesterId === popupSemester
      )?.contactName
      || getPartnerById(selectedDashboardProject.partnerId)?.contact
      || 'Not provided'
    }}
  </div>

  <div style="font-size:13px;color:#5a6b52;margin-top:4px">
    {{
      selectedDashboardProject.semesterDetails?.find(
        detail => detail.semesterId === popupSemester
      )?.contactEmail
      || getPartnerById(selectedDashboardProject.partnerId)?.email
      || ''
    }}
  </div>

  <div style="font-size:13px;color:#5a6b52;margin-top:4px">
    {{
      selectedDashboardProject.semesterDetails?.find(
        detail => detail.semesterId === popupSemester
      )?.contactPhone
      || getPartnerById(selectedDashboardProject.partnerId)?.phone
      || ''
    }}
  </div>

  <p style="font-size:12px;color:#5a6b52;margin-top:6px">
    Contact for {{ getSemesterLabel(popupSemester) }}
  </p>
</div>


    <div style="margin-top:24px">
      <h3 style="font-weight:700;margin-bottom:8px">
        Project Mentor
      </h3>

      <p>
        {{
          selectedDashboardProject.semesterDetails?.find(
            detail => detail.semesterId === popupSemester
          )?.mentorName
          || selectedDashboardProject.mentorName
          || 'Not assigned'
        }}
      </p>
    </div>

    <div style="margin-top:24px">
  <h3 style="font-weight:700;margin-bottom:12px">
    Team Skills
  </h3>

  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <span
      v-for="skill in popupTeamSkills"
      :key="skill"
      style="background:#edf5e8;color:#1a3a1a;padding:6px 12px;border-radius:16px;font-size:13px"
    >
      {{ skill }}
    </span>
  </div>

  <p
    v-if="popupTeamSkills.length === 0"
    style="color:#5a6b52"
  >
    No skills added for this semester.
  </p>
</div>

  </div>
</div>
  </div>
</template>
