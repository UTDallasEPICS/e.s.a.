/**
 * Purpose
 * Provide the team service logic used by other parts of ESA.
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
import type { ProjectMeetingDay } from '@@/prisma/generated/client'
import type { MembershipCreate, MembershipRead } from '#server/services/membershipService'
import { MEMBERSHIP_INCLUDE } from '#server/services/membershipService'
import type { SemesterRead } from '#server/services/semesterService'
import { prisma } from '#server/utils/prisma'

export interface TeamRead {
  id: string
  projectId: string
  semesterId: string
  meetingDay: ProjectMeetingDay
  Memberships: MembershipRead[]
  Semester: SemesterRead
}

export interface TeamCreate {
  projectId: string
  semesterId: string
  meetingDay: ProjectMeetingDay
  Memberships?: Omit<MembershipCreate, 'teamId'>[]
}

export interface TeamUpdate {
  semesterId?: string
  meetingDay?: ProjectMeetingDay
}

// Define getTeamById for the steps below.
const getTeamById = async (id: string): Promise<TeamRead | null> => {
  // Define team for the steps below.
  const team = await prisma.team.findUnique({
    where: { id },
    include: { Memberships: { include: MEMBERSHIP_INCLUDE }, Semester: true },
  })
  // Pass team back to the caller.
  return team
}

// Define createTeam for the steps below.
const createTeam = async (data: TeamCreate): Promise<TeamRead> => {
  // Define { Memberships, ...rest } for the steps below.
  const { Memberships, ...rest } = data
  // Define team for the steps below.
  const team = await prisma.team.create({
    data: {
      ...rest,
      Memberships: Memberships ? { create: Memberships } : undefined,
    },
    include: { Memberships: { include: MEMBERSHIP_INCLUDE }, Semester: true },
  })
  // Pass team back to the caller.
  return team
}

// Define updateTeam for the steps below.
const updateTeam = async (id: string, data: TeamUpdate): Promise<TeamRead> => {
  // Define team for the steps below.
  const team = await prisma.team.update({
    where: { id },
    data,
    include: { Memberships: { include: MEMBERSHIP_INCLUDE }, Semester: true },
  })
  // Pass team back to the caller.
  return team
}

// Define deleteTeam for the steps below.
const deleteTeam = async (id: string): Promise<void> => {
  await prisma.team.delete({ where: { id } })
}

// Define teamService for the steps below.
const teamService = {
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
}

export default teamService
