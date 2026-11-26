/**
 * Purpose
 * Provide the user service logic used by other parts of ESA.
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
import type { Role } from '@@/prisma/generated/client'
import { prisma } from '#server/utils/prisma'

export interface UserRead {
  id: string
  email: string
  name: string
  emailVerified: boolean
  image: boolean
  role: Role
  active: boolean
}

export interface UserUpdate {
  active?: boolean
  role?: Role
}

// Define USER_SELECT for the steps below.
const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  emailVerified: true,
  image: true,
  role: true,
  active: true,
} as const

// Define the helper that will to user read.
function toUserRead(user: {
  id: string
  email: string
  name: string
  emailVerified: boolean
  image: string | null
  role: Role
  active: boolean
}): UserRead {
  // Pass { ...user, image: user.image != null } back to the caller.
  return { ...user, image: user.image != null }
}

// Define getAllUsers for the steps below.
const getAllUsers = async (): Promise<UserRead[]> => {
  // Define users for the steps below.
  const users = await prisma.user.findMany({ select: USER_SELECT })
  // Pass users.map(toUserRead) back to the caller.
  return users.map(toUserRead)
}

// Enforces: an admin can't deactivate their own account, a role change only applies to an
// active user, and an admin can't demote themselves unless another admin exists.
const updateUser = async (id: string, requesterId: string, data: UserUpdate): Promise<UserRead> => {
  // Define target for the steps below.
  const target = await prisma.user.findUnique({ where: { id } })
  // Check whether !target before running this branch.
  if (!target) {
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error('User not found.')
  }

  // Check whether data.active === false && id === requesterId before running this branch.
  if (data.active === false && id === requesterId) {
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error('You cannot deactivate your own account.')
  }

  // Check whether data.role !== undefined before running this branch.
  if (data.role !== undefined) {
    // Define willBeActive for the steps below.
    const willBeActive = data.active ?? target.active
    // Check whether !willBeActive before running this branch.
    if (!willBeActive) {
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('Only active users can have their role changed.')
    }
    // Check whether data.role === 'USER' && id === requesterId before running this branch.
    if (data.role === 'USER' && id === requesterId) {
      // Define otherAdmins for the steps below.
      const otherAdmins = await prisma.user.count({ where: { role: 'ADMIN', id: { not: id } } })
      // Check whether otherAdmins === 0 before running this branch.
      if (otherAdmins === 0) {
        // Stop this operation and tell the caller why it cannot continue.
        throw new Error('You cannot demote yourself while you are the only admin.')
      }
    }
  }

  // Define updated for the steps below.
  const updated = await prisma.user.update({ where: { id }, data, select: USER_SELECT })
  // Pass toUserRead(updated) back to the caller.
  return toUserRead(updated)
}

// Only inactive users may be deleted, so an admin never deletes a live account by mistake.
const deleteUser = async (id: string): Promise<void> => {
  // Define target for the steps below.
  const target = await prisma.user.findUnique({ where: { id } })
  // Check whether !target before running this branch.
  if (!target) {
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error('User not found.')
  }
  // Check whether target.active before running this branch.
  if (target.active) {
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error('Only inactive users can be deleted.')
  }
  await prisma.user.delete({ where: { id } })
}

// Define userService for the steps below.
const userService = {
  getAllUsers,
  updateUser,
  deleteUser,
}

export default userService
