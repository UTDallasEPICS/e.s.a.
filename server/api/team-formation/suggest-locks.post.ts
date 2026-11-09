/**
 * POST /api/team-formation/suggest-locks
 * Suggests team placements for unlocked 3200 students ahead of the main solve —
 * guaranteeing each student their 1st or 2nd choice whenever possible, falling back
 * to 3rd choice only if capacity truly requires it. Does not write anything to the
 * database; staff reviews the suggestions and locks them in individually (or in bulk)
 * via lock.post.ts.
 * Body: { semesterId: string, day: 'WEDNESDAY' | 'THURSDAY' }
 */

import {suggestUpperclassPlacements} from '#server/services/CPSAT/ortools'
import type {Student as CPSATStudent, Project as CPSATProject} from '#server/services/CPSAT/ortools'
import {Choice, Project, ProjectMeetingDay, Season} from '@@/prisma/generated/client'
import {prisma} from '#server/utils/prisma'

type MeetingDay = 'WEDNESDAY' | 'THURSDAY'

export default defineEventHandler(async (event) => {
  const {semesterId, day, maxTeamSize, maxUpperclassPerProject} = await readBody<{
    semesterId: string;
    day: MeetingDay;
    maxTeamSize?: number;
    maxUpperclassPerProject?: number;
  }>(event)

  if (!semesterId) {
    throw createError({statusCode: 400, message: 'semesterId is required.'})
  }
  if (day !== 'WEDNESDAY' && day !== 'THURSDAY') {
    throw createError({statusCode: 400, message: 'day is required and must be WEDNESDAY or THURSDAY.'})
  }

  const teamsForRun = await prisma.team.findMany({
    where: {semesterId, meetingDay: day},
    include: {Project: true},
  })
  const projects: Project[] = teamsForRun.map((team) => team.Project)
  if (!projects.length) {
    throw createError({statusCode: 400, message: 'No projects found for this semester/day.'})
  }

  const lockedMemberships = await prisma.membership.findMany({
    where: {teamId: {in: teamsForRun.map((t) => t.id)}, isMentor: false, locked: true},
    include: {Student: {select: {Enrollments: {where: {semesterId}, select: {class: true}}}}},
  })
  const lockedStudentIds = new Set(lockedMemberships.map((m) => m.studentId))
  const lockedCountByTeamId = new Map<string, number>()
  const lockedUpperclassCountByTeamId = new Map<string, number>()
  for (const m of lockedMemberships) {
    lockedCountByTeamId.set(m.teamId, (lockedCountByTeamId.get(m.teamId) ?? 0) + 1)
    if (m.Student.Enrollments[0]?.class === 'EPCS_3200') {
      lockedUpperclassCountByTeamId.set(m.teamId, (lockedUpperclassCountByTeamId.get(m.teamId) ?? 0) + 1)
    }
  }

  // Only unlocked 3200 students enrolled for this semester/day.
  const students = await prisma.student.findMany({
    where: {
      isMentor: false,
      Enrollments: {some: {semesterId, meetingDay: day, class: 'EPCS_3200'}},
      id: {notIn: Array.from(lockedStudentIds)},
    },
    include: {
      Choices: {where: {semesterId}},
      Enrollments: {where: {semesterId}},
    },
  })

  if (!students.length) {
    return {placements: [], noChoicesStudentIds: [], usedFallbackThirdChoice: false}
  }

  const projectIdToName = new Map<string, string>(projects.map((p) => [p.id, p.name] as const))
  const nameToTeamId = new Map<string, string>(
    teamsForRun.map((t) => [t.Project.name, t.id] as const)
  )

  const mappedChoicesByStudentId = new Map<string, string[]>(
    students.map((s) => {
      const mapped = s.Choices.slice()
        .sort((a: Choice, b: Choice) => a.rank - b.rank)
        .map((c: Choice) => projectIdToName.get(c.projectId))
        .filter((name): name is string => !!name)
      return [s.id, mapped] as const
    })
  )

  // Same "most recent prior-semester project" logic as generate.post.ts, scoped to
  // just these students.
  const currentSemester = await prisma.semester.findUniqueOrThrow({where: {id: semesterId}})
  const SEASON_ORDER: Record<Season, number> = {SPRING: 0, SUMMER: 1, FALL: 2}
  const semesterRank = (s: {year: number; season: Season}) => s.year * 10 + SEASON_ORDER[s.season]
  const currentRank = semesterRank(currentSemester)

  const priorMemberships = await prisma.membership.findMany({
    where: {
      studentId: {in: students.map((s) => s.id)},
      isMentor: false,
      Team: {Semester: {id: {not: semesterId}}},
    },
    include: {Team: {include: {Project: true, Semester: true}}},
  })
  const previousProjectByStudentId = new Map<string, string>()
  const previousRankByStudentId = new Map<string, number>()
  for (const m of priorMemberships) {
    const rank = semesterRank(m.Team.Semester)
    if (rank >= currentRank) continue
    const bestSoFar = previousRankByStudentId.get(m.studentId)
    if (bestSoFar === undefined || rank > bestSoFar) {
      previousRankByStudentId.set(m.studentId, rank)
      previousProjectByStudentId.set(m.studentId, m.Team.Project.name)
    }
  }

  const cpsatStudents: CPSATStudent[] = students.map((s) => {
    const choices = mappedChoicesByStudentId.get(s.id) ?? []
    const priorProjectName = previousProjectByStudentId.get(s.id)
    const previousProject = priorProjectName && choices.includes(priorProjectName) ? priorProjectName : undefined
    return {
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
      major: 'Other',
      seniority: 'Junior',
      choices,
      choicesString: choices.join(','),
      class: '3200',
      gender: 'Prefer not to say',
      previousProject,
    }
  })

  const cpsatProjects: CPSATProject[] = teamsForRun.map((t) => ({
    id: t.Project.id,
    name: t.Project.name,
    type: 'Both',
    lockedCount: lockedCountByTeamId.get(t.id) ?? 0,
    lockedUpperclassCount: lockedUpperclassCountByTeamId.get(t.id) ?? 0,
  }))

  let result
  try {
    result = await suggestUpperclassPlacements(cpsatStudents, cpsatProjects, {
      max_team_size: maxTeamSize ?? 6,
      max_upperclass_per_project: maxUpperclassPerProject ?? 4,
    })
  } catch (err: any) {
    throw createError({statusCode: 400, message: err?.message ?? 'Could not compute 3200 placement suggestions.'})
  }

  const placements = (result.placements ?? []).map((p) => ({
    studentId: p.studentId,
    teamId: nameToTeamId.get(p.projectName)!,
    projectName: p.projectName,
    choiceRank: p.choiceRank,
    isReturning: p.isReturning,
  }))

  return {
    placements,
    noChoicesStudentIds: result.noChoicesStudentIds ?? [],
    usedFallbackThirdChoice: result.usedFallbackThirdChoice ?? false,
  }
})
