/**
 * Purpose
 * Provide the project service logic used by other parts of ESA.
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
import type { ProjectType, ProjectStatus } from '@@/prisma/generated/client'
import type { TeamCreate, TeamRead } from '#server/services/teamService'
import { MEMBERSHIP_INCLUDE } from '#server/services/membershipService'
import { prisma } from '#server/utils/prisma'

export interface ProjectRead {
  id: string
  name: string
  description: string
  type: ProjectType
  status: ProjectStatus
  repoURL: string
  partnerId: string
  Partner: { id: string; name: string }
  Teams: TeamRead[]
}

export interface ProjectCreate {
  name: string
  description: string
  type: ProjectType
  status: ProjectStatus
  repoURL: string
  partnerId: string
  Teams?: Omit<TeamCreate, 'projectId'>[]
}

export interface ProjectUpdate {
  name?: string
  description?: string
  type?: ProjectType
  status?: ProjectStatus
  repoURL?: string
  partnerId?: string
}

// Define getAllProjects for the steps below.
const getAllProjects = async (semesterId?: string): Promise<ProjectRead[]> => {
  // Define projects for the steps below.
  const projects = await prisma.project.findMany({
    where: semesterId ? { Teams: { some: { semesterId } } } : undefined,
    orderBy: { name: 'asc' },
    include: {
      Partner: { select: { id: true, name: true } },
      Teams: { include: { Memberships: { include: MEMBERSHIP_INCLUDE }, Semester: true } },
    },
  })
  // Pass projects back to the caller.
  return projects
}

// Define getProjectById for the steps below.
const getProjectById = async (id: string): Promise<ProjectRead | null> => {
  // Define project for the steps below.
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      Partner: { select: { id: true, name: true } },
      Teams: { include: { Memberships: { include: MEMBERSHIP_INCLUDE }, Semester: true } },
    },
  })
  // Pass project back to the caller.
  return project
}

// Define createProject for the steps below.
const createProject = async (data: ProjectCreate): Promise<ProjectRead> => {
  // Define { Teams, ...rest } for the steps below.
  const { Teams, ...rest } = data
  // Define project for the steps below.
  const project = await prisma.project.create({
    data: {
      ...rest,
      Teams: Teams
        ? {
            create: Teams.map(({ Memberships, ...team }) => ({
              ...team,
              Memberships: Memberships ? { create: Memberships } : undefined,
            })),
          }
        : undefined,
    },
    include: {
      Partner: { select: { id: true, name: true } },
      Teams: { include: { Memberships: { include: MEMBERSHIP_INCLUDE }, Semester: true } },
    },
  })
  // Pass project back to the caller.
  return project
}

// Define updateProject for the steps below.
const updateProject = async (id: string, data: ProjectUpdate): Promise<ProjectRead> => {
  // Define project for the steps below.
  const project = await prisma.project.update({
    where: { id },
    data,
    include: {
      Partner: { select: { id: true, name: true } },
      Teams: { include: { Memberships: { include: MEMBERSHIP_INCLUDE }, Semester: true } },
    },
  })
  // Pass project back to the caller.
  return project
}

// Define deleteProject for the steps below.
const deleteProject = async (id: string): Promise<void> => {
  await prisma.project.delete({ where: { id } })
}

// Define projectService for the steps below.
const projectService = {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
}

export default projectService
