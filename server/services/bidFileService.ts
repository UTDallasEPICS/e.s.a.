import type { ProjectMeetingDay } from '@@/prisma/generated/client'
import { prisma } from '#server/utils/prisma'

// The bid file last uploaded for a semester and meeting day, as it came in.
export interface BidFileRead {
  fileName: string
  uploadedAt: Date
  /** Every column in the file, in the order it first appears. */
  columns: string[]
  rows: Record<string, string>[]
}

const getBidFile = async (
  semesterId: string,
  meetingDay: ProjectMeetingDay
): Promise<BidFileRead | null> => {
  const file = await prisma.bidFile.findUnique({
    where: { semesterId_meetingDay: { semesterId, meetingDay } },
  })
  if (!file) return null
  const rows: Record<string, string>[] = JSON.parse(file.rows)
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))]
  return { fileName: file.fileName, uploadedAt: file.updatedAt, columns, rows }
}

// Replaces the day's previous file, if any.
const saveBidFile = async (
  semesterId: string,
  meetingDay: ProjectMeetingDay,
  fileName: string,
  rows: Record<string, string>[]
): Promise<void> => {
  const data = { fileName, rows: JSON.stringify(rows) }
  await prisma.bidFile.upsert({
    where: { semesterId_meetingDay: { semesterId, meetingDay } },
    create: { semesterId, meetingDay, ...data },
    update: data,
  })
}

export default { getBidFile, saveBidFile }
