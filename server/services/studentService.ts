/**
 * Purpose
 * Provide the student service logic used by other parts of ESA.
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
import type { EnrollmentCreate, EnrollmentRead } from '#server/services/enrollmentService'
import { deserializeSkills, serializeSkills } from '#server/services/enrollmentService'
import type { MembershipCreate, MembershipRead } from '#server/services/membershipService'
import { MEMBERSHIP_INCLUDE } from '#server/services/membershipService'
import type { ChoiceCreate, ChoiceRead } from '#server/services/choiceService'
import { prisma } from '#server/utils/prisma'

// Define STUDENT_INCLUDE for the steps below.
const STUDENT_INCLUDE = {
  Enrollments: true,
  Memberships: { include: MEMBERSHIP_INCLUDE },
  Choices: true,
} as const

// Define the helper that will to student read.
function toStudentRead(student: any): StudentRead {
  // Pass { ...student, Enrollments: student.Enrollments.map((e: any) => ({ ...e, skills: deserializeSkills(e. back to the caller.
  return {
    ...student,
    Enrollments: student.Enrollments.map((e: any) => ({
      ...e,
      skills: deserializeSkills(e.skills),
    })),
  }
}

export interface StudentRead {
  id: string
  github: string | null
  discord: string | null
  email: string | null
  netID: string
  firstName: string
  lastName: string
  isMentor: boolean
  Enrollments: EnrollmentRead[]
  Memberships: MembershipRead[]
  Choices: ChoiceRead[]
}

export interface StudentCreate {
  github?: string | null
  discord?: string | null
  email?: string | null
  netID: string
  firstName: string
  lastName: string
  isMentor?: boolean
  Enrollments?: Omit<EnrollmentCreate, 'studentId'>[]
  Memberships?: Omit<MembershipCreate, 'studentId'>[]
  Choices?: Omit<ChoiceCreate, 'studentId'>[]
}

export interface StudentUpdate {
  github?: string | null
  discord?: string | null
  email?: string | null
  netID?: string
  firstName?: string
  lastName?: string
  isMentor?: boolean
}

// Define getAllStudents for the steps below.
const getAllStudents = async (semesterId?: string): Promise<StudentRead[]> => {
  // Define students for the steps below.
  const students = await prisma.student.findMany({
    where: semesterId
      ? {
          OR: [
            { Enrollments: { some: { semesterId } } },
            { Memberships: { some: { isMentor: true, Team: { semesterId } } } },
          ],
        }
      : undefined,
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    include: STUDENT_INCLUDE,
  })
  // Pass students.map(toStudentRead) back to the caller.
  return students.map(toStudentRead)
}

// Define getStudentById for the steps below.
const getStudentById = async (id: string): Promise<StudentRead | null> => {
  // Define student for the steps below.
  const student = await prisma.student.findUnique({
    where: { id },
    include: STUDENT_INCLUDE,
  })
  // Pass student ? toStudentRead(student) : null back to the caller.
  return student ? toStudentRead(student) : null
}

// Define createStudent for the steps below.
const createStudent = async (data: StudentCreate): Promise<StudentRead> => {
  // Define { Enrollments, Memberships, Choices, ...rest } for the steps below.
  const { Enrollments, Memberships, Choices, ...rest } = data
  // Define student for the steps below.
  const student = await prisma.student.create({
    data: {
      ...rest,
      Enrollments: Enrollments
        ? { create: Enrollments.map((e) => ({ ...e, skills: serializeSkills(e.skills) })) }
        : undefined,
      Memberships: Memberships ? { create: Memberships } : undefined,
      Choices: Choices ? { create: Choices } : undefined,
    },
    include: STUDENT_INCLUDE,
  })
  // Pass toStudentRead(student) back to the caller.
  return toStudentRead(student)
}

// Define updateStudent for the steps below.
const updateStudent = async (id: string, data: StudentUpdate): Promise<StudentRead> => {
  // Define student for the steps below.
  const student = await prisma.student.update({
    where: { id },
    data,
    include: STUDENT_INCLUDE,
  })
  // Pass toStudentRead(student) back to the caller.
  return toStudentRead(student)
}

// Define deleteStudent for the steps below.
const deleteStudent = async (id: string): Promise<void> => {
  await prisma.student.delete({ where: { id } })
}

// Define studentService for the steps below.
const studentService = {
  getAllStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
}

export default studentService
