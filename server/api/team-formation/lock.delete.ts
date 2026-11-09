/**
 * DELETE /api/team-formation/lock
 * Unlocks a locked membership. The student stays on the team as an ordinary unlocked
 * member, which the next Generate Teams run is free to re-solve. Deleting the row here
 * would pull solver-produced members (locked via Lock Team) off their team.
 * Body: { membershipId: string }
 */

import {prisma} from '#server/utils/prisma'

export default defineEventHandler(async (event) => {
  const {membershipId} = await readBody<{membershipId: string}>(event)

  if (!membershipId) {
    throw createError({statusCode: 400, message: 'membershipId is required.'})
  }

  const membership = await prisma.membership.findUnique({where: {id: membershipId}})
  if (!membership) {
    throw createError({statusCode: 404, message: 'Membership not found.'})
  }
  if (!membership.locked) {
    throw createError({statusCode: 400, message: 'This membership is not locked.'})
  }

  await prisma.membership.update({where: {id: membershipId}, data: {locked: false}})
  return {success: true}
})
