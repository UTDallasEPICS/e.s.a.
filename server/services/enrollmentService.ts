import type {Gender, Year, Class, ProjectMeetingDay} from "@@/prisma/generated/client";
import {prisma} from "#server/utils/prisma";

export interface EnrollmentRead {
  id: string;
  studentId: string;
  semesterId: string;
  gender: Gender;
  major: string;
  year: Year;
  class: Class;
  meetingDay: ProjectMeetingDay;
  skills: string[];
  comments: string;
  noBid: boolean;
}

export interface EnrollmentCreate {
  studentId: string;
  semesterId: string;
  gender: Gender;
  major: string;
  year: Year;
  class: Class;
  meetingDay: ProjectMeetingDay;
  skills?: string[];
  comments?: string;
}

export interface EnrollmentUpdate {
  semesterId?: string;
  gender?: Gender;
  major?: string;
  year?: Year;
  class?: Class;
  meetingDay?: ProjectMeetingDay;
  skills?: string[];
  comments?: string;
}

export function serializeSkills(skills: string[] | undefined): string {
  return (skills ?? []).map((s) => s.trim()).filter(Boolean).join(', ')
}

export function deserializeSkills(skills: string): string[] {
  return skills.split(',').map((s) => s.trim()).filter(Boolean)
}

function toEnrollmentRead(row: {skills: string; [key: string]: any}): EnrollmentRead {
  return {...row, skills: deserializeSkills(row.skills)} as EnrollmentRead
}

const getEnrollmentById = async (id: string): Promise<EnrollmentRead | null> => {
  const enrollment = await prisma.enrollment.findUnique({
    where: {id},
  })
  return enrollment ? toEnrollmentRead(enrollment) : null;
}

const createEnrollment = async (data: EnrollmentCreate): Promise<EnrollmentRead> => {
  const enrollment = await prisma.enrollment.create({
    data: {...data, skills: serializeSkills(data.skills)},
  })
  return toEnrollmentRead(enrollment);
}

const updateEnrollment = async (id: string, data: EnrollmentUpdate): Promise<EnrollmentRead> => {
  const enrollment = await prisma.enrollment.update({
    where: {id},
    data: {...data, skills: data.skills !== undefined ? serializeSkills(data.skills) : undefined},
  });
  return toEnrollmentRead(enrollment);
}

const deleteEnrollment = async (id: string): Promise<void> => {
  await prisma.enrollment.delete({where: {id}});
}

const enrollmentService = {
  getEnrollmentById,
  createEnrollment,
  updateEnrollment,
  deleteEnrollment,
};

export default enrollmentService;
