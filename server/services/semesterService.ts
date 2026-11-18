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

const getAllSemesters = async (): Promise<SemesterRead[]> => {
  const semesters = await prisma.semester.findMany({
    orderBy: [{ year: 'desc' }, { season: 'asc' }],
  })
  return semesters
}

const getSemesterById = async (id: string): Promise<SemesterRead | null> => {
  const semester = await prisma.semester.findUnique({
    where: { id: id },
  })
  return semester
}

const createSemester = async (data: SemesterCreate): Promise<SemesterRead> => {
  const semester = await prisma.semester.create({
    data,
  })
  return semester
}

const updateSemester = async (id: string, data: SemesterUpdate): Promise<SemesterRead> => {
  const semester = await prisma.semester.update({
    where: { id },
    data,
  })
  return semester
}

const deleteSemester = async (id: string): Promise<void> => {
  const semester = await prisma.semester.findUnique({
    where: { id },
    include: { _count: { select: { Teams: true, Enrollments: true, Choices: true } } },
  })
  if (!semester) {
    throw new Error('Semester not found.')
  }
  const { Teams, Enrollments, Choices } = semester._count
  if (Teams > 0 || Enrollments > 0 || Choices > 0) {
    const parts = [
      Teams > 0 ? `${Teams} team(s)` : null,
      Enrollments > 0 ? `${Enrollments} enrollment(s)` : null,
      Choices > 0 ? `${Choices} choice(s)` : null,
    ].filter((p): p is string => p !== null)
    throw new Error(
      `Cannot delete semester: ${parts.join(', ')} still reference it. Remove them first.`
    )
  }
  await prisma.semester.delete({ where: { id } })
}

const semesterService = {
  getAllSemesters,
  getSemesterById,
  createSemester,
  updateSemester,
  deleteSemester,
}

export default semesterService
