/**
 * Purpose
 * Provide the content store logic used by other parts of ESA.
 *
 * Inputs
 * - Values passed by callers and any configuration or records imported here.
 *
 * Outputs
 * - The values, types, or functions exported by this file.
 *
 * Pseudocode
 * Load the dependencies → define the file’s rules or helpers → expose them for other files to use.
 */
import { ref } from 'vue'
import { officialProjectRosters, projects, students, teams } from './data'
import type { Project, Student } from './data'

export type RecoveryItem =
  | {
      key: string
      type: 'student'
      deletedAt: string
      record: Student
      assignments?: {
        projectId: string
        semesterId: string
      }[]
    }
  | {
      key: string
      type: 'project'
      deletedAt: string
      record: Project
    }

export type ProjectAssignmentRemoval = {
  id: string
  projectId: string
  projectName: string
  semesterId: string
  studentName: string
  note: string
  removedAt: string
}

// Define baseStudentIds for the steps below.
const baseStudentIds = new Set(students.map((student) => student.id))
// Define baseProjectIds for the steps below.
const baseProjectIds = new Set(projects.map((project) => project.id))

// Define the helper that will load.
function load<T>(key: string, fallback: T): T {
  // Check whether import.meta.server before running this branch.
  if (import.meta.server) {
    // Pass fallback back to the caller.
    return fallback
  }

  try {
    // Pass JSON.parse(localStorage.getItem('verified-v1:' + key) ?? '') as T back to the caller.
    return JSON.parse(localStorage.getItem('verified-v1:' + key) ?? '') as T
  } catch {
    // Pass fallback back to the caller.
    return fallback
  }
}

// Use load to initialize addedStudents.
const addedStudents = load<Student[]>('epics-added-students', [])
// Use load to initialize addedProjects.
const addedProjects = load<Project[]>('epics-added-projects', [])
// Use load to initialize studentOverrides.
const studentOverrides = load<Record<string, Partial<Student>>>('epics-student-overrides', {})
// Use load to initialize projectOverrides.
const projectOverrides = load<Record<string, Partial<Project>>>('epics-project-overrides', {})
// Use load to initialize rosterOverrides.
const rosterOverrides = load<Record<string, { name: string; major: string }[]>>(
  'epics-project-roster-overrides',
  {}
)
// Use load to initialize teamOverrides.
const teamOverrides = load<Record<string, string[]>>('epics-team-overrides', {})
// Store recoveryItems as state so Vue reacts when it changes.
export const recoveryItems = ref<RecoveryItem[]>(load<RecoveryItem[]>('epics-recovery-items', []))
// Store projectAssignmentRemovals as state so Vue reacts when it changes.
export const projectAssignmentRemovals = ref<ProjectAssignmentRemoval[]>(
  load<ProjectAssignmentRemoval[]>('epics-project-assignment-removals', [])
)
// Define permanentlyDeletedKeys for the steps below.
const permanentlyDeletedKeys = new Set(load<string[]>('epics-permanently-deleted-items', []))

// Call students.push to run this step.
students.push(
  ...addedStudents.filter((student) => !students.some((existing) => existing.id === student.id))
)
// Call projects.push to run this step.
projects.push(
  ...addedProjects.filter((project) => !projects.some((existing) => existing.id === project.id))
)
// Call students.forEach to run this step.
students.forEach((student) => {
  // Define override for the steps below.
  const override = studentOverrides[student.id]
  // Check whether override before running this branch.
  if (override) Object.assign(student, override)
})
// Call projects.forEach to run this step.
projects.forEach((project) => {
  // Define override for the steps below.
  const override = projectOverrides[project.id]
  // Check whether override before running this branch.
  if (override) Object.assign(project, override)
})
// Call Object.entries(rosterOverrides).forEach to run this step.
Object.entries(rosterOverrides).forEach(([projectId, roster]) => {
  // Update officialProjectRosters[projectId] with the value on the right.
  officialProjectRosters[projectId] = roster
})
// Call teams.forEach to run this step.
teams.forEach((team) => {
  // Define override for the steps below.
  const override = teamOverrides[`${team.projectId}:${team.semesterId}`]
  // Check whether override before running this branch.
  if (override) team.studentIds = override
})

// Define deletedStudentIds for the steps below.
const deletedStudentIds = new Set([
  ...recoveryItems.value.filter((item) => item.type === 'student').map((item) => item.record.id),
  ...Array.from(permanentlyDeletedKeys)
    .filter((key) => key.startsWith('student:'))
    .map((key) => key.slice('student:'.length)),
])
// Define deletedProjectIds for the steps below.
const deletedProjectIds = new Set([
  ...recoveryItems.value.filter((item) => item.type === 'project').map((item) => item.record.id),
  ...Array.from(permanentlyDeletedKeys)
    .filter((key) => key.startsWith('project:'))
    .map((key) => key.slice('project:'.length)),
])

// Call deletedStudentIds.forEach to run this step.
deletedStudentIds.forEach((id) => {
  // Use students.findIndex to initialize index.
  const index = students.findIndex((student) => student.id === id)
  // Check whether index >= 0 before running this branch.
  if (index >= 0) students.splice(index, 1)
})
// Call deletedProjectIds.forEach to run this step.
deletedProjectIds.forEach((id) => {
  // Use projects.findIndex to initialize index.
  const index = projects.findIndex((project) => project.id === id)
  // Check whether index >= 0 before running this branch.
  if (index >= 0) projects.splice(index, 1)
})

// Define the helper that will verified storage set.
function verifiedStorageSet(key: string, value: string) { localStorage.setItem('verified-v1:' + key, value) }

// Define the helper that will persist.
function persist() {
  // Check whether import.meta.server before running this branch.
  if (import.meta.server) return

  // Call verifiedStorageSet to run this step.
  verifiedStorageSet(
    'epics-added-students',
    JSON.stringify(students.filter((student) => !baseStudentIds.has(student.id)))
  )
  // Call verifiedStorageSet to run this step.
  verifiedStorageSet(
    'epics-added-projects',
    JSON.stringify(projects.filter((project) => !baseProjectIds.has(project.id)))
  )
  // Call verifiedStorageSet to run this step.
  verifiedStorageSet('epics-recovery-items', JSON.stringify(recoveryItems.value))
  // Call verifiedStorageSet to run this step.
  verifiedStorageSet(
    'epics-permanently-deleted-items',
    JSON.stringify(Array.from(permanentlyDeletedKeys))
  )
  // Call verifiedStorageSet to run this step.
  verifiedStorageSet('epics-project-overrides', JSON.stringify(projectOverrides))
  // Call verifiedStorageSet to run this step.
  verifiedStorageSet('epics-student-overrides', JSON.stringify(studentOverrides))
  // Call verifiedStorageSet to run this step.
  verifiedStorageSet('epics-project-roster-overrides', JSON.stringify(rosterOverrides))
  // Call verifiedStorageSet to run this step.
  verifiedStorageSet('epics-team-overrides', JSON.stringify(teamOverrides))
  // Call verifiedStorageSet to run this step.
  verifiedStorageSet(
    'epics-project-assignment-removals',
    JSON.stringify(projectAssignmentRemovals.value)
  )
}

// Define the helper that will add student.
export function addStudent(student: Student) {
  // Call students.push to run this step.
  students.push(student)
  // Call persist to run this step.
  persist()
}

// Define the helper that will update student.
export function updateStudent(studentId: string, updates: Partial<Student>, semesterId?: string) {
  // Use students.find to initialize student.
  const student = students.find((item) => item.id === studentId)
  // Check whether !student before running this branch.
  if (!student) return
  // Define targetSemester for the steps below.
  const targetSemester=semesterId ?? student.semesters.at(-1)
  // Define enrollmentFields for the steps below.
  const enrollmentFields=['gender','major','year','class','skills','meetingDay','courseEnrollment','participationStatus','statusNote'] as const
  // Check whether targetSemester before running this branch.
  if (targetSemester) {
    student.enrollmentDetails ??= {}
    // Define current for the steps below.
    const current=student.enrollmentDetails[targetSemester] ?? student
    // Update student.enrollmentDetails[targetSemester] with the value on the right.
    student.enrollmentDetails[targetSemester]={...current,...Object.fromEntries(enrollmentFields.filter(key=>key in updates).map(key=>[key,updates[key]]))}
  }
  // Define globalUpdates for the steps below.
  const globalUpdates={...updates}
  // Check whether targetSemester !== student.semesters.at(-1) before running this branch.
  if (targetSemester !== student.semesters.at(-1)) enrollmentFields.forEach(key=>delete (globalUpdates as Record<string,unknown>)[key])
  // Call Object.assign to run this step.
  Object.assign(student, globalUpdates)
  // Update updates with the value on the right.
  updates={...globalUpdates,enrollmentDetails:student.enrollmentDetails}
  // Update studentOverrides[studentId] with the value on the right.
  studentOverrides[studentId] = {
    ...(studentOverrides[studentId] ?? {}),
    ...updates,
  }
  // Call persist to run this step.
  persist()
}

// Define the helper that will remove project assignments.
export function removeProjectAssignments(
  projectId: string,
  semesterId: string,
  assignmentKeys: string[],
  note: string
) {
  // Use projects.find to initialize project.
  const project = projects.find((item) => item.id === projectId)
  // Check whether !project before running this branch.
  if (!project) return
  // Define officialNames for the steps below.
  const officialNames = new Set(
    assignmentKeys
      .filter((key) => key.startsWith('official:'))
      .map((key) => key.slice('official:'.length))
  )
  // Define studentIds for the steps below.
  const studentIds = new Set(
    assignmentKeys
      .filter((key) => key.startsWith('student:'))
      .map((key) => key.slice('student:'.length))
  )

  // Check whether officialNames.size && officialProjectRosters[projectId] before running this branch.
  if (officialNames.size && officialProjectRosters[projectId]) {
    // Update officialProjectRosters[projectId] with the value on the right.
    officialProjectRosters[projectId] = officialProjectRosters[projectId].filter(
      (student) => !officialNames.has(student.name)
    )
    // Update rosterOverrides[projectId] with the value on the right.
    rosterOverrides[projectId] = officialProjectRosters[projectId]
  }

  // Use teams.find to initialize team.
  const team = teams.find((item) => item.projectId === projectId && item.semesterId === semesterId)
  // Check whether team && studentIds.size before running this branch.
  if (team && studentIds.size) {
    // Update team.studentIds with the value on the right.
    team.studentIds = team.studentIds.filter((studentId) => !studentIds.has(studentId))
    // Update teamOverrides[`${team.projectId}:${team.semesterId}`] with the value on the right.
    teamOverrides[`${team.projectId}:${team.semesterId}`] = [...team.studentIds]
  }

  // Use new Date().toISOString to initialize removedAt.
  const removedAt = new Date().toISOString()
  // Call assignmentKeys.forEach to run this step.
  assignmentKeys.forEach((key, index) => {
    // Define studentId for the steps below.
    const studentId = key.startsWith('student:') ? key.slice('student:'.length) : null
    // Define studentName for the steps below.
    const studentName = studentId
      ? (students.find((student) => student.id === studentId)?.name ?? studentId)
      : key.slice('official:'.length)
    // Call projectAssignmentRemovals.value.unshift to run this step.
    projectAssignmentRemovals.value.unshift({
      id: `${projectId}:${semesterId}:${Date.now()}:${index}`,
      projectId,
      projectName: project.name,
      semesterId,
      studentName,
      note,
      removedAt,
    })
    // Check whether studentId before running this branch.
    if (studentId) {
      // Use teams.some to initialize hasAnotherAssignment.
      const hasAnotherAssignment = teams.some(
        (item) => item.semesterId === semesterId && item.studentIds.includes(studentId)
      )
      // Check whether !hasAnotherAssignment before running this branch.
      if (!hasAnotherAssignment) {
        // Call updateStudent to run this step.
        updateStudent(studentId, {
          participationStatus: 'Unassigned',
          statusNote: note || `Removed from ${project.name} for ${semesterId}.`,
        },semesterId)
      }
    }
  })
  // Call persist to run this step.
  persist()
}

// Define the helper that will add project.
export function addProject(project: Project) {
  // Call projects.push to run this step.
  projects.push(project)
  // Call persist to run this step.
  persist()
}

// Define the helper that will update project.
export function updateProject(projectId: string, updates: Partial<Project>) {
  // Use projects.find to initialize project.
  const project = projects.find((item) => item.id === projectId)
  // Check whether !project before running this branch.
  if (!project) return
  // Call Object.assign to run this step.
  Object.assign(project, updates)
  // Update projectOverrides[projectId] with the value on the right.
  projectOverrides[projectId] = {
    ...(projectOverrides[projectId] ?? {}),
    ...updates,
  }
  // Call persist to run this step.
  persist()
}

// Define the helper that will remove student.
export function removeStudent(studentId: string) {
  // Use students.findIndex to initialize index.
  const index = students.findIndex((student) => student.id === studentId)
  // Check whether index < 0 before running this branch.
  if (index < 0) return

  // Use teams .filter((team) => team.studentIds.includes(studentId)) .map to initialize assignments.
  const assignments = teams
    .filter((team) => team.studentIds.includes(studentId))
    .map((team) => ({
      projectId: team.projectId,
      semesterId: team.semesterId,
    }))

  // Use students.splice to initialize [record].
  const [record] = students.splice(index, 1)

  // Call recoveryItems.value.unshift to run this step.
  recoveryItems.value.unshift({
    key: `student:${record.id}`,
    type: 'student',
    deletedAt: new Date().toISOString(),
    record: { ...record },
    assignments,
  })

  // Call teams.forEach to run this step.
  teams.forEach((team) => {
    // Check whether team.studentIds.includes(studentId) before running this branch.
    if (team.studentIds.includes(studentId)) {
      // Update team.studentIds with the value on the right.
      team.studentIds = team.studentIds.filter((id) => id !== studentId)

      // Update teamOverrides[`${team.projectId}:${team.semesterId}`] with the value on the right.
      teamOverrides[`${team.projectId}:${team.semesterId}`] = [...team.studentIds]
    }
  })

  // Call persist to run this step.
  persist()
}

// Define the helper that will remove project.
export function removeProject(projectId: string) {
  // Use projects.findIndex to initialize index.
  const index = projects.findIndex((project) => project.id === projectId)
  // Check whether index < 0 before running this branch.
  if (index < 0) return
  // Use projects.splice to initialize [record].
  const [record] = projects.splice(index, 1)
  // Call recoveryItems.value.unshift to run this step.
  recoveryItems.value.unshift({
    key: `project:${record.id}`,
    type: 'project',
    deletedAt: new Date().toISOString(),
    record: { ...record, semesters: [...record.semesters] },
  })
  // Call persist to run this step.
  persist()
}

// Define the helper that will restore item.
export function restoreItem(key: string) {
  // Use recoveryItems.value.findIndex to initialize index.
  const index = recoveryItems.value.findIndex((item) => item.key === key)
  // Check whether index < 0 before running this branch.
  if (index < 0) return

  // Use recoveryItems.value.splice to initialize [item].
  const [item] = recoveryItems.value.splice(index, 1)

  // Check whether item.type === 'student' before running this branch.
  if (item.type === 'student') {
    // Check whether !students.some((student) => student.id === item.record.id) before running this branch.
    if (!students.some((student) => student.id === item.record.id)) {
      // Call students.push to run this step.
      students.push(item.record)
    }

    // Restore the student's original project assignments.
    item.assignments?.forEach((assignment) => {
      // Use teams.find to initialize team.
      const team = teams.find(
        (team) =>
          team.projectId === assignment.projectId && team.semesterId === assignment.semesterId
      )

      // Check whether team && !team.studentIds.includes(item.record.id) before running this branch.
      if (team && !team.studentIds.includes(item.record.id)) {
        // Call team.studentIds.push to run this step.
        team.studentIds.push(item.record.id)

        // Update teamOverrides[`${team.projectId}:${team.semesterId}`] with the value on the right.
        teamOverrides[`${team.projectId}:${team.semesterId}`] = [...team.studentIds]
      }
    })
  }

  // Check whether item.type === 'project' && !projects.some((project) => project.id === item.record.id) before running this branch.
  if (item.type === 'project' && !projects.some((project) => project.id === item.record.id)) {
    // Call projects.push to run this step.
    projects.push(item.record)
  }

  // Call persist to run this step.
  persist()
}

// Define the helper that will permanently delete item.
export function permanentlyDeleteItem(key: string) {
  // Use recoveryItems.value.findIndex to initialize index.
  const index = recoveryItems.value.findIndex((item) => item.key === key)
  // Check whether index >= 0 before running this branch.
  if (index >= 0) {
    // Call recoveryItems.value.splice to run this step.
    recoveryItems.value.splice(index, 1)
    // Call permanentlyDeletedKeys.add to run this step.
    permanentlyDeletedKeys.add(key)
  }
  // Call persist to run this step.
  persist()
}
