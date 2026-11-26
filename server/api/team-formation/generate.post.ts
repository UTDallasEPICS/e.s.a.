/**
 * Purpose
 * Handle requests for the generate API operation.
 *
 * Inputs
 * - Request parameters, body, and any session required by the handler.
 *
 * Outputs
 * - The operation’s response or an error with an HTTP status.
 *
 * Pseudocode
 * Read the request → apply the handler’s checks → call the matching operation → return its result.
 */
/**
 * POST /api/teams/generate
 * Runs the CPSAT (OR-Tools CP-SAT) algorithm server-side and returns team assignments.
 * Body: { semesterId: string }
 * Response: { teamAssignments: Record<projectId, StudentWithChoices[]>, projects: Project[] }
 */

import { generateTeamsORTools } from '#server/services/CPSAT/ortools'
import type {
  Student as CPSATStudent,
  Project as CPSATProject,
  Gender as CPSATGender,
} from '#server/services//CPSAT/ortools'
import type { CPSATConfig } from '#server/services//CPSAT/ortools'
import {
  Year,
  ProjectType,
  Choice,
  Project,
  Class,
  ProjectMeetingDay,
  Enrollment,
  Gender,
  Season,
} from '@@/prisma/generated/client'
import { prisma } from '#server/utils/prisma'

type MeetingDay = 'WEDNESDAY' | 'THURSDAY'

// Define mapYear for the steps below.
const mapYear = (year: Year): CPSATStudent['seniority'] => {
  // Define map for the steps below.
  const map: Record<Year, CPSATStudent['seniority']> = {
    FRESHMAN: 'Freshman',
    SOPHOMORE: 'Sophomore',
    JUNIOR: 'Junior',
    SENIOR: 'Senior',
  }
  // Pass map[year] back to the caller.
  return map[year]
}

// Define mapProjectType for the steps below.
const mapProjectType = (type: ProjectType): CPSATProject['type'] => {
  // Define map for the steps below.
  const map: Record<ProjectType, CPSATProject['type']> = {
    SOFTWARE: 'SW',
    HARDWARE: 'HW',
    BOTH: 'Both',
  }
  // Pass map[type] back to the caller.
  return map[type]
}

// Define mapGender for the steps below.
const mapGender = (gender: Gender): CPSATGender => {
  // Define map for the steps below.
  const map: Record<Gender, CPSATGender> = {
    MALE: 'Male',
    FEMALE: 'Female',
    OTHER: 'Prefer not to say',
  }
  // Pass map[gender] back to the caller.
  return map[gender]
}

export default defineEventHandler(async (event) => {
  // Define { semesterId, day, config } for the steps below.
  const { semesterId, day, config } = await readBody<{
    semesterId: string
    day: MeetingDay
    config?: CPSATConfig
  }>(event)

  // Check whether !semesterId before running this branch.
  if (!semesterId) {
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({ statusCode: 400, message: 'semesterId is required.' })
  }

  // Check whether day !== 'WEDNESDAY' && day !== 'THURSDAY' before running this branch.
  if (day !== 'WEDNESDAY' && day !== 'THURSDAY') {
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({
      statusCode: 400,
      message: 'day is required and must be WEDNESDAY or THURSDAY.',
    })
  }

  interface StudentWithChoices {
    Choices: Choice[]
    Enrollments: Enrollment[]
    id: string
    firstName: string
    lastName: string
    netID: string
    email: string | null
  }

  // Fetch non-mentor students enrolled in that semester and day with their choices
  const students = await prisma.student.findMany({
    where: {
      isMentor: false,
      Enrollments: { some: { semesterId, meetingDay: day } },
    },
    include: {
      Choices: { where: { semesterId } },
      Enrollments: { where: { semesterId } },
    },
  })

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
  // Use teamsForRun.map to initialize projects.
  const projects: Project[] = teamsForRun.map((team) => team.Project)
  // Define projectIdToDay for the steps below.
  const projectIdToDay = new Map<string, ProjectMeetingDay>(
    teamsForRun.map((team) => [team.projectId, team.meetingDay] as const)
  )

  // Check whether !students.length before running this branch.
  if (!students.length) {
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({ statusCode: 400, message: 'No active students found.' })
  }
  // Check whether !projects.length before running this branch.
  if (!projects.length) {
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({
      statusCode: 400,
      message: 'No projects found for this semester. Activate projects first.',
    })
  }

  // Define projectIdToName for the steps below.
  const projectIdToName = new Map<string, string>(
    projects.map((p: Project) => [p.id, p.name] as const)
  )
  // Define projectIdToTeamId for the steps below.
  const projectIdToTeamId = new Map<string, string>(
    teamsForRun.map((team) => [team.projectId, team.id] as const)
  )
  // Define mappedChoicesByStudentId for the steps below.
  const mappedChoicesByStudentId = new Map<string, string[]>(
    students.map((s) => {
      // Use s.Choices.slice() .sort((a: Choice, b: Choice) => a.rank - b.rank) .map((c: Choice) => projectIdToNa to initialize mapped.
      const mapped = s.Choices.slice()
        .sort((a: Choice, b: Choice) => a.rank - b.rank)
        .map((c: Choice) => projectIdToName.get(c.projectId))
        .filter((name): name is string => !!name)
      // Pass [s.id, mapped] as const back to the caller.
      return [s.id, mapped] as const
    })
  )

  // Define remapClass for the steps below.
  const remapClass = (cls: Class) => (cls == 'EPCS_2200' ? '2200' : '3200')
  // Define remapDay for the steps below.
  const remapDay = (day: ProjectMeetingDay) => (day == 'WEDNESDAY' ? 'Wednesday' : 'Thursday')

  // Determine each returning (3200) student's most recent prior-semester project,
  // for the returning-student bonus. Chronological ordering follows the same
  // year/season comparison pattern used elsewhere for semester recency.
  const currentSemester = await prisma.semester.findUniqueOrThrow({ where: { id: semesterId } })
  // Define SEASON_ORDER for the steps below.
  const SEASON_ORDER: Record<Season, number> = { SPRING: 0, SUMMER: 1, FALL: 2 }
  // Define semesterRank for the steps below.
  const semesterRank = (s: { year: number; season: Season }) => s.year * 10 + SEASON_ORDER[s.season]
  // Use semesterRank to initialize currentRank.
  const currentRank = semesterRank(currentSemester)

  // Define priorMemberships for the steps below.
  const priorMemberships = await prisma.membership.findMany({
    where: {
      studentId: { in: students.map((s) => s.id) },
      isMentor: false,
      Team: { Semester: { id: { not: semesterId } } },
    },
    include: { Team: { include: { Project: true, Semester: true } } },
  })

  // Define previousProjectByStudentId for the steps below.
  const previousProjectByStudentId = new Map<string, string>()
  // Define previousRankByStudentId for the steps below.
  const previousRankByStudentId = new Map<string, number>()
  // Repeat the following steps for each item in priorMemberships.
  for (const m of priorMemberships) {
    // Use semesterRank to initialize rank.
    const rank = semesterRank(m.Team.Semester)
    // Check whether rank >= currentRank before running this branch.
    if (rank >= currentRank) continue // "previous" must be strictly earlier
    // Use previousRankByStudentId.get to initialize bestSoFar.
    const bestSoFar = previousRankByStudentId.get(m.studentId)
    // Check whether bestSoFar === undefined || rank > bestSoFar before running this branch.
    if (bestSoFar === undefined || rank > bestSoFar) {
      // Call previousRankByStudentId.set to run this step.
      previousRankByStudentId.set(m.studentId, rank)
      // Call previousProjectByStudentId.set to run this step.
      previousProjectByStudentId.set(m.studentId, m.Team.Project.name)
    }
  }

  // Map Prisma students → CPSAT Student type
  const cpsatStudents: CPSATStudent[] = students.map((s) => {
    // CPSAT expects project NAMES in choices (not IDs).
    // Keep only choices that map to currently active semester projects; if none
    // remain, the solver still places the student (every student must be
    // assigned to exactly one project), just without a preference bonus.
    const choices = mappedChoicesByStudentId.get(s.id) ?? []
    // Use remapClass to initialize cls.
    const cls = remapClass(s.Enrollments[0]!.class)
    // Use previousProjectByStudentId.get to initialize priorProjectName.
    const priorProjectName = previousProjectByStudentId.get(s.id)
    // Constraint on the Python side requires returning students to be 3200-level,
    // and the bonus only ever applies when the previous project is also a current choice.
    const previousProject =
      cls === '3200' && priorProjectName && choices.includes(priorProjectName)
        ? priorProjectName
        : undefined

    // Pass { id: s.id, name: `${s.firstName} ${s.lastName}`, major: (s.Enrollments[0]!.major as CPSATStudent['m back to the caller.
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
  const cpsatProjects: CPSATProject[] = projects.map((p: Project) => ({
    id: p.id,
    name: p.name,
    type: mapProjectType(p.type),
    day: remapDay(projectIdToDay.get(p.id)!),
  }))

  // Run the CP-SAT algorithm (spawns a Python process)
  let cpsatResult
  try {
    ;({ assignments: cpsatResult } = await generateTeamsORTools(
      cpsatStudents,
      cpsatProjects,
      config
    ))
  } catch (err: any) {
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({ statusCode: 400, message: err?.message ?? 'Team generation failed.' })
  }

  // cpsatResult keys are project names; convert back to projectId → StudentWithChoices[]
  const nameToId = new Map<string, string>(projects.map((p: Project) => [p.name, p.id] as const))
  // Define idToStudent for the steps below.
  const idToStudent = new Map<string, StudentWithChoices>(
    students.map((s: StudentWithChoices) => [s.id, s] as const)
  )

  // Use Object.fromEntries to initialize assignmentsByProjectId.
  const assignmentsByProjectId: Record<string, StudentWithChoices[]> = Object.fromEntries(
    projects.map((p: Project) => [p.id, [] as StudentWithChoices[]])
  )
  // Repeat the following steps for each item in Object.entries(cpsatResult).
  for (const [projectName, cpsatStudentArr] of Object.entries(cpsatResult)) {
    // Use nameToId.get to initialize projectId.
    const projectId = nameToId.get(projectName)
    // Check whether projectId before running this branch.
    if (projectId) {
      // Update assignmentsByProjectId[projectId] with the value on the right.
      assignmentsByProjectId[projectId] = cpsatStudentArr
        .map((cs: CPSATStudent) => idToStudent.get(cs.id))
        .filter((s): s is StudentWithChoices => s !== undefined)
    }
  }

  // Persist student assignments to the database, replacing any prior generation's
  // assignments for this semester/day. Mentor memberships (assigned separately from
  // this algorithm) are left untouched.
  const memberships = Object.entries(assignmentsByProjectId).flatMap(([pId, members]) => {
    // Pass members.map((m) => ({ teamId: projectIdToTeamId.get(pId)!, studentId: m.id, })) back to the caller.
    return members.map((m) => ({
      teamId: projectIdToTeamId.get(pId)!,
      studentId: m.id,
    }))
  })
  await prisma.$transaction([
    prisma.membership.deleteMany({
      where: { teamId: { in: teamsForRun.map((team) => team.id) }, isMentor: false },
    }),
    prisma.membership.createMany({ data: memberships }),
  ])

  // Use Object.fromEntries to initialize teamAssignments.
  const teamAssignments: Record<string, StudentWithChoices[]> = Object.fromEntries(
    Object.entries(assignmentsByProjectId)
      .map(([projectId, assignedStudents]) => {
        // Use projectIdToTeamId.get to initialize teamId.
        const teamId = projectIdToTeamId.get(projectId)
        // Pass teamId ? ([teamId, assignedStudents] as const) : null back to the caller.
        return teamId ? ([teamId, assignedStudents] as const) : null
      })
      .filter((entry): entry is readonly [string, StudentWithChoices[]] => entry !== null)
  )

  // Use Object.fromEntries to initialize teamMeta.
  const teamMeta: Record<
    string,
    {
      projectId: string
      meetingDay: MeetingDay
      projectName: string
    }
  > = Object.fromEntries(
    teamsForRun.map((team) => [
      team.id,
      { projectId: team.projectId, meetingDay: day, projectName: team.Project.name },
    ])
  )

  // Pass { teamAssignments, projects, teamMeta } back to the caller.
  return { teamAssignments, projects, teamMeta }
})
