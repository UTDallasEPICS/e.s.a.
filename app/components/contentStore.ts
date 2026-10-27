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

const baseStudentIds = new Set(students.map(student => student.id))
const baseProjectIds = new Set(projects.map(project => project.id))

function load<T>(key: string, fallback: T): T {
  if (import.meta.server) {
    return fallback
  }

  try {
    return JSON.parse(localStorage.getItem(key) ?? '') as T
  } catch {
    return fallback
  }
}

const addedStudents = load<Student[]>('epics-added-students', [])
const addedProjects = load<Project[]>('epics-added-projects', [])
const studentOverrides = load<Record<string, Partial<Student>>>('epics-student-overrides', {})
const projectOverrides = load<Record<string, Partial<Project>>>('epics-project-overrides', {})
const rosterOverrides = load<Record<string, { name: string; major: string }[]>>('epics-project-roster-overrides', {})
const teamOverrides = load<Record<string, string[]>>('epics-team-overrides', {})
export const recoveryItems = ref<RecoveryItem[]>(load<RecoveryItem[]>('epics-recovery-items', []))
export const projectAssignmentRemovals = ref<ProjectAssignmentRemoval[]>(
  load<ProjectAssignmentRemoval[]>('epics-project-assignment-removals', [])
)
const permanentlyDeletedKeys = new Set(load<string[]>('epics-permanently-deleted-items', []))

students.push(...addedStudents.filter(student => !students.some(existing => existing.id === student.id)))
projects.push(...addedProjects.filter(project => !projects.some(existing => existing.id === project.id)))
students.forEach(student => {
  const override = studentOverrides[student.id]
  if (override) Object.assign(student, override)
})
projects.forEach(project => {
  const override = projectOverrides[project.id]
  if (override) Object.assign(project, override)
})
Object.entries(rosterOverrides).forEach(([projectId, roster]) => {
  officialProjectRosters[projectId] = roster
})
teams.forEach(team => {
  const override = teamOverrides[`${team.projectId}:${team.semesterId}`]
  if (override) team.studentIds = override
})

const deletedStudentIds = new Set(
  [
    ...recoveryItems.value.filter(item => item.type === 'student').map(item => item.record.id),
    ...Array.from(permanentlyDeletedKeys)
      .filter(key => key.startsWith('student:'))
      .map(key => key.slice('student:'.length)),
  ]
)
const deletedProjectIds = new Set(
  [
    ...recoveryItems.value.filter(item => item.type === 'project').map(item => item.record.id),
    ...Array.from(permanentlyDeletedKeys)
      .filter(key => key.startsWith('project:'))
      .map(key => key.slice('project:'.length)),
  ]
)

deletedStudentIds.forEach(id => {
  const index = students.findIndex(student => student.id === id)
  if (index >= 0) students.splice(index, 1)
})
deletedProjectIds.forEach(id => {
  const index = projects.findIndex(project => project.id === id)
  if (index >= 0) projects.splice(index, 1)
})

function persist() {
  if (import.meta.server) return
  
  localStorage.setItem(
    'epics-added-students',
    JSON.stringify(students.filter(student => !baseStudentIds.has(student.id)))
  )
  localStorage.setItem(
    'epics-added-projects',
    JSON.stringify(projects.filter(project => !baseProjectIds.has(project.id)))
  )
  localStorage.setItem('epics-recovery-items', JSON.stringify(recoveryItems.value))
  localStorage.setItem('epics-permanently-deleted-items', JSON.stringify(Array.from(permanentlyDeletedKeys)))
  localStorage.setItem('epics-project-overrides', JSON.stringify(projectOverrides))
  localStorage.setItem('epics-student-overrides', JSON.stringify(studentOverrides))
  localStorage.setItem('epics-project-roster-overrides', JSON.stringify(rosterOverrides))
  localStorage.setItem('epics-team-overrides', JSON.stringify(teamOverrides))
  localStorage.setItem('epics-project-assignment-removals', JSON.stringify(projectAssignmentRemovals.value))
}

export function addStudent(student: Student) {
  students.push(student)
  persist()
}

export function updateStudent(studentId: string, updates: Partial<Student>) {
  const student = students.find(item => item.id === studentId)
  if (!student) return
  Object.assign(student, updates)
  studentOverrides[studentId] = {
    ...(studentOverrides[studentId] ?? {}),
    ...updates,
  }
  persist()
}

export function removeProjectAssignments(
  projectId: string,
  semesterId: string,
  assignmentKeys: string[],
  note: string
) {
  const project = projects.find(item => item.id === projectId)
  if (!project) return
  const officialNames = new Set(
    assignmentKeys
      .filter(key => key.startsWith('official:'))
      .map(key => key.slice('official:'.length))
  )
  const studentIds = new Set(
    assignmentKeys
      .filter(key => key.startsWith('student:'))
      .map(key => key.slice('student:'.length))
  )

  if (officialNames.size && officialProjectRosters[projectId]) {
    officialProjectRosters[projectId] = officialProjectRosters[projectId]
      .filter(student => !officialNames.has(student.name))
    rosterOverrides[projectId] = officialProjectRosters[projectId]
  }

  const team = teams.find(item => item.projectId === projectId && item.semesterId === semesterId)
  if (team && studentIds.size) {
    team.studentIds = team.studentIds.filter(studentId => !studentIds.has(studentId))
    teamOverrides[`${team.projectId}:${team.semesterId}`] = [...team.studentIds]
  }

  const removedAt = new Date().toISOString()
  assignmentKeys.forEach((key, index) => {
    const studentId = key.startsWith('student:') ? key.slice('student:'.length) : null
    const studentName = studentId
      ? students.find(student => student.id === studentId)?.name ?? studentId
      : key.slice('official:'.length)
    projectAssignmentRemovals.value.unshift({
      id: `${projectId}:${semesterId}:${Date.now()}:${index}`,
      projectId,
      projectName: project.name,
      semesterId,
      studentName,
      note,
      removedAt,
    })
    if (studentId) {
      const hasAnotherAssignment = teams.some(item =>
        item.semesterId === semesterId && item.studentIds.includes(studentId)
      )
      if (!hasAnotherAssignment) {
        updateStudent(studentId, {
          participationStatus: 'Unassigned',
          statusNote: note || `Removed from ${project.name} for ${semesterId}.`,
        })
      }
    }
  })
  persist()
}

export function addProject(project: Project) {
  projects.push(project)
  persist()
}

export function updateProject(projectId: string, updates: Partial<Project>) {
  const project = projects.find(item => item.id === projectId)
  if (!project) return
  Object.assign(project, updates)
  projectOverrides[projectId] = {
    ...(projectOverrides[projectId] ?? {}),
    ...updates,
  }
  persist()
}

export function removeStudent(studentId: string) {
  const index = students.findIndex(student => student.id === studentId)
  if (index < 0) return

  const assignments = teams
  .filter(team => team.studentIds.includes(studentId))
  .map(team => ({
    projectId: team.projectId,
    semesterId: team.semesterId,
  }))

const [record] = students.splice(index, 1)

recoveryItems.value.unshift({
    key: `student:${record.id}`,
    type: 'student',
    deletedAt: new Date().toISOString(),
    record: { ...record },
assignments,
  })

  teams.forEach(team => {
    if (team.studentIds.includes(studentId)) {
      team.studentIds = team.studentIds.filter(id => id !== studentId)

      teamOverrides[`${team.projectId}:${team.semesterId}`] = [
        ...team.studentIds,
      ]
    }
  })

  persist()
}

export function removeProject(projectId: string) {
  const index = projects.findIndex(project => project.id === projectId)
  if (index < 0) return
  const [record] = projects.splice(index, 1)
  recoveryItems.value.unshift({
    key: `project:${record.id}`,
    type: 'project',
    deletedAt: new Date().toISOString(),
    record: { ...record, semesters: [...record.semesters] },
  })
  persist()
}

export function restoreItem(key: string) {
  const index = recoveryItems.value.findIndex(item => item.key === key)
  if (index < 0) return

  const [item] = recoveryItems.value.splice(index, 1)

  if (item.type === 'student') {
    if (!students.some(student => student.id === item.record.id)) {
      students.push(item.record)
    }

    // Restore the student's original project assignments.
    item.assignments?.forEach(assignment => {
      const team = teams.find(team =>
        team.projectId === assignment.projectId &&
        team.semesterId === assignment.semesterId
      )

      if (team && !team.studentIds.includes(item.record.id)) {
        team.studentIds.push(item.record.id)

        teamOverrides[`${team.projectId}:${team.semesterId}`] = [
          ...team.studentIds,
        ]
      }
    })
  }

  if (item.type === 'project' && !projects.some(project => project.id === item.record.id)) {
    projects.push(item.record)
  }

  persist()
}

export function permanentlyDeleteItem(key: string) {
  const index = recoveryItems.value.findIndex(item => item.key === key)
  if (index >= 0) {
    recoveryItems.value.splice(index, 1)
    permanentlyDeletedKeys.add(key)
  }
  persist()
}
