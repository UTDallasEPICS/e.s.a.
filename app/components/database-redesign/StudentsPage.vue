<script setup lang="ts">
  /**
   * Purpose
   * Let staff find students and edit their semester information.
   *
   * Inputs
   * - Student records, search and filter choices, and any linked student ID.
   *
   * Outputs
   * - A filtered, paginated roster and saved student edits.
   *
   * Pseudocode
   * Find matching semester records → narrow and sort the roster → show one page → save changes without resetting the page.
   */
  import { ref, computed, nextTick, watch } from 'vue'
  import {
    students,
    projects,
    teams,
    semesters,
    getSemesterLabel,
    getClassStanding,
    getStudentCourse,
    getStudentForSemester,
  } from '../data'
  import type { Student } from '../data'
  import { addStudent, removeStudent, updateStudent } from '../contentStore'

  // Store semesterMode as state so Vue reacts when it changes.
  const semesterMode = ref<'all' | 'single' | 'range'>('single')
  // Use useState to initialize semester.
  const semester = useState<string>('epics-selected-semester', () => 'FA26')
  // Store semesterRangeStart as state so Vue reacts when it changes.
  const semesterRangeStart = ref('SP26')
  // Store semesterRangeEnd as state so Vue reacts when it changes.
  const semesterRangeEnd = ref('FA26')
  // Store major as state so Vue reacts when it changes.
  const major = ref('all')
  // Store year as state so Vue reacts when it changes.
  const year = ref('all')
  // Store projectFilter as state so Vue reacts when it changes.
  const projectFilter = ref('all')
  // Store studentSort as state so Vue reacts when it changes.
  const studentSort = ref('name')
  // Store search as state so Vue reacts when it changes.
  const search = ref('')
  // Store expanded as state so Vue reacts when it changes.
  const expanded = ref<string | null>(null)
  // Store editingStudentId as state so Vue reacts when it changes.
  const editingStudentId = ref<string | null>(null)
  // Store editStudentForm as state so Vue reacts when it changes.
  const editStudentForm = ref({
    name: '',
    email: '',
    major: '',
    year: '',
    gender: '',
    raceEthnicity: '',
    courseEnrollment: 'EPCS 2200' as 'EPCS 2200' | 'EPCS 3200' | null,
  })
  // Store currentPage as state so Vue reacts when it changes.
  const currentPage = ref(1)
  // Define studentsPerPage for the steps below.
  const studentsPerPage = 25
  // Store showAddForm as state so Vue reacts when it changes.
  const showAddForm = ref(false)
  // Store selectedStudents as state so Vue reacts when it changes.
  const selectedStudents = ref<string[]>([])
  // Store confirmingRemoval as state so Vue reacts when it changes.
  const confirmingRemoval = ref(false)
  // Store pendingRowRemoval as state so Vue reacts when it changes.
  const pendingRowRemoval = ref<string | null>(null)
  // Store studentBulkAction as state so Vue reacts when it changes.
  const studentBulkAction = ref<'Assigned' | 'Unassigned' | 'Exited Program' | 'Remove'>('Unassigned')
  // Store statusNote as state so Vue reacts when it changes.
  const statusNote = ref('')
  // Define blankStudent for the steps below.
  const blankStudent = () => ({
    name: '',
    email: '',
    major: '',
    year: 'Freshman',
    gender: 'F',
    courseEnrollment: 'EPCS 2200' as 'EPCS 2200' | 'EPCS 3200',
  })
  // Store newStudents as state so Vue reacts when it changes.
  const newStudents = ref([blankStudent()])
  // Use defineProps to initialize props.
  const props = defineProps<{ initialStudentId?: string | null }>()
  // Use defineEmits to initialize emit.
  const emit = defineEmits<{ openProject: [projectId: string, semesterId?: string] }>()

  // Run the callback when the watched values change.
  watch(
    () => props.initialStudentId,
    (studentId) => {
      // Check whether studentId before running this branch.
      if (studentId) expanded.value = studentId
    },
    { immediate: true }
  )

  // Recalculate majors when the values it reads change.
  const majors = computed(() =>
    [
      ...new Set(
        students.flatMap((student) =>
          student.semesters.map((id) => getStudentForSemester(student, id).major)
        )
      ),
    ].sort()
  )
  // Recalculate years when the values it reads change.
  const years = computed(() =>
    [
      ...new Set(
        students.flatMap((student) =>
          student.semesters.map((id) => getStudentForSemester(student, id).year)
        )
      ),
    ].sort()
  )
  // Check whether semester.value === 'all' before running this branch.
  if (semester.value === 'all') semesterMode.value = 'all'
  // Define the helper that will sync semester mode.
  function syncSemesterMode() {
    // Check whether semesterMode.value === 'all' before running this branch.
    if (semesterMode.value === 'all') semester.value = 'all'
    else if (semester.value === 'all') semester.value = semesters.at(-1)?.id ?? 'all'
  }
  // Recalculate selectedSemesterIds when the values it reads change.
  const selectedSemesterIds = computed(() => {
    // Check whether semesterMode.value === 'all' before running this branch.
    if (semesterMode.value === 'all') return semesters.map((item) => item.id)
    // Check whether semesterMode.value === 'single' before running this branch.
    if (semesterMode.value === 'single') return [semester.value]
    // Use semesters.findIndex to initialize startIndex.
    const startIndex = semesters.findIndex((item) => item.id === semesterRangeStart.value)
    // Use semesters.findIndex to initialize endIndex.
    const endIndex = semesters.findIndex((item) => item.id === semesterRangeEnd.value)
    // Use Math.max to initialize from.
    const from = Math.max(0, Math.min(startIndex, endIndex))
    // Use Math.max to initialize to.
    const to = Math.max(startIndex, endIndex)
    // Pass semesters.slice(from, to + 1).map((item) => item.id) back to the caller.
    return semesters.slice(from, to + 1).map((item) => item.id)
  })

  // Define the helper that will matching semesters.
  function matchingSemesters(student: Student) {
    // Pass selectedSemesterIds.value.filter((id) => { if (!student.semesters.includes(id)) return false if ( pr back to the caller.
    return selectedSemesterIds.value.filter((id) => {
      // Check whether !student.semesters.includes(id) before running this branch.
      if (!student.semesters.includes(id)) return false
      // Check whether projectFilter.value !== 'all' && !teams.some( (team) => team.projectId === projectFilter.value && te before running this branch.
      if (
        projectFilter.value !== 'all' &&
        !teams.some(
          (team) =>
            team.projectId === projectFilter.value &&
            team.semesterId === id &&
            team.studentIds.includes(student.id)
        )
      )
        // Pass false back to the caller.
        return false
      // Use getStudentForSemester to initialize profile.
      const profile = getStudentForSemester(student, id)
      // Pass ( (major.value === 'all' || profile.major === major.value) && (year.value === 'all' || profile.year  back to the caller.
      return (
        (major.value === 'all' || profile.major === major.value) &&
        (year.value === 'all' || profile.year === year.value)
      )
    })
  }
  // Recalculate filtered when the values it reads change.
  const filtered = computed(() =>
    students.flatMap((student) => {
      // Use matchingSemesters to initialize ids.
      const ids = matchingSemesters(student)
      // Pass ids.length ? [getStudentForSemester(student, ids)] : [] back to the caller.
      return ids.length ? [getStudentForSemester(student, ids)] : []
    })
  )

  // Recalculate tableStudents when the values it reads change.
  const tableStudents = computed(() =>
    filtered.value
      .filter((s) => {
        // Check whether search.value && !s.name.toLowerCase().includes(search.value.toLowerCase()) && !s.email.toLowerCase() before running this branch.
        if (
          search.value &&
          !s.name.toLowerCase().includes(search.value.toLowerCase()) &&
          !s.email.toLowerCase().includes(search.value.toLowerCase())
        )
          // Pass false back to the caller.
          return false

        // Pass true back to the caller.
        return true
      })
      .sort((a, b) => {
        // Define byName for the steps below.
        const byName =
          a.name.localeCompare(b.name, 'en', { sensitivity: 'base', numeric: true }) ||
          a.id.localeCompare(b.id)
        // Check whether studentSort.value === 'year' before running this branch.
        if (studentSort.value === 'year') {
          // Define rank for the steps below.
          const rank: Record<string, number> = { Freshman: 1, Sophomore: 2, Junior: 3, Senior: 4 }
          // Pass ( (rank[getClassStanding(a.year)] ?? 99) - (rank[getClassStanding(b.year)] ?? 99) || byName ) back to the caller.
          return (
            (rank[getClassStanding(a.year)] ?? 99) - (rank[getClassStanding(b.year)] ?? 99) || byName
          )
        }
        // Check whether studentSort.value === 'course' before running this branch.
        if (studentSort.value === 'course')
          // Pass ( getStudentCourse(a).localeCompare(getStudentCourse(b), 'en', { numeric: true }) || byName ) back to the caller.
          return (
            getStudentCourse(a).localeCompare(getStudentCourse(b), 'en', { numeric: true }) || byName
          )
        // Pass byName back to the caller.
        return byName
      })
  )

  // Recalculate filterProjects when the values it reads change.
  const filterProjects = computed(() =>
    projects
      .filter((project) => project.semesters.some((id) => selectedSemesterIds.value.includes(id)))
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base', numeric: true }))
  )
  // Recalculate enrollmentHeading when the values it reads change.
  const enrollmentHeading = computed(() =>
    semester.value === 'all' || semesterMode.value === 'all'
      ? 'Enrollment — All Semesters'
      : semesterMode.value === 'range'
        ? `Enrollment — ${getSemesterLabel(semesterRangeStart.value)} to ${getSemesterLabel(semesterRangeEnd.value)}`
        : `Current semester enrollment — ${getSemesterLabel(semester.value)}`
  )
  // Define the helper that will reset student filters.
  function resetStudentFilters() {
    // Update search.value with the value on the right.
    search.value = ''
    // Update projectFilter.value with the value on the right.
    projectFilter.value = 'all'
    // Update major.value with the value on the right.
    major.value = 'all'
    // Update year.value with the value on the right.
    year.value = 'all'
    // Update studentSort.value with the value on the right.
    studentSort.value = 'name'
    // Update semesterMode.value with the value on the right.
    semesterMode.value = 'single'
    // Update semester.value with the value on the right.
    semester.value = semesters.at(-1)?.id ?? 'all'
  }
  // Run the callback when the watched values change.
  watch(selectedSemesterIds, () => {
    // Check whether projectFilter.value !== 'all' && !filterProjects.value.some((project) => project.id === projectFilte before running this branch.
    if (
      projectFilter.value !== 'all' &&
      !filterProjects.value.some((project) => project.id === projectFilter.value)
    )
      // Update projectFilter.value with the value on the right.
      projectFilter.value = 'all'
  })

  // Recalculate totalPages when the values it reads change.
  const totalPages = computed(() =>
    Math.max(1, Math.ceil(tableStudents.value.length / studentsPerPage))
  )

  // Recalculate paginatedStudents when the values it reads change.
  const paginatedStudents = computed(() => {
    // Define start for the steps below.
    const start = (currentPage.value - 1) * studentsPerPage
    // Pass tableStudents.value.slice(start, start + studentsPerPage) back to the caller.
    return tableStudents.value.slice(start, start + studentsPerPage)
  })

  // Run the callback when the watched values change.
  watch(
    [
      search,
      projectFilter,
      major,
      year,
      studentSort,
      semesterMode,
      semester,
      semesterRangeStart,
      semesterRangeEnd,
    ],
    () => {
      // Update currentPage.value with the value on the right.
      currentPage.value = 1
    }
  )

  // Run the callback when the watched values change.
  watch(totalPages, (lastPage) => {
    // Update currentPage.value with the value on the right.
    currentPage.value = Math.min(currentPage.value, lastPage)
  })

  // Run the callback when the watched values change.
  watch(
    () => props.initialStudentId,
    async (studentId) => {
      // Check whether !studentId before running this branch.
      if (!studentId) return
      // Use tableStudents.value.findIndex to initialize index.
      const index = tableStudents.value.findIndex((student) => student.id === studentId)
      // Check whether index < 0 before running this branch.
      if (index < 0) return
      // Update currentPage.value with the value on the right.
      currentPage.value = Math.floor(index / studentsPerPage) + 1
      // Update expanded.value with the value on the right.
      expanded.value = studentId
      await nextTick()
      // Check whether import.meta.client before running this branch.
      if (import.meta.client)
        // Call document.getElementById(`student-row-${studentId}`)?.scrollIntoView to run this step.
        document.getElementById(`student-row-${studentId}`)?.scrollIntoView({ block: 'center' })
    },
    { immediate: true, flush: 'post' }
  )

  // Define the helper that will toggle expand.
  function toggleExpand(id: string) {
    // Check whether expanded.value === id before running this branch.
    if (expanded.value === id) {
      // Update expanded.value with the value on the right.
      expanded.value = null

      // Check whether editingStudentId.value === id before running this branch.
      if (editingStudentId.value === id) {
        // Call cancelStudentEdits to run this step.
        cancelStudentEdits()
      }
    } else {
      // Update expanded.value with the value on the right.
      expanded.value = id

      // Check whether editingStudentId.value !== id before running this branch.
      if (editingStudentId.value !== id) {
        // Call cancelStudentEdits to run this step.
        cancelStudentEdits()
      }
    }
  }

  // Define the helper that will start editing student.
  function startEditingStudent(student: Student) {
    // Update editingStudentId.value with the value on the right.
    editingStudentId.value = student.id

    // Update editStudentForm.value with the value on the right.
    editStudentForm.value = {
      name: student.name,
      email: student.email,
      major: student.major,
      year: student.year,
      gender: student.gender,
      raceEthnicity: student.raceEthnicity,
      courseEnrollment:
        getStudentCourse(student) === 'Unknown'
          ? null
          : (getStudentCourse(student) as 'EPCS 2200' | 'EPCS 3200'),
    }

    // Update expanded.value with the value on the right.
    expanded.value = student.id
  }

  // Define the helper that will save student edits.
  function saveStudentEdits() {
    // Check whether !editingStudentId.value before running this branch.
    if (!editingStudentId.value) return

    // Define form for the steps below.
    const form = editStudentForm.value

    // Check whether !form.name.trim() || !form.major.trim() before running this branch.
    if (!form.name.trim() || !form.major.trim()) {
      // Call alert to run this step.
      alert('Please fill in the student name and major.')
      return
    }

    // Call updateStudent to run this step.
    updateStudent(
      editingStudentId.value,
      {
        name: form.name.trim(),
        email: form.email.trim(),
        major: form.major.trim(),
        year: form.year,
        class: form.year,
        gender: form.gender,
        raceEthnicity: form.raceEthnicity,
        courseEnrollment: form.courseEnrollment,
      },
      semesterMode.value === 'single' && semester.value !== 'all' ? semester.value : undefined
    )

    // Update editingStudentId.value with the value on the right.
    editingStudentId.value = null
  }

  // Define the helper that will cancel student edits.
  function cancelStudentEdits() {
    // Update editingStudentId.value with the value on the right.
    editingStudentId.value = null
  }

  // Define the helper that will get project.
  function getProject(id: string) {
    // Pass projects.find((project) => project.id === id) back to the caller.
    return projects.find((project) => project.id === id)
  }

  // Define the helper that will get student projects for semester.
  function getStudentProjectsForSemester(studentId: string, semesterId: string) {
    // Pass teams .filter((team) => team.semesterId === semesterId && team.studentIds.includes(studentId)) .map( back to the caller.
    return teams
      .filter((team) => team.semesterId === semesterId && team.studentIds.includes(studentId))
      .map((team) => getProject(team.projectId))
      .filter((project): project is NonNullable<typeof project> => Boolean(project))
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base', numeric: true }))
  }

  // Define the helper that will confirm add student.
  function confirmAddStudent() {
    // Define standingToYear for the steps below.
    const standingToYear: Record<string, string> = {
      Freshman: '1st Year',
      Sophomore: '2nd Year',
      Junior: '3rd Year',
      Senior: '4th Year',
    }
    // Use newStudents.value.filter to initialize validStudents.
    const validStudents = newStudents.value.filter(
      (student) => student.name.trim() && student.email.trim() && student.major.trim()
    )
    // Check whether !validStudents.length before running this branch.
    if (!validStudents.length) return
    // Call validStudents.forEach to run this step.
    validStudents.forEach((student, index) => {
      // Define yearValue for the steps below.
      const yearValue = standingToYear[student.year] ?? '1st Year'
      // Call addStudent to run this step.
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
    // Update newStudents.value with the value on the right.
    newStudents.value = [blankStudent()]
    // Update showAddForm.value with the value on the right.
    showAddForm.value = false
  }

  // Define the helper that will confirm remove student.
  function confirmRemoveStudent(studentId: string) {
    // Call removeStudent to run this step.
    removeStudent(studentId)
    // Update pendingRowRemoval.value with the value on the right.
    pendingRowRemoval.value = null
    // Update selectedStudents.value with the value on the right.
    selectedStudents.value = selectedStudents.value.filter((id) => id !== studentId)
    // Check whether expanded.value === studentId before running this branch.
    if (expanded.value === studentId) expanded.value = null
  }

  // Recalculate allFilteredSelected when the values it reads change.
  const allFilteredSelected = computed(
    () =>
      tableStudents.value.length > 0 &&
      tableStudents.value.every((student) => selectedStudents.value.includes(student.id))
  )

  // Define the helper that will toggle all filtered.
  function toggleAllFiltered() {
    // Check whether allFilteredSelected.value before running this branch.
    if (allFilteredSelected.value) {
      // Define filteredIds for the steps below.
      const filteredIds = new Set(tableStudents.value.map((student) => student.id))
      // Update selectedStudents.value with the value on the right.
      selectedStudents.value = selectedStudents.value.filter((id) => !filteredIds.has(id))
    } else {
      // Update selectedStudents.value with the value on the right.
      selectedStudents.value = Array.from(
        new Set([...selectedStudents.value, ...tableStudents.value.map((student) => student.id)])
      )
    }
    // Update confirmingRemoval.value with the value on the right.
    confirmingRemoval.value = false
  }

  // Define the helper that will confirm remove selected students.
  function confirmRemoveSelectedStudents() {
    // Call selectedStudents.value.forEach to run this step.
    selectedStudents.value.forEach(confirmRemoveStudent)
    // Update selectedStudents.value with the value on the right.
    selectedStudents.value = []
    // Update confirmingRemoval.value with the value on the right.
    confirmingRemoval.value = false
  }

  // Define the helper that will confirm selected action.
  function confirmSelectedAction() {
    // Check whether studentBulkAction.value === 'Remove' before running this branch.
    if (studentBulkAction.value === 'Remove') {
      // Call confirmRemoveSelectedStudents to run this step.
      confirmRemoveSelectedStudents()
      return
    }
    // Call selectedStudents.value.forEach to run this step.
    selectedStudents.value.forEach((studentId) => {
      // Call updateStudent to run this step.
      updateStudent(studentId, {
        participationStatus: studentBulkAction.value,
        statusNote: statusNote.value.trim() || undefined,
      })
    })
    // Update selectedStudents.value with the value on the right.
    selectedStudents.value = []
    // Update confirmingRemoval.value with the value on the right.
    confirmingRemoval.value = false
    // Update statusNote.value with the value on the right.
    statusNote.value = ''
  }

  // Define the helper that will student status.
  function studentStatus(student: Student) {
    // Pass student.participationStatus ?? 'Assigned' back to the caller.
    return student.participationStatus ?? 'Assigned'
  }

  // Define the helper that will students in course.
  function studentsInCourse(course: string) {
    // Define visibleIds for the steps below.
    const visibleIds = new Set(tableStudents.value.map((student) => student.id))
    // Pass students.filter( (student) => visibleIds.has(student.id) && matchingSemesters(student).some( (id) => back to the caller.
    return students.filter(
      (student) =>
        visibleIds.has(student.id) &&
        matchingSemesters(student).some(
          (id) => getStudentCourse(getStudentForSemester(student, id)) === course
        )
    ).length
  }
  // Recalculate course2200Count when the values it reads change.
  const course2200Count = computed(() => studentsInCourse('EPCS 2200'))
  // Recalculate course3200Count when the values it reads change.
  const course3200Count = computed(() => studentsInCourse('EPCS 3200'))
  // Recalculate unknownCourseCount when the values it reads change.
  const unknownCourseCount = computed(() => studentsInCourse('Unknown'))

  // Recalculate studentMajorBreakdown when the values it reads change.
  const studentMajorBreakdown = computed(() => {
    // Define counts for the steps below.
    const counts: Record<string, number> = {}

    // Call tableStudents.value.forEach to run this step.
    tableStudents.value.forEach((student) => {
      // Define label for the steps below.
      const label = student.major || 'Unknown'
      // Update counts[label] with the value on the right.
      counts[label] = (counts[label] ?? 0) + 1
    })

    // Pass Object.entries(counts) .map(([label, count]) => ({ label, count })) .sort((a, b) => b.count - a.coun back to the caller.
    return Object.entries(counts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
  })

  // Recalculate studentYearBreakdown when the values it reads change.
  const studentYearBreakdown = computed(() => {
    // Define counts for the steps below.
    const counts: Record<string, number> = {}

    // Call tableStudents.value.forEach to run this step.
    tableStudents.value.forEach((student) => {
      // Use getClassStanding to initialize label.
      const label = getClassStanding(student.year)
      // Update counts[label] with the value on the right.
      counts[label] = (counts[label] ?? 0) + 1
    })

    // Pass Object.entries(counts) .map(([label, count]) => ({ label, count })) .sort((a, b) => b.count - a.coun back to the caller.
    return Object.entries(counts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
  })

  // Recalculate studentGenderBreakdown when the values it reads change.
  const studentGenderBreakdown = computed(() => {
    // Define counts for the steps below.
    const counts: Record<string, number> = {}

    // Call tableStudents.value.forEach to run this step.
    tableStudents.value.forEach((student) => {
      // Define label for the steps below.
      const label =
        student.gender === 'F'
          ? 'Female'
          : student.gender === 'M'
            ? 'Male'
            : student.gender === 'NB'
              ? 'Nonbinary'
              : student.gender === 'Other'
                ? 'Other'
                : 'Unknown'

      // Update counts[label] with the value on the right.
      counts[label] = (counts[label] ?? 0) + 1
    })

    // Pass Object.entries(counts) .map(([label, count]) => ({ label, count })) .sort((a, b) => b.count - a.coun back to the caller.
    return Object.entries(counts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
  })
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
            <span>Year</span>
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

    <div class="filter-bar" style="margin-bottom:16px;display:flex;flex-wrap:wrap;gap:12px;align-items:end">
      <input
        type="search"
        placeholder="Search Name or Email…"
        v-model="search"
        style="width: 220px"
      />

      <button type="button" class="secondary-button" aria-label="Clear Student Search" :disabled="!search" @click="search = ''">Clear Search</button>
      <label>Semester
        <select v-model="semester" aria-label="Filter students by semester" @change="semesterMode = semester === 'all' ? 'all' : 'single'">
          <option value="all">All Semesters</option>
          <option v-for="item in semesters" :key="item.id" :value="item.id">{{ item.label }}</option>
        </select>
      </label>
      <label>Project
        <select v-model="projectFilter" aria-label="Filter students by project" style="max-width:260px">
          <option value="all">All Projects</option>
          <option v-for="project in filterProjects" :key="project.id" :value="project.id">{{ project.projectNumber ? '#' + project.projectNumber + ' ' : '' }}{{ project.name }}</option>
        </select>
      </label>
      <label>Sort Students
        <select v-model="studentSort" aria-label="Sort Students"><option value="name">Alphabetical (A–Z)</option><option value="year">Class Standing, Then Alphabetical</option><option value="course">Course, Then Alphabetical</option></select>
      </label>
      <button type="button" class="secondary-button" @click="resetStudentFilters">Reset Filters</button>
      <button v-if="search" type="button" class="secondary-button" @click="search = ''">
        Reset
      </button>

      <span style="color: #5a6b52; font-size: 12px; margin-left: auto"
        >{{ tableStudents.length }} results</span
      >
    </div>

    <section class="stat-card students-enrollment-bar">
      <div class="students-enrollment-heading">
        <span class="settings-label">{{ enrollmentHeading }}</span>
        <small>Counts reflect matching students with at least one enrollment in each course.</small>
      </div>

      <div class="students-enrollment-metrics">
        <div class="students-enrollment-metric">
          <strong>{{ course2200Count }}</strong>
          <span>EPCS 2200</span>
          <small>Students</small>
        </div>

        <div class="students-enrollment-metric">
          <strong>{{ course3200Count }}</strong>
          <span>EPCS 3200</span>
          <small>Students</small>
        </div>
      </div>
      <p v-if="unknownCourseCount" class="muted-cell" style="margin-top:8px">Course not listed in the source records for {{ unknownCourseCount }} {{ unknownCourseCount === 1 ? 'student' : 'students' }}. Included in the roster.</p>
    </section>

    <!-- Student Breakdown Charts -->

    <!-- Student Breakdown Charts -->
    <details class="stat-card" style="margin: 16px 0; padding: 16px 20px">
      <summary style="cursor: pointer; font-size: 15px; font-weight: 700; color: #1a3a1a">
        Student Demographics & Breakdown
        <span style="font-size: 12px; font-weight: 400; color: #5a6b52; margin-left: 8px">

        </span>
      </summary>

      <div
        class="filter-bar"
        style="margin-top: 16px; margin-bottom: 16px; display: flex; flex-wrap: wrap; gap: 10px"
      >
        <select v-model="semesterMode" aria-label="Choose semester filter type" @change="syncSemesterMode">
          <option value="all">All Semesters</option>
          <option value="single">Single Semester</option>
          <option value="range">Custom Semester Range</option>
        </select>

        <select v-if="semesterMode === 'single'" v-model="semester" aria-label="Choose semester">
          <option v-for="s in semesters" :key="s.id" :value="s.id">
            {{ s.label }}
          </option>
        </select>

        <label v-if="semesterMode === 'range'" class="inline-filter-label">
          <span>From</span>
          <select v-model="semesterRangeStart">
            <option v-for="s in semesters" :key="s.id" :value="s.id">
              {{ s.label }}
            </option>
          </select>
        </label>

        <label v-if="semesterMode === 'range'" class="inline-filter-label">
          <span>To</span>
          <select v-model="semesterRangeEnd">
            <option v-for="s in semesters" :key="s.id" :value="s.id">
              {{ s.label }}
            </option>
          </select>
        </label>

        <select v-model="major" aria-label="Filter by major">
          <option value="all">All Majors</option>
          <option v-for="m in majors" :key="m" :value="m">{{ m }}</option>
        </select>

        <select v-model="year" aria-label="Filter by year">
          <option value="all">All Years</option>
          <option v-for="y in years" :key="y" :value="y">
            {{ getClassStanding(y) }}
          </option>
        </select>


        <span style="font-size: 12px; color: #5a6b52; margin-left: auto">
          {{ tableStudents.length }} students
        </span>
      </div>

      <p style="font-size: 12px; color: #5a6b52; margin: 12px 0">
        Counts reflect the current student filters.
      </p>

      <div
        style="
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 12px;
        "
      >
        <details
          v-for="chart in [
            { title: 'Students by Major', data: studentMajorBreakdown },
            { title: 'Students by Year', data: studentYearBreakdown },
            { title: 'Students by Gender', data: studentGenderBreakdown },
          ]"
          :key="chart.title"
          style="border: 1px solid #dce5d7; border-radius: 8px; padding: 14px; background: #ffffff"
        >
          <summary style="cursor: pointer; font-size: 14px; font-weight: 600; color: #1a3a1a">
            {{ chart.title }}
          </summary>

          <div style="margin-top: 16px; max-height: 260px; overflow-y: auto">
            <div v-for="item in chart.data" :key="item.label" style="margin-bottom: 14px">
              <div
                style="
                  display: flex;
                  justify-content: space-between;
                  gap: 8px;
                  font-size: 12px;
                  color: #1a3a1a;
                  margin-bottom: 6px;
                "
              >
                <span>{{ item.label }}</span>
                <strong>{{ item.count }}</strong>
              </div>

              <div style="height: 9px; background: #e8eee4; border-radius: 6px; overflow: hidden">
                <div
                  style="height: 100%; background: #347a46; border-radius: 6px"
                  :style="{
                    width: tableStudents.length ? `${(item.count / tableStudents.length) * 100}%` : '0%',
                  }"
                ></div>
              </div>
            </div>

            <p v-if="chart.data.length === 0" style="font-size: 12px; color: #5a6b52">
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
            @click="
              studentBulkAction = 'Remove';
              confirmingRemoval = true
            "
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
          <tr v-if="!tableStudents.length"><td colspan="9">No Students Match These Filters. Use Reset Filters to see the roster.</td></tr>
          <template v-for="s in paginatedStudents" :key="s.id">
            <tr :id="`student-row-${s.id}`"
              @click="toggleExpand(s.id)"
              style="cursor: pointer; color: #1a3a1a; background: #ffffff"
            >
              <td class="selection-cell" @click.stop>
                <input
                  v-model="selectedStudents"
                  type="checkbox"
                  :value="s.id"
                  :aria-label="`Select ${s.name}`"
                />
              </td>
              <td>
                <div class="student-name-cell">
                  <span style="font-weight: 600">{{ s.name }}</span>

                  <span
                    class="student-expand-arrow"
                    :class="{ 'is-expanded': expanded === s.id }"
                    aria-hidden="true"
                  >
                    ▼
                  </span>
                </div>
              </td>

              <td style="color: #5a6b52; font-size: 12px">
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
                <span class="mono" style="font-size: 11px">
                  {{ s.gender }}
                </span>
              </td>

              <td>
                <span class="badge" style="background: #d4edda; color: #145214">
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
                  <div style="display: flex; gap: 8px; align-items: center">
                    <button class="secondary-button" @click="startEditingStudent(s)">Edit</button>

                    <button class="remove-button" @click="pendingRowRemoval = s.id">Remove</button>
                  </div>
                </template>
              </td>
            </tr>
            <tr v-if="expanded === s.id" style="background: #f6f8f3">
              <td colspan="9" style="padding: 12px 18px">
                <div
                  v-if="editingStudentId === s.id"
                  style="
                    background: #ffffff;
                    padding: 20px;
                    border: 1px solid #dce5d7;
                    border-radius: 8px;
                    margin-bottom: 16px;
                  "
                >
                  <h3
                    style="font-size: 16px; font-weight: 700; color: #1a3a1a; margin-bottom: 16px"
                  >
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
                        <option value="Unknown">Unknown</option>
                        <option value="Other">Other</option>
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
                        <option :value="null">Unknown</option>
                        <option value="EPCS 2200">EPCS 2200</option>
                        <option value="EPCS 3200">EPCS 3200</option>
                      </select>
                    </label>
                  </div>

                  <div
                    style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px"
                  >
                    <button type="button" class="secondary-button" @click.stop="cancelStudentEdits">
                      Cancel
                    </button>

                    <button type="button" class="primary-button" @click.stop="saveStudentEdits">
                      Save Changes
                    </button>
                  </div>
                </div>
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px">
                  <div>
                    <div
                      style="
                        font-size: 11px;
                        font-weight: 700;
                        text-transform: uppercase;
                        letter-spacing: 0.06em;
                        color: #5a6b52;
                        margin-bottom: 10px;
                      "
                    >
                      Semester and Project History
                    </div>
                    <table
                      class="data-table"
                      style="width: 100%; background: #ffffff; color: #1a3a1a"
                    >
                      <thead>
                        <tr>
                          <th>Semester</th>
                          <th>Project</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="sem in s.semesters" :key="sem">
                          <td style="color: #1a3a1a; white-space: nowrap">
                            {{ getSemesterLabel(sem) }}
                          </td>
                          <td style="color: #1a3a1a">
                            <template v-if="getStudentProjectsForSemester(s.id, sem).length">
                              <button
                                v-for="project in getStudentProjectsForSemester(s.id, sem)"
                                :key="project.id"
                                class="record-link record-link-block"
                                @click.stop="emit('openProject', project.id, sem)"
                              >
                                {{ project.name }}
                              </button>
                            </template>
                            <span v-else style="color: #5a6b52; font-size: 12px"
                              >No project recorded</span
                            >
                          </td>
                        </tr>
                      </tbody>
                    </table>
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
                    <div style="font-size: 12px; color: #1a3a1a; margin-bottom: 6px">
                      <strong>Race/Ethnicity:</strong> {{ s.raceEthnicity || 'Not provided' }}
                    </div>
                    <div style="font-size: 12px; color: #1a3a1a; margin-bottom: 6px">
                      <strong>Major:</strong> {{ s.major }}
                    </div>
                    <div style="font-size: 12px; color: #1a3a1a; margin-bottom: 6px">
                      <strong>Year:</strong> {{ getClassStanding(s.year) }}
                    </div>
                    <div style="font-size: 12px; color: #1a3a1a; margin-bottom: 6px">
                      <strong>Gender:</strong> {{ s.gender }}
                    </div>
                    <div style="font-size: 12px; color: #5a6b52">
                      <strong>Project Assignments:</strong>
                      {{ teams.filter((team) => team.studentIds.includes(s.id)).length }}
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
      style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 16px;
        padding: 12px 4px;
      "
    >
      <span style="font-size: 13px; color: #5a6b52">
        <template v-if="tableStudents.length === 0"> No Students Match These Filters </template>
        <template v-else>
          Showing
          {{ (currentPage - 1) * studentsPerPage + 1 }}–{{
            Math.min(currentPage * studentsPerPage, tableStudents.length)
          }}
          of {{ tableStudents.length }} students (Page {{ currentPage }} of {{ totalPages }}) · 25 per page · {{ studentSort === 'year' ? 'Class Standing, Then Alphabetical' : studentSort === 'course' ? 'Course, Then Alphabetical' : 'Alphabetical (A–Z)' }}
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
  .students-enrollment-bar {
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 14px 24px;
    margin: 12px 0;
    min-height: 0;
  }

  .students-enrollment-heading {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .students-enrollment-heading small {
    color: #5a6b52;
    font-size: 12px;
  }

  .students-enrollment-metrics {
    flex: 2;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: center;
  }

  .students-enrollment-metric {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    text-align: center;
    padding: 2px 16px;
    min-width: 0;
  }

  .students-enrollment-metric:first-child {
    border-left: 1px solid #d9e2d9;
  }

  .students-enrollment-metric + .students-enrollment-metric {
    border-left: 1px solid #d9e2d9;
  }

  .students-enrollment-metric strong {
    font-size: 26px;
    line-height: 1.1;
    color: #1a3a1a;
  }

  .students-enrollment-metric span {
    font-size: 14px;
    font-weight: 700;
    color: #1a3a1a;
  }

  .students-enrollment-metric small {
    font-size: 12px;
    color: #5a6b52;
  }

  @media (max-width: 650px) {
    .students-enrollment-bar {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }

    .students-enrollment-metrics {
      flex: none;
    }

    .students-enrollment-metric:first-child {
      border-left: none;
    }
  }

  .student-name-cell {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .student-expand-arrow {
    display: inline-block;
    font-size: 11px;
    color: #5a6b52;
    transition: transform 0.2s ease;
  }

  .student-expand-arrow.is-expanded {
    transform: rotate(180deg);
  }
</style>
