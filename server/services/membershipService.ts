import type {SemesterRead} from "#server/services/semesterService";
import type {ProjectMeetingDay} from "@@/prisma/generated/client";
import {prisma} from "#server/utils/prisma";

export interface MembershipStudentRead {
  id: string;
  netID: string;
  firstName: string;
  lastName: string;
  email: string | null;
  isMentor: boolean;
}

export interface MembershipTeamRead {
  id: string;
  projectId: string;
  semesterId: string;
  meetingDay: ProjectMeetingDay;
  Project: {id: string; name: string};
  Semester: SemesterRead;
}

export interface MembershipRead {
  id: string;
  teamId: string;
  studentId: string;
  isMentor: boolean;
  locked: boolean;
  Student: MembershipStudentRead;
  Team: MembershipTeamRead;
}

export interface MembershipCreate {
  teamId: string;
  studentId: string;
  isMentor?: boolean;
  locked?: boolean;
}

export const MEMBERSHIP_INCLUDE = {
  Student: {select: {id: true, netID: true, firstName: true, lastName: true, email: true, isMentor: true}},
  Team: {include: {Project: {select: {id: true, name: true}}, Semester: true}},
} as const;

const getMembershipById = async (id: string): Promise<MembershipRead | null> => {
  const membership = await prisma.membership.findUnique({
    where: {id},
    include: MEMBERSHIP_INCLUDE,
  })
  return membership;
}

const createMembership = async (data: MembershipCreate): Promise<MembershipRead> => {
  const membership = await prisma.membership.create({
    data,
    include: MEMBERSHIP_INCLUDE,
  })
  return membership;
}

const deleteMembership = async (id: string): Promise<void> => {
  await prisma.membership.delete({where: {id}});
}

const membershipService = {
  getMembershipById,
  createMembership,
  deleteMembership,
};

export default membershipService;
