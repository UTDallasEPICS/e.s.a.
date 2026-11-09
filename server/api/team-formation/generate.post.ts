/**
 * POST /api/teams/generate
 * Runs the CPSAT (OR-Tools CP-SAT) algorithm server-side and returns team assignments.
 * Body: { semesterId: string }
 * Response: { teamAssignments: Record<projectId, StudentWithChoices[]>, projects: Project[] }
 */

import {generateTeamsORTools} from '#server/services/CPSAT/ortools'
import type {Student as CPSATStudent, Project as CPSATProject, Gender as CPSATGender} from '#server/services//CPSAT/ortools'
import type {CPSATConfig} from '#server/services//CPSAT/ortools'
import {Year, ProjectType, Choice, Project, Class, ProjectMeetingDay, Enrollment, Gender, Season} from '@@/prisma/generated/client'
import {prisma} from '#server/utils/prisma'

type MeetingDay = 'WEDNESDAY' | 'THURSDAY'

const mapYear = (year: Year): CPSATStudent['seniority'] => {
  const map: Record<Year, CPSATStudent['seniority']> = {
    FRESHMAN: 'Freshman',
    SOPHOMORE: 'Sophomore',
    JUNIOR: 'Junior',
    SENIOR: 'Senior',
  }
  return map[year]
}

const mapProjectType = (type: ProjectType): CPSATProject['type'] => {
  const map: Record<ProjectType, CPSATProject['type']> = {
    SOFTWARE: 'SW',
    HARDWARE: 'HW',
    BOTH: 'Both',
  }
  return map[type]
}

const mapGender = (gender: Gender): CPSATGender => {
  const map: Record<Gender, CPSATGender> = {
    MALE: 'Male',
    FEMALE: 'Female',
    OTHER: 'Prefer not to say',
  }
  return map[gender]
}

export default defineEventHandler(async (event) => {
  const {semesterId, day, config} = await readBody<{
    semesterId: string;
    day: MeetingDay;
    config?: CPSATConfig
  }>(event)

  if (!semesterId) {
    throw createError({statusCode: 400, message: 'semesterId is required.'})
  }

  if (day !== 'WEDNESDAY' && day !== 'THURSDAY') {
    throw createError({statusCode: 400, message: 'day is required and must be WEDNESDAY or THURSDAY.'})
  }

  interface StudentWithChoices {
    Choices: Choice[],
    Enrollments: Enrollment[],
    id: string,
    firstName: string,
    lastName: string,
    netID: string,
    email: string | null,
  }

  // Fetch non-mentor students enrolled in that semester and day with their choices
  const students = await prisma.student.findMany({
    where: {
      isMentor: false,
      Enrollments: {some: {semesterId, meetingDay: day}}
    },
    include: {
      Choices: {where: {semesterId}},
      Enrollments: {where: {semesterId}}
    }
  });


  // Fetch active projects for this semester (those with a team in this semester)
  const teamsForRun = await prisma.team.findMany({
    where: {
      semesterId,
      meetingDay: day,
    },
    include: {
      Project: true,
    },
  })
  const projects: Project[] = teamsForRun.map((team) => team.Project)
  const projectIdToDay = new Map<string, ProjectMeetingDay>(
      teamsForRun.map((team) => [team.projectId, team.meetingDay] as const)
  )

  // Students manually locked into a team ahead of this run (e.g. a 3200 student staff
  // already placed via the lock endpoint) are excluded from the solver entirely and
  // counted toward their team's size instead, so the solver only fills remaining seats.
  const lockedMemberships = await prisma.membership.findMany({
    where: {teamId: {in: teamsForRun.map((team) => team.id)}, isMentor: false, locked: true},
  })
  const lockedStudentIds = new Set(lockedMemberships.map((m) => m.studentId))
  const lockedCountByTeamId = new Map<string, number>()
  const lockedUpperclassCountByTeamId = new Map<string, number>()
  const studentIdToClass = new Map(students.map((s) => [s.id, s.Enrollments[0]?.class] as const))
  for (const m of lockedMemberships) {
    lockedCountByTeamId.set(m.teamId, (lockedCountByTeamId.get(m.teamId) ?? 0) + 1)
    if (studentIdToClass.get(m.studentId) === 'EPCS_3200') {
      lockedUpperclassCountByTeamId.set(m.teamId, (lockedUpperclassCountByTeamId.get(m.teamId) ?? 0) + 1)
    }
  }

  if (!students.length) {
    throw createError({statusCode: 400, message: 'No active students found.'})
  }
  if (!projects.length) {
    throw createError({statusCode: 400, message: 'No projects found for this semester. Activate projects first.'})
  }

  const projectIdToName = new Map<string, string>(projects.map((p: Project) => [p.id, p.name] as const))
  const projectIdToTeamId = new Map<string, string>(teamsForRun.map((team) => [team.projectId, team.id] as const))
  const mappedChoicesByStudentId = new Map<string, string[]>(
      students.map((s) => {
        const mapped = s.Choices
            .slice()
            .sort((a: Choice, b: Choice) => a.rank - b.rank)
            .map((c: Choice) => projectIdToName.get(c.projectId))
            .filter((name): name is string => !!name)
        return [s.id, mapped] as const
      })
  )

  const remapClass =
      (cls: Class) => cls == "EPCS_2200" ? "2200" : "3200";
  const remapDay =
      (day: ProjectMeetingDay) => day == "WEDNESDAY" ? "Wednesday" : "Thursday";

  // Determine each returning (3200) student's most recent prior-semester project,
  // for the returning-student bonus. Chronological ordering follows the same
  // year/season comparison pattern used elsewhere for semester recency.
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
    if (rank >= currentRank) continue // "previous" must be strictly earlier
    const bestSoFar = previousRankByStudentId.get(m.studentId)
    if (bestSoFar === undefined || rank > bestSoFar) {
      previousRankByStudentId.set(m.studentId, rank)
      previousProjectByStudentId.set(m.studentId, m.Team.Project.name)
    }
  }

  // Map Prisma students → CPSAT Student type, excluding anyone already locked into a team
  const cpsatStudents: CPSATStudent[] = students.filter((s) => !lockedStudentIds.has(s.id)).map((s) => {
    // CPSAT expects project NAMES in choices (not IDs).
    // Keep only choices that map to currently active semester projects; if none
    // remain, the solver still places the student (every student must be
    // assigned to exactly one project), just without a preference bonus.
    const choices = mappedChoicesByStudentId.get(s.id) ?? []
    const cls = remapClass(s.Enrollments[0]!.class)
    const priorProjectName = previousProjectByStudentId.get(s.id)
    // Constraint on the Python side requires returning students to be 3200-level,
    // and the bonus only ever applies when the previous project is also a current choice.
    const previousProject =
        cls === '3200' && priorProjectName && choices.includes(priorProjectName)
            ? priorProjectName
            : undefined

    return {
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
      major: (s.Enrollments[0]!.major as CPSATStudent['major']) ?? 'Other',
      seniority: mapYear(s.Enrollments[0]!.year),
      choices,
      choicesString: choices.join(','),
      class: cls,
      day: remapDay(s.Enrollments[0]!.meetingDay),
      gender: mapGender(s.Enrollments[0]!.gender),
      previousProject,
    }
  })

  // Map Prisma projects → CPSAT Project type
  const cpsatProjects: CPSATProject[] = projects.map((p: Project) => {
    const teamId = projectIdToTeamId.get(p.id)!
    return {
      id: p.id,
      name: p.name,
      type: mapProjectType(p.type),
      day: remapDay(projectIdToDay.get(p.id)!),
      lockedCount: lockedCountByTeamId.get(teamId) ?? 0,
      lockedUpperclassCount: lockedUpperclassCountByTeamId.get(teamId) ?? 0,
    }
  })

  // Run the CP-SAT algorithm (spawns a Python process)
  let cpsatResult
  try {
    ;({assignments: cpsatResult} = await generateTeamsORTools(cpsatStudents, cpsatProjects, config))
  } catch (err: any) {
    throw createError({statusCode: 400, message: err?.message ?? 'Team generation failed.'})
  }

  // cpsatResult keys are project names; convert back to projectId → StudentWithChoices[]
  const nameToId = new Map<string, string>(projects.map((p: Project) => [p.name, p.id] as const))
  const idToStudent = new Map<string, StudentWithChoices>(students.map((s: StudentWithChoices) => [s.id, s] as const))

  const assignmentsByProjectId: Record<string, StudentWithChoices[]> = Object.fromEntries(
      projects.map((p: Project) => [p.id, [] as StudentWithChoices[]])
  )
  for (const [projectName, cpsatStudentArr] of Object.entries(cpsatResult)) {
    const projectId = nameToId.get(projectName)
    if (projectId) {
      assignmentsByProjectId[projectId] = cpsatStudentArr
          .map((cs: CPSATStudent) => idToStudent.get(cs.id))
          .filter((s): s is StudentWithChoices => s !== undefined)
    }
  }

  // Persist only the newly solved (unlocked) assignments, replacing any prior generation's
  // unlocked assignments for this semester/day. Manually-locked memberships (see
  // lock.post.ts) already exist in the database and are left untouched here, as are
  // mentor memberships (assigned separately from this algorithm).
  const newMemberships = Object.entries(assignmentsByProjectId).flatMap(([pId, members]) => {
    return members.map(m => ({
      teamId: projectIdToTeamId.get(pId)!,
      studentId: m.id,
    }))
  })
  await prisma.$transaction([
    prisma.membership.deleteMany({
      where: {teamId: {in: teamsForRun.map((team) => team.id)}, isMentor: false, locked: false},
    }),
    prisma.membership.createMany({data: newMemberships}),
  ])

  // Add locked students back in so the response reflects the full roster (locked +
  // newly solved) even though their membership rows weren't part of the write above.
  for (const m of lockedMemberships) {
    const team = teamsForRun.find((t) => t.id === m.teamId)
    const student = idToStudent.get(m.studentId)
    if (team && student) {
      assignmentsByProjectId[team.projectId]!.push(student)
    }
  }

  const teamAssignments: Record<string, StudentWithChoices[]> = Object.fromEntries(
      Object.entries(assignmentsByProjectId)
          .map(([projectId, assignedStudents]) => {
            const teamId = projectIdToTeamId.get(projectId)
            return teamId ? ([teamId, assignedStudents] as const) : null
          })
          .filter((entry): entry is readonly [string, StudentWithChoices[]] => entry !== null)
  )

  const teamMeta: Record<string, {
    projectId: string;
    meetingDay: MeetingDay;
    projectName: string
  }> = Object.fromEntries(
      teamsForRun.map((team) => [team.id, {projectId: team.projectId, meetingDay: day, projectName: team.Project.name}])
  )

  return {teamAssignments, projects, teamMeta}
})
