/**
 * Purpose
 * Provide the data logic used by other parts of ESA.
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
import { reactive } from 'vue'
import source from './verified-data.json'

export type Semester = {
  id: string
  label: string
  year: number
  term: 'Fall' | 'Spring' | 'Summer'
}
export type Partner = {
  id: string
  name: string
  contact: string
  email: string
  phone: string
  activeProjects: number
}
export type Project = {
  id: string
  projectNumber?: number
  name: string
  partnerId: string
  type?: string
  status: 'Active' | 'New' | 'In Progress' | 'Paused' | 'Completed' | 'Dropped'
  description: string
  semesters: string[]
  mentorName?: string
  mentorEmail?: string
  semesterDetails?: ProjectSemesterDetail[]
}
export type ProjectSemesterDetail = {
  semesterId: string
  contactName: string
  contactEmail: string
  contactPhone: string
  mentorName: string
  mentorEmail: string
  teamSkills?: string[]
  status?: Project['status']
  statusNote?: string
}
export type StudentEnrollment = {
  gender: string
  major: string
  year: string
  class: string
  skills: string[]
  meetingDay: string
  courseEnrollment?: 'EPCS 2200' | 'EPCS 3200' | null
  participationStatus?: 'Assigned' | 'Unassigned' | 'Exited Program'
}
export type Student = StudentEnrollment & {
  id: string
  name: string
  email: string
  netID?: string | null
  raceEthnicity: string
  semesters: string[]
  projects: string[]
  isMentor: boolean
  statusNote?: string
  sourceSemester?: string
  enrollmentDetails?: Record<string, StudentEnrollment>
}
export type Team = {
  projectId: string
  semesterId: string
  peerLeadId?: string
  studentIds: string[]
  meetingDay?: string
}
export type Choice = { studentId: string; projectId: string; semesterId: string; rank: number }
export type OfficialDemographics = {
  course: string
  period: string
  ethnicity: Record<string, number>
  gender: Record<string, number>
}

// These are the only semesters with verified enrollment and assignment sources.
export const semesters = source.semesters as Semester[]
// Use reactive to initialize students.
export const students = reactive(source.students as Student[])
// Use reactive to initialize projects.
export const projects = reactive(source.projects as Project[])
// Use reactive to initialize partners.
export const partners = reactive(source.partners as Partner[])
// Use reactive to initialize teams.
export const teams = reactive(source.teams as Team[])
// Define choices for the steps below.
export const choices = source.choices as Choice[]
// Define officialDemographics for the steps below.
export const officialDemographics = source.demographics as OfficialDemographics[]
// Compatibility for editable roster storage. Imported assignments all use teams.
export const officialProjectRosters = reactive<Record<string, { name: string; major: string }[]>>(
  {}
)
// Define getOfficialProjectRoster for the steps below.
export const getOfficialProjectRoster = (projectId: string, _semesterId?: string) =>
  officialProjectRosters[projectId] ?? []

// Define getPartnerById for the steps below.
export const getPartnerById = (id: string) => partners.find((partner) => partner.id === id)
// Define getProjectById for the steps below.
export const getProjectById = (id: string) => projects.find((project) => project.id === id)
// Define getStudentById for the steps below.
export const getStudentById = (id: string) => students.find((student) => student.id === id)
// Define getSemesterLabel for the steps below.
export const getSemesterLabel = (id: string) =>
  semesters.find((semester) => semester.id === id)?.label ?? id
// Define getClassStanding for the steps below.
export const getClassStanding = (year: string) =>
  ({ '1st Year': 'Freshman', '2nd Year': 'Sophomore', '3rd Year': 'Junior', '4th Year': 'Senior' })[
    year
  ] ?? year
// Define getStudentCourse for the steps below.
export const getStudentCourse = (student: Student) => student.courseEnrollment ?? 'Unknown'

// Define the helper that will get student for semester.
export function getStudentForSemester(student: Student, selection: string | string[]): Student {
  // Check whether selection === 'all' before running this branch.
  if (selection === 'all') return student
  // Define selected for the steps below.
  const selected = typeof selection === 'string' ? [selection] : selection
  // Use semesters .filter((item) => selected.includes(item.id) && student.semesters.includes(item.id)) .at to initialize semester.
  const semester = semesters
    .filter((item) => selected.includes(item.id) && student.semesters.includes(item.id))
    .at(-1)
  // Define details for the steps below.
  const details = semester && student.enrollmentDetails?.[semester.id]
  // Pass details ? { ...student, ...details } : student back to the caller.
  return details ? { ...student, ...details } : student
}
