/**
 * GET /api/team-formation/versions?semesterId=…&meetingDay=WEDNESDAY|THURSDAY
 * The saved versions of that day's teams, newest first, and the number the board
 * is working on.
 */

import { ProjectMeetingDay } from '@@/prisma/generated/client'
import teamVersionService from '#server/services/teamVersionService'

export default defineEventHandler(async (event) => {
  const { semesterId, meetingDay } = getQuery(event)
  if (typeof semesterId !== 'string' || !semesterId) {
    throw createError({ statusCode: 400, message: 'semesterId is required.' })
  }
  if (meetingDay !== ProjectMeetingDay.WEDNESDAY && meetingDay !== ProjectMeetingDay.THURSDAY) {
    throw createError({ statusCode: 400, message: 'Expected a meeting day (Wednesday/Thursday)' })
  }
  return teamVersionService.listVersions(semesterId, meetingDay)
})
