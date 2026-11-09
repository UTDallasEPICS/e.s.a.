import type {Season} from '@@/prisma/generated/client'
import {prisma} from '#server/utils/prisma'

const SEASON_ORDER: Record<Season, number> = {SPRING: 0, SUMMER: 1, FALL: 2}
const semesterRank = (s: {year: number; season: Season}) => s.year * 10 + SEASON_ORDER[s.season]

export interface PriorExperience {
  priorSemesters: number
  prior3200Semesters: number
}

// How many semesters each student was enrolled before this one, and how many of those
// were in 3200. Used by the builder to break ties between students who want the same
// project (a second-time 3200 wins, then more semesters).
export async function getPriorExperience(studentIds: string[], semesterId: string) {
  const current = await prisma.semester.findUniqueOrThrow({where: {id: semesterId}})
  const currentRank = semesterRank(current)
  const enrollments = await prisma.enrollment.findMany({
    where: {studentId: {in: studentIds}, semesterId: {not: semesterId}},
    include: {Semester: true},
  })
  const byStudentId = new Map<string, PriorExperience>()
  for (const e of enrollments) {
    if (semesterRank(e.Semester) >= currentRank) continue
    const prior = byStudentId.get(e.studentId) ?? {priorSemesters: 0, prior3200Semesters: 0}
    prior.priorSemesters++
    if (e.class === 'EPCS_3200') prior.prior3200Semesters++
    byStudentId.set(e.studentId, prior)
  }
  return byStudentId
}
