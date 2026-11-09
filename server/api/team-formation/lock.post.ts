/**
 * POST /api/team-formation/lock
 * Places a student into a team, replacing any existing (unlocked) placement they have
 * this semester. Two uses share this endpoint:
 *   - Locking a 3200 student ahead of the main solve (locked: true, the default) — the
 *     solver leaves them alone and only solves for the remaining unlocked students.
 *   - Freely moving a student to a different team after results are already in
 *     (locked: false) — stays open to being changed again by hand or overwritten by
 *     the next Generate Teams run, exactly as flexible as an unassigned student.
 *   - Dragging a student between teams on the Team Board (replaceLocked: true) — the
 *     drag itself is the staff decision, so an existing locked placement is replaced
 *     too instead of requiring an unlock first.
 * Body: { teamId: string, studentId: string, locked?: boolean, replaceLocked?: boolean }
 */

import {prisma} from '#server/utils/prisma'
import {MEMBERSHIP_INCLUDE} from '#server/services/membershipService'

export default defineEventHandler(async (event) => {
  const {teamId, studentId, locked = true, replaceLocked = false} = await readBody<{
    teamId: string
    studentId: string
    locked?: boolean
    replaceLocked?: boolean
  }>(event)

  if (!teamId || !studentId) {
    throw createError({statusCode: 400, message: 'teamId and studentId are required.'})
  }
  if (typeof locked !== 'boolean' || typeof replaceLocked !== 'boolean') {
    throw createError({statusCode: 400, message: 'locked and replaceLocked must be booleans.'})
  }

  const team = await prisma.team.findUnique({where: {id: teamId}})
  if (!team) {
    throw createError({statusCode: 404, message: 'Team not found.'})
  }

  // Generation only solves (and only clears) memberships for students enrolled on the
  // team's day, so a placement on the wrong day would be duplicated by the next run.
  const enrollment = await prisma.enrollment.findFirst({
    where: {studentId, semesterId: team.semesterId, meetingDay: team.meetingDay},
  })
  if (!enrollment) {
    throw createError({
      statusCode: 400,
      message: "This student isn't enrolled for this team's semester and meeting day.",
    })
  }

  // Delete + create in one transaction so a failed create never loses the old placement.
  return prisma.$transaction(async (tx) => {
    // A student can only hold one non-mentor membership per semester — check across all
    // teams in that semester, not just this one, before locking them in.
    const existing = await tx.membership.findFirst({
      where: {studentId, isMentor: false, Team: {semesterId: team.semesterId}},
    })
    if (existing) {
      if (existing.locked && !replaceLocked) {
        throw createError({
          statusCode: 400,
          message: 'This student is already locked into a team this semester. Unlock it first.',
        })
      }
      // Not locked — just their placement from a previous Generate Teams run. Locking them
      // into a (possibly different) team now should simply replace that, not block on it.
      await tx.membership.delete({where: {id: existing.id}})
    }

    return tx.membership.create({
      data: {teamId, studentId, isMentor: false, locked},
      include: MEMBERSHIP_INCLUDE,
    })
  })
})
