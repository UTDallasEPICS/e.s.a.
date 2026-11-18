import type { EnrollmentCreate, EnrollmentRead } from '#server/services/enrollmentService'
import { deserializeSkills, serializeSkills } from '#server/services/enrollmentService'
import type { MembershipCreate, MembershipRead } from '#server/services/membershipService'
import { MEMBERSHIP_INCLUDE } from '#server/services/membershipService'
import type { ChoiceCreate, ChoiceRead } from '#server/services/choiceService'
import { prisma } from '#server/utils/prisma'

const STUDENT_INCLUDE = {
  Enrollments: true,
  Memberships: { include: MEMBERSHIP_INCLUDE },
  Choices: true,
} as const

function toStudentRead(student: any): StudentRead {
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

const getAllStudents = async (semesterId?: string): Promise<StudentRead[]> => {
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
  return students.map(toStudentRead)
}

const getStudentById = async (id: string): Promise<StudentRead | null> => {
  const student = await prisma.student.findUnique({
    where: { id },
    include: STUDENT_INCLUDE,
  })
  return student ? toStudentRead(student) : null
}

const createStudent = async (data: StudentCreate): Promise<StudentRead> => {
  const { Enrollments, Memberships, Choices, ...rest } = data
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
  return toStudentRead(student)
}

const updateStudent = async (id: string, data: StudentUpdate): Promise<StudentRead> => {
  const student = await prisma.student.update({
    where: { id },
    data,
    include: STUDENT_INCLUDE,
  })
  return toStudentRead(student)
}

const deleteStudent = async (id: string): Promise<void> => {
  await prisma.student.delete({ where: { id } })
}

const studentService = {
  getAllStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
}

export default studentService
