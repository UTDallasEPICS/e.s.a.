/**
 * Purpose
 * Provide the choice service logic used by other parts of ESA.
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
import { prisma } from '#server/utils/prisma'

export interface ChoiceRead {
  id: string
  rank: number
  studentId: string
  projectId: string
  semesterId: string
}

export interface ChoiceCreate {
  rank: number
  studentId: string
  projectId: string
  semesterId: string
}

export interface ChoiceUpdate {
  rank?: number
  semesterId?: string
}

// Define getChoiceById for the steps below.
const getChoiceById = async (id: string): Promise<ChoiceRead | null> => {
  // Define choice for the steps below.
  const choice = await prisma.choice.findUnique({
    where: { id },
  })
  // Pass choice back to the caller.
  return choice
}

// Define createChoice for the steps below.
const createChoice = async (data: ChoiceCreate): Promise<ChoiceRead> => {
  // Define choice for the steps below.
  const choice = await prisma.choice.create({
    data,
  })
  // Pass choice back to the caller.
  return choice
}

// Define updateChoice for the steps below.
const updateChoice = async (id: string, data: ChoiceUpdate): Promise<ChoiceRead> => {
  // Check whether data.rank == null before running this branch.
  if (data.rank == null) {
    // Define choice for the steps below.
    const choice = await prisma.choice.update({
      where: { id },
      data,
    })
    // Pass choice back to the caller.
    return choice
  }
  // Pass await prisma.$transaction(async (tx) => { const existingChoice = await tx.choice.findUniqueOrThrow({ back to the caller.
  return await prisma.$transaction(async (tx) => {
    // Define existingChoice for the steps below.
    const existingChoice = await tx.choice.findUniqueOrThrow({ where: { id } })
    // Check whether existingChoice.rank === data.rank before running this branch.
    if (existingChoice.rank === data.rank) {
      // Pass await tx.choice.update({ where: { id }, data, }) back to the caller.
      return await tx.choice.update({
        where: { id },
        data,
      })
    } else {
      // Shove other choices up or down to make room for the new rank. Rank has a unique
      // constraint per student+semester, so the siblings must be shifted one at a time, each
      // moving into a slot already vacated by the previous step — a single updateMany would
      // try to write into a slot still occupied by an unmoved row and violate the constraint.
      const movingDown = existingChoice.rank < data.rank!
      // Define rankFilter for the steps below.
      const rankFilter = movingDown
        ? { gt: existingChoice.rank, lte: data.rank! }
        : { lt: existingChoice.rank, gte: data.rank! }

      // Define siblings for the steps below.
      const siblings = await tx.choice.findMany({
        where: {
          studentId: existingChoice.studentId,
          semesterId: existingChoice.semesterId,
          rank: rankFilter,
        },
        orderBy: { rank: movingDown ? 'asc' : 'desc' },
      })

      // Vacate the moving choice's slot first so the shift below never collides with it.
      await tx.choice.update({ where: { id }, data: { rank: -1 } })
      // Repeat the following steps for each item in siblings.
      for (const sibling of siblings) {
        await tx.choice.update({
          where: { id: sibling.id },
          data: { rank: sibling.rank + (movingDown ? -1 : 1) },
        })
      }
      // Pass await tx.choice.update({ where: { id }, data }) back to the caller.
      return await tx.choice.update({ where: { id }, data })
    }
  })
}

// Define deleteChoice for the steps below.
const deleteChoice = async (id: string): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    // Define existingChoice for the steps below.
    const existingChoice = await tx.choice.findUniqueOrThrow({ where: { id } })
    // Delete first to vacate this rank, then shift the remaining choices down one at a time
    // (lowest rank first) so each moves into a slot already freed by the previous step.
    await tx.choice.delete({ where: { id } })
    // Define siblings for the steps below.
    const siblings = await tx.choice.findMany({
      where: {
        studentId: existingChoice.studentId,
        semesterId: existingChoice.semesterId,
        rank: { gt: existingChoice.rank },
      },
      orderBy: { rank: 'asc' },
    })
    // Repeat the following steps for each item in siblings.
    for (const sibling of siblings) {
      await tx.choice.update({ where: { id: sibling.id }, data: { rank: sibling.rank - 1 } })
    }
  })
}

// Define choiceService for the steps below.
const choiceService = {
  getChoiceById,
  createChoice,
  updateChoice,
  deleteChoice,
}

export default choiceService
