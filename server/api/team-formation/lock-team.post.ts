/**
 * POST /api/team-formation/lock-team
 * Bulk-locks (or unlocks) every current non-mentor member of a team at once — for
 * staff who are satisfied with a whole team's roster and want to re-run Team
 * Generation only on the rest. Reuses the same `locked` flag as individual student
 * locking, so generate.post.ts needs no changes to respect this.
 * Body: { teamId: string, locked: boolean }
 */

import {prisma} from '#server/utils/prisma'

export default defineEventHandler(async (event) => {
  const {teamId, locked} = await readBody<{teamId: string; locked: boolean}>(event)

  if (!teamId) {
    throw createError({statusCode: 400, message: 'teamId is required.'})
  }
  if (typeof locked !== 'boolean') {
    throw createError({statusCode: 400, message: 'locked must be a boolean.'})
  }

  const team = await prisma.team.findUnique({where: {id: teamId}})
  if (!team) {
    throw createError({statusCode: 404, message: 'Team not found.'})
  }

  const result = await prisma.membership.updateMany({
    where: {teamId, isMentor: false},
    data: {locked},
  })

  return {updated: result.count}
})
