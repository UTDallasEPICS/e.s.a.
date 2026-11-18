<script setup lang="ts">
  import { computed, ref } from 'vue'
  import {
    students,
    projects,
    semesters,
    officialProjectRosters,
    getPartnerById,
    getSemesterLabel,
    getClassStanding,
  } from '../data'
  import StatusBadge from './StatusBadge.vue'
  import type { PinnedItem } from '../types'

  const props = defineProps<{ pinnedItems: PinnedItem[] }>()
  const emit = defineEmits<{
    navigate: [page: string]
    openProject: [projectId: string, semesterId: string]
    openStudent: [studentId: string]
    openInsight: [insightId: string]
    togglePin: [item: PinnedItem]
  }>()
  const selectedSemester = ref('SP26')

  const semesterStudents = computed(() =>
    selectedSemester.value === 'all'
      ? students.filter((student) => student.participationStatus !== 'Exited Program')
      : students.filter(
          (student) =>
            student.participationStatus !== 'Exited Program' &&
            student.semesters.includes(selectedSemester.value)
        )
  )
  const semesterProjects = computed(() =>
    projects.filter(
      (project) =>
        ['Active', 'In Progress', 'New'].includes(project.status) &&
        (selectedSemester.value === 'all' || project.semesters.includes(selectedSemester.value))
    )
  )
  const returningStudents = computed(() =>
    semesterStudents.value.filter((student) =>
      selectedSemester.value === 'all'
        ? student.semesters.length > 1
        : student.semesters.indexOf(selectedSemester.value) > 0
    )
  )
  const firstTimeStudents = computed(() =>
    selectedSemester.value === 'all'
      ? semesterStudents.value.filter((student) => student.semesters.length === 1).length
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
  const officialSpringRoster = computed(() =>
    Array.from(
      new Map(
        Object.values(officialProjectRosters)
          .flat()
          .map((student) => [student.name, student])
      ).values()
    )
  )
  const displayedStudents = computed(() =>
    selectedSemester.value === 'SP26'
      ? officialSpringRoster.value.map((student) => ({
          ...student,
          id: student.name,
          recordId: null as string | null,
        }))
      : semesterStudents.value.map((student) => ({ ...student, recordId: student.id }))
  )
  const enrollmentCount = computed(() =>
    selectedSemester.value === 'SP26'
      ? officialSpringRoster.value.length
      : semesterStudents.value.length
  )
  const stats = computed(() => [
    {
      label: 'Enrolled Students',
      value: enrollmentCount.value,
      sub:
        selectedSemester.value === 'SP26'
          ? '5 course values not listed'
          : selectedSemesterLabel.value,
      tone: 'accent',
    },
    {
      label: 'Active Projects',
      value: semesterProjects.value.length,
      sub: selectedSemester.value === 'all' ? 'across the program' : 'running this semester',
      tone: 'green',
    },
    {
      label: selectedSemester.value === 'SP26' ? 'EPCS 2200 Students' : 'First-Time Students',
      value: selectedSemester.value === 'SP26' ? 108 : firstTimeStudents.value,
      sub:
        selectedSemester.value === 'SP26'
          ? 'first EPICS course'
          : selectedSemester.value === 'all'
            ? 'one semester enrolled'
            : 'new to EPICS',
      tone: 'gold',
    },
    {
      label: selectedSemester.value === 'SP26' ? 'EPCS 3200 Students' : 'Returning Students',
      value: selectedSemester.value === 'SP26' ? 38 : returningStudents.value.length,
      sub: `${returningPct.value}% of enrollment`,
      tone: 'teal',
    },
  ])

  function isPinned(key: string) {
    return props.pinnedItems.some((item) => item.key === key)
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

    <div class="dashboard-stats">
      <div v-for="stat in stats" :key="stat.label" class="stat-card metric-card">
        <div class="metric-value" :class="`metric-${stat.tone}`">{{ stat.value }}</div>
        <div class="metric-label">{{ stat.label }}</div>
        <div class="metric-sub">{{ stat.sub }}</div>
      </div>
    </div>

    <section class="assistant-strip dashboard-assistant">
      <div>
        <div class="assistant-eyebrow">EPICS data assistant</div>
        <h2>Have a question about the program?</h2>
        <p>Ask about enrollment, demographics, projects, and historical trends.</p>
      </div>
      <button class="primary-button" @click="emit('navigate', 'chat')">Open AI Assistant</button>
    </section>

    <section class="stat-card pinned-section">
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
          <button
            class="unpin-button"
            :aria-label="`Unpin ${item.title}`"
            @click="emit('togglePin', item)"
          >
            Unpin
          </button>
        </div>
      </div>
      <div v-else class="pinned-empty">
        Use the Pin actions on projects and insight charts to add shortcuts here.
      </div>
    </section>

    <div class="dashboard-grid">
      <section class="stat-card dashboard-panel">
        <div class="panel-heading">
          <div>
            <h2>Active Projects</h2>
            <p>{{ selectedSemesterLabel }} project roster</p>
          </div>
          <button class="text-button" @click="emit('navigate', 'projects')">View projects</button>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Community Partner</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="project in semesterProjects.slice(0, 8)" :key="project.id">
              <td>
                <button
                  class="record-link"
                  @click="
                    emit(
                      'openProject',
                      project.id,
                      selectedSemester === 'all'
                        ? project.semesters[project.semesters.length - 1]
                        : selectedSemester
                    )
                  "
                >
                  <span v-if="project.projectNumber" class="mono"
                    >#{{ project.projectNumber }}</span
                  >
                  {{ project.name }}
                </button>
              </td>
              <td class="muted-cell">{{ getPartnerById(project.partnerId)?.name }}</td>
              <td><StatusBadge :status="project.status" /></td>
              <td>
                <button
                  class="pin-button"
                  :class="{ active: isPinned(`project:${project.id}`) }"
                  @click="
                    emit('togglePin', {
                      key: `project:${project.id}`,
                      type: 'project',
                      id: project.id,
                      title: project.name,
                      subtitle: getPartnerById(project.partnerId)?.name ?? '',
                    })
                  "
                >
                  {{ isPinned(`project:${project.id}`) ? 'Pinned' : 'Pin' }}
                </button>
              </td>
            </tr>
            <tr v-if="!semesterProjects.length">
              <td colspan="4" class="empty-cell">
                No active projects recorded for this selection.
              </td>
            </tr>
            <tr v-else-if="semesterProjects.length > 8">
              <td colspan="4" class="empty-cell">
                {{ semesterProjects.length - 8 }} more projects available in the Projects view.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="stat-card dashboard-panel">
        <div class="panel-heading">
          <div>
            <h2>{{ selectedSemester === 'all' ? 'All Students' : 'Current Students' }}</h2>
            <p>{{ enrollmentCount }} enrolled</p>
          </div>
          <button class="text-button" @click="emit('navigate', 'students')">View students</button>
        </div>
        <div class="student-list">
          <div
            v-for="student in displayedStudents.slice(0, 8)"
            :key="student.id"
            class="student-list-row"
          >
            <div>
              <button
                v-if="student.recordId"
                class="record-link"
                @click="emit('openStudent', student.recordId)"
              >
                {{ student.name }}
              </button>
              <div v-else class="strong-cell">{{ student.name }}</div>
              <div class="muted-cell">
                {{ student.major
                }}<template v-if="'year' in student">
                  · {{ getClassStanding(student.year) }}</template
                >
              </div>
            </div>
            <span
              v-if="'semesters' in student"
              class="badge"
              :class="
                (
                  selectedSemester === 'all'
                    ? student.semesters.length > 1
                    : student.semesters.indexOf(selectedSemester) > 0
                )
                  ? 'badge-returning'
                  : 'badge-new'
              "
            >
              {{
                (
                  selectedSemester === 'all'
                    ? student.semesters.length > 1
                    : student.semesters.indexOf(selectedSemester) > 0
                )
                  ? 'Returning'
                  : 'First time'
              }}
            </span>
            <span v-else class="badge badge-new">Team roster</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
