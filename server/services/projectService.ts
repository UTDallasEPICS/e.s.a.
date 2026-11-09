import type {ProjectType, ProjectStatus} from "@@/prisma/generated/client";
import type {TeamCreate, TeamRead} from "#server/services/teamService";
import {MEMBERSHIP_INCLUDE} from "#server/services/membershipService";
import {prisma} from "#server/utils/prisma";

export interface ProjectRead {
  id: string;
  name: string;
  description: string;
  type: ProjectType;
  status: ProjectStatus;
  repoURL: string;
  skills: string;
  partnerId: string;
  Partner: {id: string; name: string};
  Teams: TeamRead[];
}

export interface ProjectCreate {
  name: string;
  description: string;
  type: ProjectType;
  status: ProjectStatus;
  repoURL: string;
  skills?: string;
  partnerId: string;
  Teams?: Omit<TeamCreate, 'projectId'>[];
}

export interface ProjectUpdate {
  name?: string;
  description?: string;
  type?: ProjectType;
  status?: ProjectStatus;
  repoURL?: string;
  skills?: string;
  partnerId?: string;
}

const getAllProjects = async (semesterId?: string): Promise<ProjectRead[]> => {
  const projects = await prisma.project.findMany({
    where: semesterId ? {Teams: {some: {semesterId}}} : undefined,
    orderBy: {name: 'asc'},
    include: {Partner: {select: {id: true, name: true}}, Teams: {include: {Memberships: {include: MEMBERSHIP_INCLUDE}, Semester: true}}},
  });
  return projects;
}

const getProjectById = async (id: string): Promise<ProjectRead | null> => {
  const project = await prisma.project.findUnique({
    where: {id},
    include: {Partner: {select: {id: true, name: true}}, Teams: {include: {Memberships: {include: MEMBERSHIP_INCLUDE}, Semester: true}}},
  })
  return project;
}

const createProject = async (data: ProjectCreate): Promise<ProjectRead> => {
  const {Teams, ...rest} = data;
  const project = await prisma.project.create({
    data: {
      ...rest,
      Teams: Teams ? {
        create: Teams.map(({Memberships, ...team}) => ({
          ...team,
          Memberships: Memberships ? {create: Memberships} : undefined,
        })),
      } : undefined,
    },
    include: {Partner: {select: {id: true, name: true}}, Teams: {include: {Memberships: {include: MEMBERSHIP_INCLUDE}, Semester: true}}},
  })
  return project;
}

const updateProject = async (id: string, data: ProjectUpdate): Promise<ProjectRead> => {
  const project = await prisma.project.update({
    where: {id},
    data,
    include: {Partner: {select: {id: true, name: true}}, Teams: {include: {Memberships: {include: MEMBERSHIP_INCLUDE}, Semester: true}}},
  });
  return project;
}

const deleteProject = async (id: string): Promise<void> => {
  await prisma.project.delete({where: {id}});
}

const projectService = {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
};

export default projectService;
