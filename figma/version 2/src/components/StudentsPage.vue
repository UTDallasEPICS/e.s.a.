<script setup lang="ts">
  import { ref, computed, watch } from 'vue'
  import {
    students,
    projects,
    semesters,
    getSemesterLabel,
    getClassStanding,
    getStudentCourse,
  } from '../data'
  import type { Student } from '../data'
  import { addStudent, removeStudent, updateStudent } from '../contentStore'

  const semesterMode = ref<'all' | 'single' | 'range'>('all')
  const semester = ref('SP26')
  const semesterRangeStart = ref('FA24')
  const semesterRangeEnd = ref('SP26')
  const major = ref('all')
  const year = ref('all')
  const role = ref('all')
  const assignmentStatus = ref('all')
  const courseFilter = ref('all')
  const search = ref('')
  const expanded = ref<string | null>(null)
  const showAddForm = ref(false)
  const selectedStudents = ref<string[]>([])
  const confirmingRemoval = ref(false)
  const pendingRowRemoval = ref<string | null>(null)
  const studentBulkAction = ref<'Assigned' | 'Unassigned' | 'Exited Program' | 'Remove'>(
    'Unassigned'
  )
  const statusNote = ref('')
  const blankStudent = () => ({
    name: '',
    email: '',
    major: '',
    year: 'Freshman',
    gender: 'F',
    meetingDay: 'Monday',
    courseEnrollment: 'EPCS 2200' as 'EPCS 2200' | 'EPCS 3200',
  })
  const newStudents = ref([blankStudent()])
  const props = defineProps<{ initialStudentId?: string | null }>()
  const emit = defineEmits<{ openProject: [projectId: string] }>()

  watch(
    () => props.initialStudentId,
    (studentId) => {
      if (studentId) expanded.value = studentId
    },
    { immediate: true }
  )

  const majors = Array.from(new Set(students.map((s) => s.major))).sort()
  const years = Array.from(new Set(students.map((s) => s.year))).sort()
  const selectedSemesterIds = computed(() => {
    if (semesterMode.value === 'all') return semesters.map((item) => item.id)
    if (semesterMode.value === 'single') return [semester.value]
    const startIndex = semesters.findIndex((item) => item.id === semesterRangeStart.value)
    const endIndex = semesters.findIndex((item) => item.id === semesterRangeEnd.value)
    const from = Math.max(0, Math.min(startIndex, endIndex))
    const to = Math.max(startIndex, endIndex)
    return semesters.slice(from, to + 1).map((item) => item.id)
  })

  const filtered = computed(() =>
    students.filter((s) => {
      if (
        semesterMode.value !== 'all' &&
        !s.semesters.some((semesterId) => selectedSemesterIds.value.includes(semesterId))
      )
        return false
      if (major.value !== 'all' && s.major !== major.value) return false
      if (year.value !== 'all' && s.year !== year.value) return false
      if (role.value === 'lead' && !s.isMentor) return false
      if (role.value === 'participant' && s.isMentor) return false
      if (
        assignmentStatus.value !== 'all' &&
        (s.participationStatus ?? 'Assigned') !== assignmentStatus.value
      )
        return false
      if (courseFilter.value !== 'all' && getStudentCourse(s) !== courseFilter.value) return false
      if (
        search.value &&
        !s.name.toLowerCase().includes(search.value.toLowerCase()) &&
        !s.email.toLowerCase().includes(search.value.toLowerCase())
      )
        return false
      return true
    })
  )

  function toggleExpand(id: string) {
    expanded.value = expanded.value === id ? null : id
  }

  function getProject(id: string) {
    return projects.find((p) => p.id === id)
  }

  function confirmAddStudent() {
    const standingToYear: Record<string, string> = {
      Freshman: '1st Year',
      Sophomore: '2nd Year',
      Junior: '3rd Year',
      Senior: '4th Year',
    }
    const validStudents = newStudents.value.filter(
      (student) => student.name.trim() && student.email.trim() && student.major.trim()
    )
    if (!validStudents.length) return
    validStudents.forEach((student, index) => {
      const yearValue = standingToYear[student.year] ?? '1st Year'
      addStudent({
        id: `CUSTOM-S-${Date.now()}-${index}`,
        name: student.name.trim(),
        email: student.email.trim(),
        gender: student.gender,
        raceEthnicity: 'Not provided',
        major: student.major.trim(),
        year: yearValue,
        class: yearValue,
        skills: [],
        semesters: [],
        projects: [],
        isMentor: false,
        meetingDay: student.meetingDay,
        participationStatus: 'Unassigned',
        statusNote: 'Added to the program and awaiting a project assignment.',
        courseEnrollment: student.courseEnrollment,
      })
    })
    newStudents.value = [blankStudent()]
    showAddForm.value = false
  }

  function confirmRemoveStudent(studentId: string) {
    removeStudent(studentId)
    pendingRowRemoval.value = null
    selectedStudents.value = selectedStudents.value.filter((id) => id !== studentId)
    if (expanded.value === studentId) expanded.value = null
  }

  const allFilteredSelected = computed(
    () =>
      filtered.value.length > 0 &&
      filtered.value.every((student) => selectedStudents.value.includes(student.id))
  )

  function toggleAllFiltered() {
    if (allFilteredSelected.value) {
      const filteredIds = new Set(filtered.value.map((student) => student.id))
      selectedStudents.value = selectedStudents.value.filter((id) => !filteredIds.has(id))
    } else {
      selectedStudents.value = Array.from(
        new Set([...selectedStudents.value, ...filtered.value.map((student) => student.id)])
      )
    }
    confirmingRemoval.value = false
  }

  function confirmRemoveSelectedStudents() {
    selectedStudents.value.forEach(confirmRemoveStudent)
    selectedStudents.value = []
    confirmingRemoval.value = false
  }

  function confirmSelectedAction() {
    if (studentBulkAction.value === 'Remove') {
      confirmRemoveSelectedStudents()
      return
    }
    selectedStudents.value.forEach((studentId) => {
      updateStudent(studentId, {
        participationStatus: studentBulkAction.value,
        statusNote: statusNote.value.trim() || undefined,
      })
    })
    selectedStudents.value = []
    confirmingRemoval.value = false
    statusNote.value = ''
  }

  function studentStatus(student: Student) {
    return student.participationStatus ?? 'Assigned'
  }

  const course2200Count = computed(
    () => filtered.value.filter((student) => getStudentCourse(student) === 'EPCS 2200').length
  )
  const course3200Count = computed(
    () => filtered.value.filter((student) => getStudentCourse(student) === 'EPCS 3200').length
  )
</script>

<template>
  <div style="padding: 28px 32px">
    <div class="section-title-row">
      <h1 class="font-display" style="font-size: 20px; font-weight: 700; color: #1a3a1a">
        Students
      </h1>
      <button class="primary-button" @click="showAddForm = !showAddForm">
        {{ showAddForm ? 'Cancel' : 'Add Student' }}
      </button>
    </div>

    <form v-if="showAddForm" class="stat-card add-record-form" @submit.prevent="confirmAddStudent">
      <div class="form-heading">
        <div>
          <h2>Add Student</h2>
          <p>Review the information, then use the confirmation button to add the record.</p>
        </div>
      </div>
      <div v-for="(student, index) in newStudents" :key="index" class="bulk-entry-row">
        <div class="bulk-entry-heading">
          <strong>Student {{ index + 1 }}</strong>
          <button
            v-if="newStudents.length > 1"
            class="remove-button"
            type="button"
            @click="newStudents.splice(index, 1)"
          >
            Remove Row
          </button>
        </div>
        <div class="form-grid">
          <label><span>Name</span><input v-model="student.name" type="text" required /></label>
          <label><span>Email</span><input v-model="student.email" type="text" required /></label>
          <label><span>Major</span><input v-model="student.major" type="text" required /></label>
          <label>
            <span>Class Standing</span>
            <select v-model="student.year">
              <option>Freshman</option>
              <option>Sophomore</option>
              <option>Junior</option>
              <option>Senior</option>
            </select>
          </label>
          <label>
            <span>Gender</span>
            <select v-model="student.gender">
              <option>F</option>
              <option>M</option>
              <option>NB</option>
            </select>
          </label>
          <label>
            <span>Meeting Day</span>
            <select v-model="student.meetingDay">
              <option>Monday</option>
              <option>Tuesday</option>
              <option>Wednesday</option>
              <option>Thursday</option>
              <option>Friday</option>
            </select>
          </label>
          <label>
            <span>EPICS Course</span>
            <select v-model="student.courseEnrollment">
              <option value="EPCS 2200">EPCS 2200</option>
              <option value="EPCS 3200">EPCS 3200</option>
            </select>
          </label>
        </div>
      </div>
      <div class="add-row-bar">
        <button class="secondary-button" type="button" @click="newStudents.push(blankStudent())">
          Add Another Student
        </button>
      </div>
      <div class="confirmation-bar">
        <span
          >This action will add {{ newStudents.length }} student record{{
            newStudents.length === 1 ? '' : 's'
          }}.</span
        >
        <button class="confirm-button" type="submit">
          Confirm Add {{ newStudents.length }} Student{{ newStudents.length === 1 ? '' : 's' }}
        </button>
      </div>
    </form>

    <div class="filter-bar" style="margin-bottom: 16px">
      <input
        type="search"
        placeholder="Search name or email…"
        v-model="search"
        style="width: 220px"
      />
      <select v-model="semesterMode" aria-label="Choose semester filter type">
        <option value="all">All Semesters</option>
        <option value="single">Single Semester</option>
        <option value="range">Custom Semester Range</option>
      </select>
      <select v-if="semesterMode === 'single'" v-model="semester" aria-label="Choose semester">
        <option v-for="s in semesters" :key="s.id" :value="s.id">{{ s.label }}</option>
      </select>
      <label v-if="semesterMode === 'range'" class="inline-filter-label">
        <span>From</span>
        <select v-model="semesterRangeStart">
          <option v-for="s in semesters" :key="s.id" :value="s.id">{{ s.label }}</option>
        </select>
      </label>
      <label v-if="semesterMode === 'range'" class="inline-filter-label">
        <span>To</span>
        <select v-model="semesterRangeEnd">
          <option v-for="s in semesters" :key="s.id" :value="s.id">{{ s.label }}</option>
        </select>
      </label>
      <select v-model="major">
        <option value="all">All Majors</option>
        <option v-for="m in majors" :key="m" :value="m">{{ m }}</option>
      </select>
      <select v-model="year">
        <option value="all">All Years</option>
        <option v-for="y in years" :key="y" :value="y">{{ getClassStanding(y) }}</option>
      </select>
      <select v-model="role">
        <option value="all">Student Role: All</option>
        <option value="lead">Peer Leads Only</option>
        <option value="participant">Participants Only</option>
      </select>
      <select v-model="assignmentStatus">
        <option value="all">Assignment Status: All</option>
        <option value="Assigned">Assigned</option>
        <option value="Unassigned">Unassigned</option>
        <option value="Exited Program">Exited Program</option>
      </select>
      <select v-model="courseFilter">
        <option value="all">EPICS Course: All</option>
        <option value="EPCS 2200">EPCS 2200</option>
        <option value="EPCS 3200">EPCS 3200</option>
      </select>
      <span style="color: #5a6b52; font-size: 12px; margin-left: auto"
        >{{ filtered.length }} results</span
      >
    </div>

    <section class="course-summary">
      <div class="course-summary-heading">
        <span class="settings-label">Course Enrollment</span>
        <span>Counts reflect the current student filters</span>
      </div>
      <div class="course-summary-card">
        <strong>{{ course2200Count }}</strong>
        <span>EPCS 2200</span>
        <small>Initial EPICS course</small>
      </div>
      <div class="course-summary-card">
        <strong>{{ course3200Count }}</strong>
        <span>EPCS 3200</span>
        <small>Continuing EPICS course</small>
      </div>
    </section>

    <div class="bulk-toolbar">
      <div class="bulk-selection">
        <button class="secondary-button" @click="toggleAllFiltered">
          {{ allFilteredSelected ? 'Deselect All Results' : 'Select All Results' }}
        </button>
        <span>{{ selectedStudents.length }} selected</span>
      </div>
      <div v-if="selectedStudents.length" class="bulk-actions">
        <template v-if="confirmingRemoval">
          <div class="student-action-confirmation">
            <span>
              Confirm “{{ studentBulkAction }}” for {{ selectedStudents.length }} student{{
                selectedStudents.length === 1 ? '' : 's'
              }}?
            </span>
            <input
              v-if="studentBulkAction !== 'Remove'"
              v-model="statusNote"
              type="text"
              placeholder="Add a note, such as removed from project or awaiting placement"
            />
          </div>
          <button
            :class="studentBulkAction === 'Remove' ? 'danger-button' : 'confirm-button'"
            @click="confirmSelectedAction"
          >
            Confirm {{ studentBulkAction }}
          </button>
          <button class="cancel-button" @click="confirmingRemoval = false">Cancel</button>
        </template>
        <template v-else>
          <select v-model="studentBulkAction" aria-label="Choose action for selected students">
            <option value="Assigned">Mark as Assigned</option>
            <option value="Unassigned">Mark as Unassigned</option>
            <option value="Exited Program">Mark as Exited Program</option>
            <option value="Remove">Remove to Recovery</option>
          </select>
          <button class="cancel-button" @click="selectedStudents = []">Clear Selection</button>
          <button class="secondary-button" @click="confirmingRemoval = true">
            Apply to Selected
          </button>
          <button
            class="remove-button"
            @click="studentBulkAction = 'Remove'; confirmingRemoval = true"
          >
            Remove Selected
          </button>
        </template>
      </div>
    </div>

    <div class="stat-card" style="padding: 0; overflow: hidden">
      <table class="data-table">
        <thead>
          <tr>
            <th class="selection-cell">
              <input
                type="checkbox"
                :checked="allFilteredSelected"
                aria-label="Select all filtered students"
                @change="toggleAllFiltered"
              />
            </th>
            <th>Student</th>
            <th>EPICS Course</th>
            <th>Major</th>
            <th>Class Standing</th>
            <th>Gender</th>
            <th>Meeting Day</th>
            <th>Semesters Enrolled</th>
            <th>Assignment Status</th>
            <th>Role</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="s in filtered" :key="s.id">
            <tr @click="toggleExpand(s.id)" style="cursor: pointer">
              <td class="selection-cell" @click.stop>
                <input
                  v-model="selectedStudents"
                  type="checkbox"
                  :value="s.id"
                  :aria-label="`Select ${s.name}`"
                />
              </td>
              <td>
                <div style="font-weight: 600">{{ s.name }}</div>
                <div style="font-size: 11px; color: #5a6b52">{{ s.email }}</div>
              </td>
              <td>
                <span class="badge course-badge">{{ getStudentCourse(s) }}</span>
              </td>
              <td>{{ s.major }}</td>
              <td>
                <span>{{ getClassStanding(s.year) }}</span>
              </td>
              <td>
                <span class="mono" style="font-size: 11px">{{ s.gender }}</span>
              </td>
              <td style="color: #5a6b52">{{ s.meetingDay }}</td>
              <td>
                <span class="badge" style="background: #d4edda; color: #145214">{{
                  s.semesters.length
                }}</span>
              </td>
              <td>
                <span
                  class="badge"
                  :class="{
                    'badge-assigned': studentStatus(s) === 'Assigned',
                    'badge-unassigned': studentStatus(s) === 'Unassigned',
                    'badge-exited': studentStatus(s) === 'Exited Program',
                  }"
                >
                  {{ studentStatus(s) }}
                </span>
              </td>
              <td>
                <span class="badge" :class="s.isMentor ? 'badge-returning' : 'badge-new'">
                  {{ s.isMentor ? 'Peer Lead' : 'Participant' }}
                </span>
              </td>
              <td @click.stop>
                <div v-if="pendingRowRemoval === s.id" class="row-removal-confirmation">
                  <span>Remove this student?</span>
                  <button class="danger-button" @click="confirmRemoveStudent(s.id)">Confirm</button>
                  <button class="cancel-button" @click="pendingRowRemoval = null">Cancel</button>
                </div>
                <button v-else class="remove-button" @click="pendingRowRemoval = s.id">
                  Remove
                </button>
              </td>
            </tr>
            <tr v-if="expanded === s.id" style="background: #f6f8f3">
              <td colspan="11" style="padding: 12px 18px">
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px">
                  <div>
                    <div
                      style="
                        font-size: 10.5px;
                        font-weight: 700;
                        text-transform: uppercase;
                        letter-spacing: 0.06em;
                        color: #5a6b52;
                        margin-bottom: 6px;
                      "
                    >
                      Semesters Enrolled
                    </div>
                    <div
                      v-for="sem in s.semesters"
                      :key="sem"
                      style="font-size: 12px; color: #1a3a1a; margin-bottom: 3px"
                    >
                      {{ getSemesterLabel(sem) }}
                    </div>
                  </div>
                  <div>
                    <div
                      style="
                        font-size: 10.5px;
                        font-weight: 700;
                        text-transform: uppercase;
                        letter-spacing: 0.06em;
                        color: #5a6b52;
                        margin-bottom: 6px;
                      "
                    >
                      Projects
                    </div>
                    <button
                      v-for="pid in s.projects"
                      :key="pid"
                      class="record-link record-link-block"
                      @click.stop="emit('openProject', pid)"
                    >
                      {{ getProject(pid)?.name }}
                    </button>
                  </div>
                  <div>
                    <div
                      style="
                        font-size: 10.5px;
                        font-weight: 700;
                        text-transform: uppercase;
                        letter-spacing: 0.06em;
                        color: #5a6b52;
                        margin-bottom: 6px;
                      "
                    >
                      Student Profile
                    </div>
                    <div style="font-size: 12px; color: #1a3a1a; margin-bottom: 3px">
                      {{ s.raceEthnicity }}
                    </div>
                    <div style="font-size: 12px; color: #5a6b52">
                      {{ s.projects.length }} project assignments
                    </div>
                    <div v-if="s.statusNote" class="student-status-note">{{ s.statusNote }}</div>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>
