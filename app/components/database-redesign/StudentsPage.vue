<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { students, projects, teams, semesters, getSemesterLabel, getClassStanding, getStudentCourse } from '../data'
import type { Student } from '../data'
import { addStudent, removeStudent, updateStudent } from '../contentStore'

const semesterMode = ref<'all' | 'single' | 'range'>('all')
const semester = ref('SP26')
const semesterRangeStart = ref('FA24')
const semesterRangeEnd = ref('SP26')
const major = ref('all')
const year = ref('all')
const courseFilter = ref('all')
const search = ref('')
const expanded = ref<string | null>(null)
const editingStudentId = ref<string | null>(null)
const editStudentForm = ref({
  name: '',
  email: '',
  major: '',
  year: '',
  gender: '',
  raceEthnicity: '',
  courseEnrollment: 'EPCS 2200' as 'EPCS 2200' | 'EPCS 3200',
})
const currentPage = ref(1)
const studentsPerPage = 10
const showAddForm = ref(false)
const selectedStudents = ref<string[]>([])
const confirmingRemoval = ref(false)
const pendingRowRemoval = ref<string | null>(null)
const studentBulkAction = ref<'Assigned' | 'Unassigned' | 'Exited Program' | 'Remove'>('Unassigned')
const statusNote = ref('')
const blankStudent = () => ({
  name: '',
  email: '',
  major: '',
  year: 'Freshman',
  gender: 'F',
  courseEnrollment: 'EPCS 2200' as 'EPCS 2200' | 'EPCS 3200',
})
const newStudents = ref([blankStudent()])
const props = defineProps<{ initialStudentId?: string | null }>()
const emit = defineEmits<{ openProject: [projectId: string] }>()

watch(
  () => props.initialStudentId,
  studentId => {
    if (studentId) expanded.value = studentId
  },
  { immediate: true }
)

const majors = Array.from(new Set(students.map(s => s.major))).sort()
const years = Array.from(new Set(students.map(s => s.year))).sort()
const selectedSemesterIds = computed(() => {
  if (semesterMode.value === 'all') return semesters.map(item => item.id)
  if (semesterMode.value === 'single') return [semester.value]
  const startIndex = semesters.findIndex(item => item.id === semesterRangeStart.value)
  const endIndex = semesters.findIndex(item => item.id === semesterRangeEnd.value)
  const from = Math.max(0, Math.min(startIndex, endIndex))
  const to = Math.max(startIndex, endIndex)
  return semesters.slice(from, to + 1).map(item => item.id)
})

const filtered = computed(() =>
  students.filter(s => {
    if (
      semesterMode.value !== 'all' &&
      !s.semesters.some(semesterId => selectedSemesterIds.value.includes(semesterId))
    ) return false
    if (major.value !== 'all' && s.major !== major.value) return false
    if (year.value !== 'all' && s.year !== year.value) return false
    if (courseFilter.value !== 'all' && getStudentCourse(s) !== courseFilter.value) return false
    if (search.value && !s.name.toLowerCase().includes(search.value.toLowerCase()) && !s.email.toLowerCase().includes(search.value.toLowerCase())) return false
    return true
  })
)

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filtered.value.length / studentsPerPage))
)

const paginatedStudents = computed(() => {
  const start = (currentPage.value - 1) * studentsPerPage
  return filtered.value.slice(start, start + studentsPerPage)
})

watch(filtered, () => {
  currentPage.value = 1
})

function toggleExpand(id: string) {
  if (expanded.value === id) {
    expanded.value = null

    if (editingStudentId.value === id) {
      cancelStudentEdits()
    }
  } else {
    expanded.value = id

    if (editingStudentId.value !== id) {
      cancelStudentEdits()
    }
  }
}

function startEditingStudent(student: Student) {
  editingStudentId.value = student.id

  editStudentForm.value = {
    name: student.name,
    email: student.email,
    major: student.major,
    year: student.year,
    gender: student.gender,
    raceEthnicity: student.raceEthnicity,
    courseEnrollment: getStudentCourse(student),
  }

  expanded.value = student.id

}

function saveStudentEdits() {
  if (!editingStudentId.value) return

  const form = editStudentForm.value

  if (!form.name.trim() || !form.email.trim() || !form.major.trim()) {
    alert('Please fill in the student name, email, and major.')
    return
  }

  updateStudent(editingStudentId.value, {
    name: form.name.trim(),
    email: form.email.trim(),
    major: form.major.trim(),
    year: form.year,
    class: form.year,
    gender: form.gender,
    raceEthnicity: form.raceEthnicity,
    courseEnrollment: form.courseEnrollment,
  })

  editingStudentId.value = null
}

function cancelStudentEdits() {
  editingStudentId.value = null
}



function getProject(id: string) {
  return projects.find(project => project.id === id)
}

function getStudentProjectsForSemester(studentId: string, semesterId: string) {
  return teams
    .filter(team =>
      team.semesterId === semesterId &&
      team.studentIds.includes(studentId)
    )
    .map(team => getProject(team.projectId))
    .filter((project): project is NonNullable<typeof project> => Boolean(project))
}

function confirmAddStudent() {
  const standingToYear: Record<string, string> = {
    Freshman: '1st Year',
    Sophomore: '2nd Year',
    Junior: '3rd Year',
    Senior: '4th Year',
  }
  const validStudents = newStudents.value.filter(student =>
    student.name.trim() && student.email.trim() && student.major.trim()
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
      meetingDay: '',
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
  selectedStudents.value = selectedStudents.value.filter(id => id !== studentId)
  if (expanded.value === studentId) expanded.value = null
}

const allFilteredSelected = computed(() =>
  filtered.value.length > 0 && filtered.value.every(student => selectedStudents.value.includes(student.id))
)

function toggleAllFiltered() {
  if (allFilteredSelected.value) {
    const filteredIds = new Set(filtered.value.map(student => student.id))
    selectedStudents.value = selectedStudents.value.filter(id => !filteredIds.has(id))
  } else {
    selectedStudents.value = Array.from(
      new Set([...selectedStudents.value, ...filtered.value.map(student => student.id)])
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
  selectedStudents.value.forEach(studentId => {
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

const course2200Count = computed(() =>
  filtered.value.filter(student => getStudentCourse(student) === 'EPCS 2200').length
)
const course3200Count = computed(() =>
  filtered.value.filter(student => getStudentCourse(student) === 'EPCS 3200').length
)

const studentMajorBreakdown = computed(() => {
  const counts: Record<string, number> = {}

  filtered.value.forEach(student => {
    const label = student.major || 'Unknown'
    counts[label] = (counts[label] ?? 0) + 1
  })

  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
})

const studentYearBreakdown = computed(() => {
  const counts: Record<string, number> = {}

  filtered.value.forEach(student => {
    const label = getClassStanding(student.year)
    counts[label] = (counts[label] ?? 0) + 1
  })

  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
})

const studentGenderBreakdown = computed(() => {
  const counts: Record<string, number> = {}

  filtered.value.forEach(student => {
    const label =
      student.gender === 'F' ? 'Female' :
      student.gender === 'M' ? 'Male' :
      student.gender === 'NB' ? 'Nonbinary' :
      'Not specified'

    counts[label] = (counts[label] ?? 0) + 1
  })

  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
})

</script>

<template>
  <div style="padding:28px 32px">
    <div class="section-title-row">
      <h1 class="font-display" style="font-size:20px;font-weight:700;color:#1a3a1a">Students</h1>
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
          <button v-if="newStudents.length > 1" class="remove-button" type="button" @click="newStudents.splice(index, 1)">Remove Row</button>
        </div>
        <div class="form-grid">
          <label><span>Name</span><input v-model="student.name" type="text" required /></label>
          <label><span>Email</span><input v-model="student.email" type="text" required /></label>
          <label><span>Major</span><input v-model="student.major" type="text" required /></label>
          <label>
            <span>Year</span>
            <select v-model="student.year">
              <option>Freshman</option><option>Sophomore</option><option>Junior</option><option>Senior</option>
            </select>
          </label>
          <label>
            <span>Gender</span>
            <select v-model="student.gender"><option>F</option><option>M</option><option>NB</option></select>
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
        <button class="secondary-button" type="button" @click="newStudents.push(blankStudent())">Add Another Student</button>
      </div>
      <div class="confirmation-bar">
        <span>This action will add {{ newStudents.length }} student record{{ newStudents.length === 1 ? '' : 's' }}.</span>
        <button class="confirm-button" type="submit">Confirm Add {{ newStudents.length }} Student{{ newStudents.length === 1 ? '' : 's' }}</button>
      </div>
    </form>

    <div class="filter-bar" style="margin-bottom:16px">
      <input type="search" placeholder="Search name or email…" v-model="search" style="width:220px" />
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
      <select v-model="courseFilter">
        <option value="all">EPICS Course: All</option>
        <option value="EPCS 2200">EPCS 2200</option>
        <option value="EPCS 3200">EPCS 3200</option>
      </select>
      <span style="color:#5a6b52;font-size:12px;margin-left:auto">{{ filtered.length }} results</span>
    </div>

    <section class="course-summary">
      <div class="course-summary-heading">
        <span class="settings-label">Course Enrollment</span>
        <span>Counts reflect the current student filters</span>
      </div>
      <div class="course-summary-card">
  <strong style="min-width:32px;text-align:center">
    {{ course2200Count }}
  </strong>
  <div style="display:flex;flex-direction:column;gap:4px;min-width:0">
    <span style="font-size:16px;font-weight:700;color:#1a3a1a;white-space:nowrap">
      EPCS 2200
    </span>
    <small>Initial EPICS course</small>
  </div>
</div>

<div class="course-summary-card">
  <strong style="min-width:32px;text-align:center">
    {{ course3200Count }}
  </strong>
  <div style="display:flex;flex-direction:column;gap:4px;min-width:0">
    <span style="font-size:16px;font-weight:700;color:#1a3a1a;white-space:nowrap">
      EPCS 3200
    </span>
    <small>Continuing EPICS course</small>
  </div>
</div>
    </section>

    <!-- Student Breakdown Charts -->

    <!-- Student Breakdown Charts -->
<details
  class="stat-card"
  style="margin:16px 0;padding:16px 20px"
>
  <summary
    style="cursor:pointer;font-size:15px;font-weight:700;color:#1a3a1a"
  >
    Student Demographics & Breakdown
    <span style="font-size:12px;font-weight:400;color:#5a6b52;margin-left:8px">
      Click to expand
    </span>
  </summary>

  <p style="font-size:12px;color:#5a6b52;margin:12px 0">
    Counts reflect the current student filters.
  </p>

  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
    <details
      v-for="chart in [
        { title: 'Students by Major', data: studentMajorBreakdown },
        { title: 'Students by Year', data: studentYearBreakdown },
        { title: 'Students by Gender', data: studentGenderBreakdown }
      ]"
      :key="chart.title"
      style="border:1px solid #dce5d7;border-radius:8px;padding:14px;background:#ffffff"
    >
      <summary
        style="cursor:pointer;font-size:14px;font-weight:600;color:#1a3a1a"
      >
        {{ chart.title }}
      </summary>

      <div style="margin-top:16px;max-height:260px;overflow-y:auto">
        <div
          v-for="item in chart.data"
          :key="item.label"
          style="margin-bottom:14px"
        >
          <div
            style="display:flex;justify-content:space-between;gap:8px;font-size:12px;color:#1a3a1a;margin-bottom:6px"
          >
            <span>{{ item.label }}</span>
            <strong>{{ item.count }}</strong>
          </div>

          <div
            style="height:9px;background:#e8eee4;border-radius:6px;overflow:hidden"
          >
            <div
              style="height:100%;background:#347a46;border-radius:6px"
              :style="{
                width: filtered.length
                  ? `${(item.count / filtered.length) * 100}%`
                  : '0%'
              }"
            ></div>
          </div>
        </div>

        <p
          v-if="chart.data.length === 0"
          style="font-size:12px;color:#5a6b52"
        >
          No student data available.
        </p>
      </div>
    </details>
  </div>
</details>

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
              Confirm “{{ studentBulkAction }}” for {{ selectedStudents.length }} student{{ selectedStudents.length === 1 ? '' : 's' }}?
            </span>
            <input
              v-if="studentBulkAction !== 'Remove'"
              v-model="statusNote"
              type="text"
              placeholder="Add a note, such as removed from project or awaiting placement"
            />
          </div>
          <button :class="studentBulkAction === 'Remove' ? 'danger-button' : 'confirm-button'" @click="confirmSelectedAction">
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
          <button class="secondary-button" @click="confirmingRemoval = true">Apply to Selected</button>
          <button
            class="remove-button"
            @click="studentBulkAction = 'Remove'; confirmingRemoval = true"
          >
            Remove Selected
          </button>
        </template>
      </div>
    </div>

    <div class="stat-card" style="padding:0;overflow:hidden">
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
            <th>Email</th>
            <th>EPICS Course</th>
            <th>Major</th>
            <th>Year</th>
            <th>Gender</th>
            <th>Semesters Enrolled</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="s in paginatedStudents" :key="s.id">
            <tr
              @click="toggleExpand(s.id)"
              style="cursor:pointer;color:#1a3a1a;background:#ffffff"
            >
              <td class="selection-cell" @click.stop>
                <input v-model="selectedStudents" type="checkbox" :value="s.id" :aria-label="`Select ${s.name}`" />
              </td>
              <td>
  <div style="font-weight:600">{{ s.name }}</div>
                </td>

                <td style="color:#5a6b52;font-size:12px">
                {{ s.email }}
                </td>

                <td>
                <span class="badge course-badge">
                {{ getStudentCourse(s) }}
                </span>
                </td>

                <td>{{ s.major }}</td>

                <td>{{ getClassStanding(s.year) }}</td>

                <td>
                <span class="mono" style="font-size:11px">
                {{ s.gender }}
                </span>
                </td>

                <td>
                <span
                class="badge"
                style="background:#d4edda;color:#145214"
                >
                {{ s.semesters.length }}
                </span>
                </td>
              <td @click.stop>
                <div v-if="pendingRowRemoval === s.id" class="row-removal-confirmation">
                  <span>Remove this student?</span>
                  <button class="danger-button" @click="confirmRemoveStudent(s.id)">Confirm</button>
                  <button class="cancel-button" @click="pendingRowRemoval = null">Cancel</button>
                </div>
                <template v-else>
                  <div style="display:flex;gap:8px;align-items:center">
                    <button
                      class="secondary-button"
                      @click="startEditingStudent(s)"
                    >
                      Edit
                    </button>

                    <button
                      class="remove-button"
                      @click="pendingRowRemoval = s.id"
                    >
                      Remove
                    </button>
                  </div>
                  </template>
                              </td>
            </tr>
            <tr v-if="expanded === s.id" style="background:#f6f8f3">
              <td colspan="9" style="padding:12px 18px">
                            <div
                v-if="editingStudentId === s.id"
                style="background:#ffffff;padding:20px;border:1px solid #dce5d7;border-radius:8px;margin-bottom:16px"
                >
                <h3 style="font-size:16px;font-weight:700;color:#1a3a1a;margin-bottom:16px">
                  Edit Student
                </h3>

                <div class="form-grid">
                  <label>
                    <span>Name</span>
                    <input v-model="editStudentForm.name" type="text" />
                  </label>

                  <label>
                    <span>Email</span>
                    <input v-model="editStudentForm.email" type="email" />
                  </label>

                  <label>
                    <span>Major</span>
                    <input v-model="editStudentForm.major" type="text" />
                  </label>

                  <label>
                    <span>Year</span>
                    <select v-model="editStudentForm.year">
                      <option value="1st Year">Freshman</option>
                      <option value="2nd Year">Sophomore</option>
                      <option value="3rd Year">Junior</option>
                      <option value="4th Year">Senior</option>
                    </select>
                  </label>

                  <label>
                    <span>Gender</span>
                    <select v-model="editStudentForm.gender">
                      <option value="F">F</option>
                      <option value="M">M</option>
                      <option value="NB">NB</option>
                    </select>
                  </label>

                  <label>
                    <span>Race/Ethnicity</span>
                    <input v-model="editStudentForm.raceEthnicity" type="text" />
                  </label>

                  <label>
                    <span>EPICS Course</span>
                    <select v-model="editStudentForm.courseEnrollment">
                      <option value="EPCS 2200">EPCS 2200</option>
                      <option value="EPCS 3200">EPCS 3200</option>
                    </select>
                  </label>
                </div>

                <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">
                  <button
                    type="button"
                    class="secondary-button"
                    @click.stop="cancelStudentEdits"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    class="primary-button"
                    @click.stop="saveStudentEdits"
                  >
                    Save Changes
                  </button>
                </div>
                </div>
                <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px">
                  <div>
                    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#5a6b52;margin-bottom:10px">
                      Semester and Project History
                    </div>
                    <table class="data-table" style="width:100%;background:#ffffff;color:#1a3a1a">
                      <thead>
                        <tr>
                          <th>Semester</th>
                          <th>Project</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="sem in s.semesters" :key="sem">
                          <td style="color:#1a3a1a;white-space:nowrap">{{ getSemesterLabel(sem) }}</td>
                          <td style="color:#1a3a1a">
                            <template v-if="getStudentProjectsForSemester(s.id, sem).length">
                              <button
                                v-for="project in getStudentProjectsForSemester(s.id, sem)"
                                :key="project.id"
                                class="record-link record-link-block"
                                @click.stop="emit('openProject', project.id)"
                              >
                                {{ project.name }}
                              </button>
                            </template>
                            <span v-else style="color:#5a6b52;font-size:12px">No project recorded</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#5a6b52;margin-bottom:6px">Student Profile</div>
                    <div style="font-size:12px;color:#1a3a1a;margin-bottom:6px">
                      <strong>Race/Ethnicity:</strong> {{ s.raceEthnicity || 'Not provided' }}
                      </div>
                      <div style="font-size:12px;color:#1a3a1a;margin-bottom:6px">
                      <strong>Major:</strong> {{ s.major }}
                      </div>
                      <div style="font-size:12px;color:#1a3a1a;margin-bottom:6px">
                      <strong>Year:</strong> {{ getClassStanding(s.year) }}
                      </div>
                      <div style="font-size:12px;color:#1a3a1a;margin-bottom:6px">
                      <strong>Gender:</strong> {{ s.gender }}
                      </div>
                    <div style="font-size:12px;color:#5a6b52">
                      <strong>Project Assignments:</strong>
                      {{ teams.filter(team => team.studentIds.includes(s.id)).length }}
                      semester-specific assignments
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
    <div
      style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding:12px 4px"
    >
      <span style="font-size:13px;color:#5a6b52">
        <template v-if="filtered.length === 0">
          No students found
        </template>
        <template v-else>
          Showing
          {{ (currentPage - 1) * studentsPerPage + 1 }}–{{ Math.min(currentPage * studentsPerPage, filtered.length) }}
          of {{ filtered.length }} students
          (Page {{ currentPage }} of {{ totalPages }})
        </template>
        </span>

      <div style="display:flex;gap:8px">
        <button
          class="secondary-button"
          :disabled="currentPage === 1"
          @click="currentPage--"
        >
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
