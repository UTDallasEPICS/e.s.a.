/**
 * Purpose
 * Provide the semester service logic used by other parts of ESA.
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
import type { Season } from '@@/prisma/generated/client'
import { prisma } from '#server/utils/prisma'

export interface SemesterRead {
  id: string
  year: number
  season: Season
}

export interface SemesterCreate {
  year: number
  season: Season
}

export interface SemesterUpdate {
  year?: number
  season?: Season
}

// Define getAllSemesters for the steps below.
const getAllSemesters = async (): Promise<SemesterRead[]> => {
  // Define semesters for the steps below.
  const semesters = await prisma.semester.findMany({
    orderBy: [{ year: 'desc' }, { season: 'asc' }],
  })
  // Pass semesters back to the caller.
  return semesters
}

// Define getSemesterById for the steps below.
const getSemesterById = async (id: string): Promise<SemesterRead | null> => {
  // Define semester for the steps below.
  const semester = await prisma.semester.findUnique({
    where: { id: id },
  })
  // Pass semester back to the caller.
  return semester
}

// Define createSemester for the steps below.
const createSemester = async (data: SemesterCreate): Promise<SemesterRead> => {
  // Define semester for the steps below.
  const semester = await prisma.semester.create({
    data,
  })
  // Pass semester back to the caller.
  return semester
}

// Define updateSemester for the steps below.
const updateSemester = async (id: string, data: SemesterUpdate): Promise<SemesterRead> => {
  // Define semester for the steps below.
  const semester = await prisma.semester.update({
    where: { id },
    data,
  })
  // Pass semester back to the caller.
  return semester
}

// Define deleteSemester for the steps below.
const deleteSemester = async (id: string): Promise<void> => {
  // Define semester for the steps below.
  const semester = await prisma.semester.findUnique({
    where: { id },
    include: { _count: { select: { Teams: true, Enrollments: true, Choices: true } } },
  })
  // Check whether !semester before running this branch.
  if (!semester) {
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error('Semester not found.')
  }
  // Define { Teams, Enrollments, Choices } for the steps below.
  const { Teams, Enrollments, Choices } = semester._count
  // Check whether Teams > 0 || Enrollments > 0 || Choices > 0 before running this branch.
  if (Teams > 0 || Enrollments > 0 || Choices > 0) {
    // Use [ Teams > 0 ? `${Teams} team(s)` : null, Enrollments > 0 ? `${Enrollments} enrollment(s)` : null, Ch to initialize parts.
    const parts = [
      Teams > 0 ? `${Teams} team(s)` : null,
      Enrollments > 0 ? `${Enrollments} enrollment(s)` : null,
      Choices > 0 ? `${Choices} choice(s)` : null,
    ].filter((p): p is string => p !== null)
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error(
      `Cannot delete semester: ${parts.join(', ')} still reference it. Remove them first.`
    )
  }
  await prisma.semester.delete({ where: { id } })
}

// Define semesterService for the steps below.
const semesterService = {
  getAllSemesters,
  getSemesterById,
  createSemester,
  updateSemester,
  deleteSemester,
}

export default semesterService
