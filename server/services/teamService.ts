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

const getTeamById = async (id: string): Promise<TeamRead | null> => {
  const team = await prisma.team.findUnique({
    where: { id },
    include: { Memberships: { include: MEMBERSHIP_INCLUDE }, Semester: true },
  })
  return team
}

const createTeam = async (data: TeamCreate): Promise<TeamRead> => {
  const { Memberships, ...rest } = data
  const team = await prisma.team.create({
    data: {
      ...rest,
      Memberships: Memberships ? { create: Memberships } : undefined,
    },
    include: { Memberships: { include: MEMBERSHIP_INCLUDE }, Semester: true },
  })
  return team
}

const updateTeam = async (id: string, data: TeamUpdate): Promise<TeamRead> => {
  const team = await prisma.team.update({
    where: { id },
    data,
    include: { Memberships: { include: MEMBERSHIP_INCLUDE }, Semester: true },
  })
  return team
}

const deleteTeam = async (id: string): Promise<void> => {
  await prisma.team.delete({ where: { id } })
}

const teamService = {
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
}

export default teamService
