/**
 * Purpose
 * Provide the enrollment service logic used by other parts of ESA.
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
import type { Gender, Year, Class, ProjectMeetingDay } from '@@/prisma/generated/client'
import { prisma } from '#server/utils/prisma'

export interface EnrollmentRead {
  id: string
  studentId: string
  semesterId: string
  gender: Gender
  major: string
  year: Year
  class: Class
  meetingDay: ProjectMeetingDay
  skills: string[]
  comments: string
}

export interface EnrollmentCreate {
  studentId: string
  semesterId: string
  gender: Gender
  major: string
  year: Year
  class: Class
  meetingDay: ProjectMeetingDay
  skills?: string[]
  comments?: string
}

export interface EnrollmentUpdate {
  semesterId?: string
  gender?: Gender
  major?: string
  year?: Year
  class?: Class
  meetingDay?: ProjectMeetingDay
  skills?: string[]
  comments?: string
}

// Define the helper that will serialize skills.
export function serializeSkills(skills: string[] | undefined): string {
  // Pass (skills ?? []) .map((s) => s.trim()) .filter(Boolean) .join(', ') back to the caller.
  return (skills ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
    .join(', ')
}

// Define the helper that will deserialize skills.
export function deserializeSkills(skills: string): string[] {
  // Pass skills .split(',') .map((s) => s.trim()) .filter(Boolean) back to the caller.
  return skills
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

// Define the helper that will to enrollment read.
function toEnrollmentRead(row: { skills: string; [key: string]: any }): EnrollmentRead {
  // Pass { ...row, skills: deserializeSkills(row.skills) } as EnrollmentRead back to the caller.
  return { ...row, skills: deserializeSkills(row.skills) } as EnrollmentRead
}

// Define getEnrollmentById for the steps below.
const getEnrollmentById = async (id: string): Promise<EnrollmentRead | null> => {
  // Define enrollment for the steps below.
  const enrollment = await prisma.enrollment.findUnique({
    where: { id },
  })
  // Pass enrollment ? toEnrollmentRead(enrollment) : null back to the caller.
  return enrollment ? toEnrollmentRead(enrollment) : null
}

// Define createEnrollment for the steps below.
const createEnrollment = async (data: EnrollmentCreate): Promise<EnrollmentRead> => {
  // Define enrollment for the steps below.
  const enrollment = await prisma.enrollment.create({
    data: { ...data, skills: serializeSkills(data.skills) },
  })
  // Pass toEnrollmentRead(enrollment) back to the caller.
  return toEnrollmentRead(enrollment)
}

// Define updateEnrollment for the steps below.
const updateEnrollment = async (id: string, data: EnrollmentUpdate): Promise<EnrollmentRead> => {
  // Define enrollment for the steps below.
  const enrollment = await prisma.enrollment.update({
    where: { id },
    data: { ...data, skills: data.skills !== undefined ? serializeSkills(data.skills) : undefined },
  })
  // Pass toEnrollmentRead(enrollment) back to the caller.
  return toEnrollmentRead(enrollment)
}

// Define deleteEnrollment for the steps below.
const deleteEnrollment = async (id: string): Promise<void> => {
  await prisma.enrollment.delete({ where: { id } })
}

// Define enrollmentService for the steps below.
const enrollmentService = {
  getEnrollmentById,
  createEnrollment,
  updateEnrollment,
  deleteEnrollment,
}

export default enrollmentService
