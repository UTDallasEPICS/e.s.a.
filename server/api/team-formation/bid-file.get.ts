/**
 * GET /api/team-formation/bid-file?semesterId=…&meetingDay=WEDNESDAY|THURSDAY
 * The bid file last uploaded for that semester and day, as it came in, or null
 * if none was kept (files uploaded before bid files were saved aren't available).
 */

import { ProjectMeetingDay } from '@@/prisma/generated/client'
import bidFileService from '#server/services/bidFileService'

export default defineEventHandler(async (event) => {
  const { semesterId, meetingDay } = getQuery(event)
  if (typeof semesterId !== 'string' || !semesterId) {
    throw createError({ statusCode: 400, message: 'semesterId is required.' })
  }
  if (meetingDay !== ProjectMeetingDay.WEDNESDAY && meetingDay !== ProjectMeetingDay.THURSDAY) {
    throw createError({ statusCode: 400, message: 'Expected a meeting day (Wednesday/Thursday)' })
  }
  return bidFileService.getBidFile(semesterId, meetingDay)
})
