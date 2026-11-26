/**
 * Purpose
 * Provide the membership service logic used by other parts of ESA.
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
import type { SemesterRead } from '#server/services/semesterService'
import type { ProjectMeetingDay } from '@@/prisma/generated/client'
import { prisma } from '#server/utils/prisma'

export interface MembershipStudentRead {
  id: string
  netID: string
  firstName: string
  lastName: string
  email: string | null
  isMentor: boolean
}

export interface MembershipTeamRead {
  id: string
  projectId: string
  semesterId: string
  meetingDay: ProjectMeetingDay
  Project: { id: string; name: string }
  Semester: SemesterRead
}

export interface MembershipRead {
  id: string
  teamId: string
  studentId: string
  isMentor: boolean
  Student: MembershipStudentRead
  Team: MembershipTeamRead
}

export interface MembershipCreate {
  teamId: string
  studentId: string
  isMentor?: boolean
}

// Define MEMBERSHIP_INCLUDE for the steps below.
export const MEMBERSHIP_INCLUDE = {
  Student: {
    select: { id: true, netID: true, firstName: true, lastName: true, email: true, isMentor: true },
  },
  Team: { include: { Project: { select: { id: true, name: true } }, Semester: true } },
} as const

// Define getMembershipById for the steps below.
const getMembershipById = async (id: string): Promise<MembershipRead | null> => {
  // Define membership for the steps below.
  const membership = await prisma.membership.findUnique({
    where: { id },
    include: MEMBERSHIP_INCLUDE,
  })
  // Pass membership back to the caller.
  return membership
}

// Define createMembership for the steps below.
const createMembership = async (data: MembershipCreate): Promise<MembershipRead> => {
  // Define membership for the steps below.
  const membership = await prisma.membership.create({
    data,
    include: MEMBERSHIP_INCLUDE,
  })
  // Pass membership back to the caller.
  return membership
}

// Define deleteMembership for the steps below.
const deleteMembership = async (id: string): Promise<void> => {
  await prisma.membership.delete({ where: { id } })
}

// Define membershipService for the steps below.
const membershipService = {
  getMembershipById,
  createMembership,
  deleteMembership,
}

export default membershipService
