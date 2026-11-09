/**
 * POST /api/bids
 * Imports a parsed UTDesign/EPICS bid-response CSV.
 *
 * Expected row shape (after PapaParse with header:true):
 *   row["Student Name"]  – either full name ("Last, First") OR first name only
 *   row[""]              – optional last-name column in older CSV layouts
 *   row["Student Email"] – email
 *   row["SSO ID"]        – netID (skip row if blank)
 *   row["Classification"]– Freshman | Sophomore | Junior | Senior
 *   row["Enrollment"]    – "EPCS 2200" | "EPCS 3200"
 *   row["School and Major"] – "Erik Jonsson … :::: Computer Science"
 *   row["Gender"]        – Male | Female | Non-binary | Prefer not to say
 *   row["Choice 1"] … row["Choice 6"] – "S26 - OrgName: ProjectTitle" (blank if none)
 */

import { Year, Class, Gender, ProjectMeetingDay } from '@@/prisma/generated/client'
import { prisma } from '#server/utils/prisma'
import projectService from '#server/services/projectService'
import partnerService from '#server/services/partnerService'
import teamService from '#server/services/teamService'
import bidFileService from '#server/services/bidFileService'
import {
  pickProjectForMajor,
  placeholderNetID,
  type PlacementCandidate,
} from '#server/utils/noBid'

// ── helpers ──────────────────────────────────────────────────────────────────

const YEAR_MAP: Record<string, Year> = {
  freshman: 'FRESHMAN',
  sophomore: 'SOPHOMORE',
  junior: 'JUNIOR',
  senior: 'SENIOR',
}

const MAJOR_MAP: Record<string, string> = {
  'computer science': 'CS',
  'software engineering': 'SE',
  'electrical engineering': 'EE',
  'mechanical engineering': 'ME',
  'biomedical engineering': 'BME',
  'data science': 'DS',
  'computer engineering': 'CE',
  'systems engineering': 'Systems',
}

function extractMajor(schoolAndMajor: string): string {
  const parts = schoolAndMajor.split('::::')
  const raw = (parts[1] ?? parts[0] ?? '').trim().toLowerCase()
  return MAJOR_MAP[raw] ?? parts[1]?.trim() ?? 'Other'
}

function extractClass(enrollment: string): 'EPCS_2200' | 'EPCS_3200' {
  const match = enrollment.match(/\d{4}/)
  const n = match?.[0]
  return n === '3200' ? 'EPCS_3200' : 'EPCS_2200'
}

function extractGender(gender: string): Gender {
  switch (gender.trim().toLowerCase()) {
    case 'male':
      return 'MALE'
    case 'female':
      return 'FEMALE'
    default:
      return 'OTHER'
  }
}

function parseStudentName(row: Record<string, any>): { firstName: string; lastName: string } {
  const rawName = String(
    row['Student Name'] ??
      row['Name'] ??
      row['Full Name'] ??
      row['Student'] ??
      row['student name'] ??
      row['name'] ??
      ''
  ).trim()
  const rawLastNameColumn = String(row[''] ?? '').trim()

  // New layout: full name is in a single column as "Last, First".
  if (rawName.includes(',')) {
    const [lastName = '', firstName = ''] = rawName.split(',').map((part) => part.trim())
    return {
      firstName,
      lastName,
    }
  }

  // Legacy layout: first name in the main name column and last name in empty-header column.
  if (rawLastNameColumn) {
    return {
      firstName: rawName,
      lastName: rawLastNameColumn,
    }
  }

  // Fallback: if no comma, treat final token as last name.
  const parts = rawName.split(/\s+/).filter(Boolean)
  if (parts.length <= 1) {
    return {
      firstName: rawName,
      lastName: '',
    }
  }

  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1]!,
  }
}

/** Strip semester prefixes like "S26 - ", "F25 - ", "SP24 TH - " then trim */
function stripSemesterPrefix(choice: string): string {
  return choice.replace(/^[SF]\d{2,4}(\s+\S+)?\s*-\s*/, '').trim()
}

function normalizeProjectText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeProjectKey(input: string): string {
  return normalizeProjectText(input).replace(/\s+/g, '')
}

function readFirstValue(row: Record<string, any>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key]
    if (value == null) continue

    const text = String(value).trim()
    if (text) return text
  }

  return ''
}

function readSkills(row: Record<string, string>): string[] {
  const skills = Object.entries(row)
    .filter(([key, _]) => key.toLowerCase().includes('skill'))
    .map(([_, value]) => value.toLowerCase())
  return skills
}

const COMMENTS_KEYS = ['Comments', 'comments', 'Comment', 'comment']

interface BidRecord {
  firstName: string
  lastName: string
  email?: string
  netID: string
  year: Year
  class: Class
  gender: Gender
  major: string
  choices: string[]
  skills: string[]
  comments: string
  noBid?: boolean
}

async function processBidRecord(
  semesterId: string,
  meetingDay: ProjectMeetingDay,
  record: BidRecord
): Promise<void> {
  // create student record
  const studentInfo = {
    firstName: record.firstName,
    lastName: record.lastName,
    email: record.email,
  }
  const student = await prisma.student.upsert({
    where: { netID: record.netID },
    update: studentInfo,
    create: { ...studentInfo, netID: record.netID },
  })
  // create enrollment record
  const enrollmentInfo = {
    meetingDay,
    gender: record.gender,
    major: record.major,
    year: record.year,
    class: record.class,
    skills: record.skills.join(', '),
    comments: record.comments,
    noBid: record.noBid ?? false,
  }
  await prisma.enrollment.upsert({
    where: { studentId_semesterId: { studentId: student.id, semesterId } },
    update: enrollmentInfo,
    create: { ...enrollmentInfo, studentId: student.id, semesterId },
  })
  // replace choices for student for that semester
  await prisma.choice.deleteMany({
    where: {
      studentId: student.id,
      semesterId,
    },
  })
  await prisma.choice.createMany({
    data: record.choices.map((choice, i) => ({
      studentId: student.id,
      semesterId,
      projectId: choice,
      rank: i + 1,
    })),
  })
}

export default defineEventHandler(async (event) => {
  const rows: any[] = await readBody(event)
  const semesterId = getQuery(event).semesterId as string
  const rawMeetingDay = getQuery(event).meetingDay
  const meetingDay =
    typeof rawMeetingDay === 'string' && rawMeetingDay.toUpperCase() === 'WEDNESDAY'
      ? 'WEDNESDAY'
      : typeof rawMeetingDay === 'string' && rawMeetingDay.toUpperCase() === 'THURSDAY'
        ? 'THURSDAY'
        : null
  if (!meetingDay) {
    throw createError({ statusCode: 400, message: 'Expected a meeting day (Wednesday/Thursday)' })
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    throw createError({ statusCode: 400, message: 'Expected a non-empty array of bid rows.' })
  }

  // Fetch all projects and partners once so we can match by name
  const allProjects = await projectService.getAllProjects()
  const allPartners = await partnerService.getAllPartners()

  // Build normalized name → id lookups for fast matching
  const projectLookup = new Map<string, string>(
    allProjects.map((p: { id: string; name: string }) => [normalizeProjectKey(p.name), p.id])
  )
  const partnerLookup = new Map<string, string>(
    allPartners.map((p: { id: string; name: string }) => [normalizeProjectKey(p.name), p.id])
  )

  const aliasLookup = new Map<string, string>([
    ['mlk', 'friends of mlk'],
    ['team formation', 'utdesign'],
    ['sci tech', 'sci tech discovery center'],
    ['center for children and fam', 'center for children and families'],
    ['the lab ms desiccant reuse', 'thelab ms'],
    ['mckinney library', 'mckinney public library'],
    ['tejiendo alianzas xuchil', 'tejiendo alianzas'],
  ])

  let partnersCreated = 0
  let projectsCreated = 0
  let teamsCreated = 0

  // Fuzzy match, falling back to auto-creating the Partner
  const getOrCreatePartnerId = async (orgNameRaw: string): Promise<string> => {
    const orgTextRaw = normalizeProjectText(orgNameRaw)
    const aliased = aliasLookup.get(orgTextRaw) ?? orgTextRaw
    const candidates = [orgTextRaw, aliased].map(normalizeProjectKey).filter(Boolean)

    for (const candidate of candidates) {
      if (partnerLookup.has(candidate)) return partnerLookup.get(candidate)!
    }
    for (const [name, id] of partnerLookup) {
      for (const candidate of candidates) {
        if (name.includes(candidate) || candidate.includes(name)) return id
      }
    }

    const partner = await partnerService.createPartner({
      name: orgNameRaw.trim() || 'Unknown Partner',
    })
    partnerLookup.set(normalizeProjectKey(orgNameRaw), partner.id)
    partnersCreated++
    return partner.id
  }

  // Ensure a Team exists for a resolved project in this semester/day, once per project per request
  const ensuredTeamProjectIds = new Set<string>()
  const ensureTeamForProject = async (projectId: string): Promise<void> => {
    if (ensuredTeamProjectIds.has(projectId)) return
    ensuredTeamProjectIds.add(projectId)
    const existing = await prisma.team.findUnique({
      where: { projectId_semesterId: { projectId, semesterId } },
    })
    if (!existing) {
      await teamService.createTeam({ projectId, semesterId, meetingDay })
      teamsCreated++
    }
  }

  // Fuzzy fallback: find or create the first project whose name matches
  const findOrCreateProjectId = async (choiceRaw: string): Promise<string | null> => {
    if (!choiceRaw?.trim()) return null
    const stripped = stripSemesterPrefix(choiceRaw)
    const [orgPartSource = stripped, projectPartSource = ''] = stripped
      .split(':')
      .map((p) => p.trim())
    const normalizedFull = normalizeProjectText(stripped)
    if (!normalizedFull) return null

    const orgPartRaw = normalizeProjectText(orgPartSource)
    const projectPartRaw = normalizeProjectText(projectPartSource)
    const orgPart = aliasLookup.get(orgPartRaw) ?? orgPartRaw
    const projectPart = aliasLookup.get(projectPartRaw) ?? projectPartRaw

    const candidates = [normalizedFull, orgPart, projectPart]
      .map((c) => normalizeProjectKey(c))
      .filter(Boolean)

    // Check existing projects first
    for (const candidate of candidates) {
      if (projectLookup.has(candidate)) return projectLookup.get(candidate)!
    }

    for (const [name, id] of projectLookup) {
      for (const candidate of candidates) {
        if (name.includes(candidate) || candidate.includes(name)) return id
      }
    }

    // Not found — auto-create the partner and project.
    const partnerId = await getOrCreatePartnerId(projectPartSource ? orgPartSource : stripped)
    const projectName = projectPartSource || stripped

    const project = await projectService.createProject({
      name: projectName,
      description: '',
      type: 'SOFTWARE',
      status: 'NEW',
      repoURL: '',
      partnerId,
    })
    projectLookup.set(normalizeProjectKey(projectName), project.id)
    projectsCreated++
    return project.id
  }

  let studentsImported = 0
  let choicesCreated = 0
  const skippedStudents: string[] = []

  // Students whose row produced no usable choice (no bid). They are placed after every
  // other row is read, so the teams their classmates bid on already exist.
  const noBidRecords: BidRecord[] = []
  // How many bidders have each project as Choice 1, so no-bid students can be spread out.
  const firstChoiceLoad = new Map<string, number>()
  // netIDs already written from a row with bids, so a blank duplicate row can't replace them.
  const importedNetIDs = new Set<string>()
  // Stand-in netIDs built from a name alone (no SSO ID, no email) seen in this upload.
  const nameOnlyNetIDs = new Set<string>()

  for (const row of rows) {
    // ── Build student record ─────────────────────────────────────────────────
    const { firstName, lastName } = parseStudentName(row)
    const email = readFirstValue(row, ['Student Email', 'student email', 'studentemail']) || null
    // A row with only a name and major has no SSO ID. Reuse the student already stored
    // under its email (Student.email is unique), else give it a stable stand-in netID.
    // Only a row with neither an SSO ID nor a name is skipped.
    let netID = readFirstValue(row, ['SSO ID', 'ssoid', 'netID', 'netid', 'id'])
    if (!netID && (firstName || lastName)) {
      const existing = email
        ? await prisma.student.findUnique({ where: { email }, select: { netID: true } })
        : null
      netID = existing?.netID ?? placeholderNetID(firstName, lastName, email)
      if (!email) {
        // Two such rows with the same name can't be told apart; skip the repeat rather
        // than overwrite the first student with it.
        if (nameOnlyNetIDs.has(netID)) {
          skippedStudents.push(`${firstName} ${lastName}`.trim() + ' (repeated name, no SSO ID or email)')
          continue
        }
        nameOnlyNetIDs.add(netID)
      }
    } else if (netID && email) {
      // A student first imported without an SSO ID sits under a stand-in netID with this
      // email. Give them their real netID so processBidRecord updates them instead of
      // failing on the unique email. (A stand-in without an email can't be matched.)
      const standIn = await prisma.student.findUnique({
        where: { email },
        select: { id: true, netID: true },
      })
      if (
        standIn?.netID.startsWith('nobid-') &&
        !(await prisma.student.findUnique({ where: { netID }, select: { id: true } }))
      ) {
        await prisma.student.update({ where: { id: standIn.id }, data: { netID } })
      }
    }
    if (!netID) {
      skippedStudents.push(
        readFirstValue(row, ['Student Name', 'student name', 'name', 'fullName']) || '(no name)'
      )
      continue
    }
    const yearRaw = readFirstValue(row, ['Classification', 'classification']).toLowerCase()
    const year: Year = YEAR_MAP[yearRaw] ?? 'FRESHMAN'
    const cls = extractClass(readFirstValue(row, ['Enrollment', 'enrollment']))
    const major = extractMajor(
      readFirstValue(row, ['School and Major', 'school and major', 'major'])
    )
    const gender = extractGender(readFirstValue(row, ['Gender', 'gender']))
    const skills = readSkills(row)
    const comments = readFirstValue(row, COMMENTS_KEYS)

    // ── Process choices ──────────────────────────────────────────────────────

    const chosenProjectIds: string[] = []

    const choiceKeys = [
      'Choice 1',
      'Choice 2',
      'Choice 3',
      'Choice 4',
      'Choice 5',
      'Choice 6',
      'choice1',
      'choice2',
      'choice3',
      'choice4',
      'choice5',
      'choice6',
    ]
    for (let i = 0; i < choiceKeys.length; i++) {
      const raw = readFirstValue(row, [choiceKeys[i]!])
      if (!raw) continue

      const projectId = await findOrCreateProjectId(raw)
      if (!projectId) continue
      await ensureTeamForProject(projectId)

      if (chosenProjectIds.includes(projectId)) continue
      chosenProjectIds.push(projectId)
    }

    const record = {
      firstName,
      lastName,
      netID,
      email: email ?? undefined,
      year,
      class: cls,
      gender,
      major,
      choices: chosenProjectIds,
      skills,
      comments,
    }

    // No bid: hold the record until every bidder has been read, then place it below.
    if (!chosenProjectIds.length) {
      noBidRecords.push(record)
      continue
    }

    await processBidRecord(semesterId, meetingDay, record)
    importedNetIDs.add(netID)
    studentsImported++
    choicesCreated += chosenProjectIds.length
    const firstChoice = chosenProjectIds[0]!
    firstChoiceLoad.set(firstChoice, (firstChoiceLoad.get(firstChoice) ?? 0) + 1)
  }

  // ── Place no-bid students ────────────────────────────────────────────────────
  // Each one goes on a project that fits their major, written in as their Choice 1 so the
  // solver (generate.post.ts) sees them as an ordinary bidder. Only teams for this
  // semester + meeting day are candidates, which also keeps the solver's day constraint happy.
  const noBidPlacements: { name: string; netID: string; major: string; projectName: string }[] = []
  const noBidUnplaced: string[] = []

  if (noBidRecords.length) {
    const teamsForDay = await prisma.team.findMany({
      where: { semesterId, meetingDay },
      include: { Project: true },
    })
    const candidates: PlacementCandidate[] = teamsForDay.map((t) => ({
      projectId: t.projectId,
      projectName: t.Project.name,
      type: t.Project.type,
      load: firstChoiceLoad.get(t.projectId) ?? 0,
    }))

    for (const record of noBidRecords) {
      // The same student also has a row with bids (or an earlier blank row) in this file.
      if (importedNetIDs.has(record.netID)) continue
      importedNetIDs.add(record.netID)

      const pick = pickProjectForMajor(record.major, candidates)
      const fullName = `${record.firstName} ${record.lastName}`.trim()

      await processBidRecord(semesterId, meetingDay, {
        ...record,
        choices: pick ? [pick.projectId] : [],
        noBid: true,
      })
      studentsImported++

      if (pick) {
        pick.load++
        choicesCreated++
        noBidPlacements.push({
          name: fullName,
          netID: record.netID,
          major: record.major,
          projectName: pick.projectName,
        })
      } else {
        // No team exists for this semester/day yet, so there is nothing to place them on.
        noBidUnplaced.push(fullName)
      }
    }
  }

  // Keep the file as uploaded (replacing the day's previous one) so staff can
  // open it on the Bid Files step and check it's the right form.
  const fileName = String(getQuery(event).fileName ?? '').trim() || 'bids.csv'
  await bidFileService.saveBidFile(semesterId, meetingDay, fileName, rows)

  return {
    studentsImported,
    choicesCreated,
    partnersCreated,
    projectsCreated,
    teamsCreated,
    skippedStudents,
    noBidPlacements,
    noBidUnplaced,
  }
})
