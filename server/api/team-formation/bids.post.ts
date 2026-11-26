/**
 * Purpose
 * Handle requests for the bids API operation.
 *
 * Inputs
 * - Request parameters, body, and any session required by the handler.
 *
 * Outputs
 * - The operation’s response or an error with an HTTP status.
 *
 * Pseudocode
 * Read the request → apply the handler’s checks → call the matching operation → return its result.
 */
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

// ── helpers ──────────────────────────────────────────────────────────────────

const YEAR_MAP: Record<string, Year> = {
  freshman: 'FRESHMAN',
  sophomore: 'SOPHOMORE',
  junior: 'JUNIOR',
  senior: 'SENIOR',
}

// Define MAJOR_MAP for the steps below.
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

// Define the helper that will extract major.
function extractMajor(schoolAndMajor: string): string {
  // Use schoolAndMajor.split to initialize parts.
  const parts = schoolAndMajor.split('::::')
  // Use (parts[1] ?? parts[0] ?? '').trim().toLowerCase to initialize raw.
  const raw = (parts[1] ?? parts[0] ?? '').trim().toLowerCase()
  // Pass MAJOR_MAP[raw] ?? parts[1]?.trim() ?? 'Other' back to the caller.
  return MAJOR_MAP[raw] ?? parts[1]?.trim() ?? 'Other'
}

// Define the helper that will extract class.
function extractClass(enrollment: string): 'EPCS_2200' | 'EPCS_3200' {
  // Use enrollment.match to initialize match.
  const match = enrollment.match(/\d{4}/)
  // Define n for the steps below.
  const n = match?.[0]
  // Pass n === '3200' ? 'EPCS_3200' : 'EPCS_2200' back to the caller.
  return n === '3200' ? 'EPCS_3200' : 'EPCS_2200'
}

// Define the helper that will extract gender.
function extractGender(gender: string): Gender {
  switch (gender.trim().toLowerCase()) {
    case 'male':
      // Pass 'MALE' back to the caller.
      return 'MALE'
    case 'female':
      // Pass 'FEMALE' back to the caller.
      return 'FEMALE'
    default:
      // Pass 'OTHER' back to the caller.
      return 'OTHER'
  }
}

// Define the helper that will parse student name.
function parseStudentName(row: Record<string, any>): { firstName: string; lastName: string } {
  // Use String( row['Student Name'] ?? row['Name'] ?? row['Full Name'] ?? row['Student'] ?? row['student nam to initialize rawName.
  const rawName = String(
    row['Student Name'] ??
      row['Name'] ??
      row['Full Name'] ??
      row['Student'] ??
      row['student name'] ??
      row['name'] ??
      ''
  ).trim()
  // Use String(row[''] ?? '').trim to initialize rawLastNameColumn.
  const rawLastNameColumn = String(row[''] ?? '').trim()

  // New layout: full name is in a single column as "Last, First".
  if (rawName.includes(',')) {
    // Use rawName.split(',').map to initialize [lastName = '', firstName = ''].
    const [lastName = '', firstName = ''] = rawName.split(',').map((part) => part.trim())
    // Pass { firstName, lastName, } back to the caller.
    return {
      firstName,
      lastName,
    }
  }

  // Legacy layout: first name in the main name column and last name in empty-header column.
  if (rawLastNameColumn) {
    // Pass { firstName: rawName, lastName: rawLastNameColumn, } back to the caller.
    return {
      firstName: rawName,
      lastName: rawLastNameColumn,
    }
  }

  // Fallback: if no comma, treat final token as last name.
  const parts = rawName.split(/\s+/).filter(Boolean)
  // Check whether parts.length <= 1 before running this branch.
  if (parts.length <= 1) {
    // Pass { firstName: rawName, lastName: '', } back to the caller.
    return {
      firstName: rawName,
      lastName: '',
    }
  }

  // Pass { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1]!, } back to the caller.
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1]!,
  }
}

/** Strip semester prefixes like "S26 - ", "F25 - ", "SP24 TH - " then trim */
function stripSemesterPrefix(choice: string): string {
  // Pass choice.replace(/^[SF]\d{2,4}(\s+\S+)?\s*-\s* /, '').trim() back to the caller.
  return choice.replace(/^[SF]\d{2,4}(\s+\S+)?\s*-\s*/, '').trim()
}

// Define the helper that will normalize project text.
function normalizeProjectText(input: string): string {
  // Pass input .toLowerCase() .replace(/[^a-z0-9\s]/g, ' ') .replace(/\s+/g, ' ') .trim() back to the caller.
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Define the helper that will normalize project key.
function normalizeProjectKey(input: string): string {
  // Pass normalizeProjectText(input).replace(/\s+/g, '') back to the caller.
  return normalizeProjectText(input).replace(/\s+/g, '')
}

// Define the helper that will read first value.
function readFirstValue(row: Record<string, any>, keys: string[]): string {
  // Repeat the following steps for each item in keys.
  for (const key of keys) {
    // Define value for the steps below.
    const value = row[key]
    // Check whether value == null before running this branch.
    if (value == null) continue

    // Use String(value).trim to initialize text.
    const text = String(value).trim()
    // Check whether text before running this branch.
    if (text) return text
  }

  // Pass '' back to the caller.
  return ''
}

// Define the helper that will read skills.
function readSkills(row: Record<string, string>): string[] {
  // Use Object.entries(row) .filter(([key, _]) => key.toLowerCase().includes('skill')) .map to initialize skills.
  const skills = Object.entries(row)
    .filter(([key, _]) => key.toLowerCase().includes('skill'))
    .map(([_, value]) => value.toLowerCase())
  // Pass skills back to the caller.
  return skills
}

// Define COMMENTS_KEYS for the steps below.
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
}

// Define the helper that will process bid record.
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
  // Define student for the steps below.
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
  // Define rows for the steps below.
  const rows: any[] = await readBody(event)
  // Define semesterId for the steps below.
  const semesterId = getQuery(event).semesterId as string
  // Define rawMeetingDay for the steps below.
  const rawMeetingDay = getQuery(event).meetingDay
  // Define meetingDay for the steps below.
  const meetingDay =
    typeof rawMeetingDay === 'string' && rawMeetingDay.toUpperCase() === 'WEDNESDAY'
      ? 'WEDNESDAY'
      : typeof rawMeetingDay === 'string' && rawMeetingDay.toUpperCase() === 'THURSDAY'
        ? 'THURSDAY'
        : null
  // Check whether !meetingDay before running this branch.
  if (!meetingDay) {
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({ statusCode: 400, message: 'Expected a meeting day (Wednesday/Thursday)' })
  }

  // Check whether !Array.isArray(rows) || rows.length === 0 before running this branch.
  if (!Array.isArray(rows) || rows.length === 0) {
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({ statusCode: 400, message: 'Expected a non-empty array of bid rows.' })
  }

  // Fetch all projects and partners once so we can match by name
  const allProjects = await projectService.getAllProjects()
  // Define allPartners for the steps below.
  const allPartners = await partnerService.getAllPartners()

  // Build normalized name → id lookups for fast matching
  const projectLookup = new Map<string, string>(
    allProjects.map((p: { id: string; name: string }) => [normalizeProjectKey(p.name), p.id])
  )
  // Define partnerLookup for the steps below.
  const partnerLookup = new Map<string, string>(
    allPartners.map((p: { id: string; name: string }) => [normalizeProjectKey(p.name), p.id])
  )

  // Define aliasLookup for the steps below.
  const aliasLookup = new Map<string, string>([
    ['mlk', 'friends of mlk'],
    ['team formation', 'utdesign'],
    ['sci tech', 'sci tech discovery center'],
    ['center for children and fam', 'center for children and families'],
    ['the lab ms desiccant reuse', 'thelab ms'],
    ['mckinney library', 'mckinney public library'],
    ['tejiendo alianzas xuchil', 'tejiendo alianzas'],
  ])

  // Define partnersCreated for the steps below.
  let partnersCreated = 0
  // Define projectsCreated for the steps below.
  let projectsCreated = 0
  // Define teamsCreated for the steps below.
  let teamsCreated = 0

  // Fuzzy match, falling back to auto-creating the Partner
  const getOrCreatePartnerId = async (orgNameRaw: string): Promise<string> => {
    // Use normalizeProjectText to initialize orgTextRaw.
    const orgTextRaw = normalizeProjectText(orgNameRaw)
    // Define aliased for the steps below.
    const aliased = aliasLookup.get(orgTextRaw) ?? orgTextRaw
    // Use [orgTextRaw, aliased].map(normalizeProjectKey).filter to initialize candidates.
    const candidates = [orgTextRaw, aliased].map(normalizeProjectKey).filter(Boolean)

    // Repeat the following steps for each item in candidates.
    for (const candidate of candidates) {
      // Check whether partnerLookup.has(candidate) before running this branch.
      if (partnerLookup.has(candidate)) return partnerLookup.get(candidate)!
    }
    // Repeat the following steps for each item in partnerLookup.
    for (const [name, id] of partnerLookup) {
      // Repeat the following steps for each item in candidates.
      for (const candidate of candidates) {
        // Check whether name.includes(candidate) || candidate.includes(name) before running this branch.
        if (name.includes(candidate) || candidate.includes(name)) return id
      }
    }

    // Define partner for the steps below.
    const partner = await partnerService.createPartner({
      name: orgNameRaw.trim() || 'Unknown Partner',
    })
    // Call partnerLookup.set to run this step.
    partnerLookup.set(normalizeProjectKey(orgNameRaw), partner.id)
    partnersCreated++
    // Pass partner.id back to the caller.
    return partner.id
  }

  // Ensure a Team exists for a resolved project in this semester/day, once per project per request
  const ensuredTeamProjectIds = new Set<string>()
  // Define ensureTeamForProject for the steps below.
  const ensureTeamForProject = async (projectId: string): Promise<void> => {
    // Check whether ensuredTeamProjectIds.has(projectId) before running this branch.
    if (ensuredTeamProjectIds.has(projectId)) return
    // Call ensuredTeamProjectIds.add to run this step.
    ensuredTeamProjectIds.add(projectId)
    // Define existing for the steps below.
    const existing = await prisma.team.findUnique({
      where: { projectId_semesterId: { projectId, semesterId } },
    })
    // Check whether !existing before running this branch.
    if (!existing) {
      await teamService.createTeam({ projectId, semesterId, meetingDay })
      teamsCreated++
    }
  }

  // Fuzzy fallback: find or create the first project whose name matches
  const findOrCreateProjectId = async (choiceRaw: string): Promise<string | null> => {
    // Check whether !choiceRaw?.trim() before running this branch.
    if (!choiceRaw?.trim()) return null
    // Use stripSemesterPrefix to initialize stripped.
    const stripped = stripSemesterPrefix(choiceRaw)
    // Use stripped .split(':') .map to initialize [orgPartSource = stripped, projectPartSource = ''].
    const [orgPartSource = stripped, projectPartSource = ''] = stripped
      .split(':')
      .map((p) => p.trim())
    // Use normalizeProjectText to initialize normalizedFull.
    const normalizedFull = normalizeProjectText(stripped)
    // Check whether !normalizedFull before running this branch.
    if (!normalizedFull) return null

    // Use normalizeProjectText to initialize orgPartRaw.
    const orgPartRaw = normalizeProjectText(orgPartSource)
    // Use normalizeProjectText to initialize projectPartRaw.
    const projectPartRaw = normalizeProjectText(projectPartSource)
    // Define orgPart for the steps below.
    const orgPart = aliasLookup.get(orgPartRaw) ?? orgPartRaw
    // Define projectPart for the steps below.
    const projectPart = aliasLookup.get(projectPartRaw) ?? projectPartRaw

    // Use [normalizedFull, orgPart, projectPart] .map((c) => normalizeProjectKey(c)) .filter to initialize candidates.
    const candidates = [normalizedFull, orgPart, projectPart]
      .map((c) => normalizeProjectKey(c))
      .filter(Boolean)

    // Check existing projects first
    for (const candidate of candidates) {
      // Check whether projectLookup.has(candidate) before running this branch.
      if (projectLookup.has(candidate)) return projectLookup.get(candidate)!
    }

    // Repeat the following steps for each item in projectLookup.
    for (const [name, id] of projectLookup) {
      // Repeat the following steps for each item in candidates.
      for (const candidate of candidates) {
        // Check whether name.includes(candidate) || candidate.includes(name) before running this branch.
        if (name.includes(candidate) || candidate.includes(name)) return id
      }
    }

    // Not found — auto-create the partner and project.
    const partnerId = await getOrCreatePartnerId(projectPartSource ? orgPartSource : stripped)
    // Define projectName for the steps below.
    const projectName = projectPartSource || stripped

    // Define project for the steps below.
    const project = await projectService.createProject({
      name: projectName,
      description: '',
      type: 'SOFTWARE',
      status: 'NEW',
      repoURL: '',
      partnerId,
    })
    // Call projectLookup.set to run this step.
    projectLookup.set(normalizeProjectKey(projectName), project.id)
    projectsCreated++
    // Pass project.id back to the caller.
    return project.id
  }

  // Define studentsImported for the steps below.
  let studentsImported = 0
  // Define choicesCreated for the steps below.
  let choicesCreated = 0
  // Define skippedStudents for the steps below.
  const skippedStudents: string[] = []

  // Repeat the following steps for each item in rows.
  for (const row of rows) {
    // Use readFirstValue to initialize netID.
    const netID = readFirstValue(row, ['SSO ID', 'ssoid', 'netID', 'netid', 'id'])
    // Check whether !netID before running this branch.
    if (!netID) {
      // Call skippedStudents.push to run this step.
      skippedStudents.push(
        readFirstValue(row, ['Student Name', 'student name', 'name', 'fullName']) || '(no name)'
      )
      continue
    }

    // ── Build student record ─────────────────────────────────────────────────
    const { firstName, lastName } = parseStudentName(row)
    // Define email for the steps below.
    const email = readFirstValue(row, ['Student Email', 'student email', 'studentemail']) || null
    // Use readFirstValue(row, ['Classification', 'classification']).toLowerCase to initialize yearRaw.
    const yearRaw = readFirstValue(row, ['Classification', 'classification']).toLowerCase()
    // Define year for the steps below.
    const year: Year = YEAR_MAP[yearRaw] ?? 'FRESHMAN'
    // Use extractClass to initialize cls.
    const cls = extractClass(readFirstValue(row, ['Enrollment', 'enrollment']))
    // Use extractMajor to initialize major.
    const major = extractMajor(
      readFirstValue(row, ['School and Major', 'school and major', 'major'])
    )
    // Use extractGender to initialize gender.
    const gender = extractGender(readFirstValue(row, ['Gender', 'gender']))
    // Use readSkills to initialize skills.
    const skills = readSkills(row)
    // Use readFirstValue to initialize comments.
    const comments = readFirstValue(row, COMMENTS_KEYS)

    // ── Process choices ──────────────────────────────────────────────────────

    const chosenProjectIds: string[] = []

    // Define choiceKeys for the steps below.
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
      // Use readFirstValue to initialize raw.
      const raw = readFirstValue(row, [choiceKeys[i]!])
      // Check whether !raw before running this branch.
      if (!raw) continue

      // Define projectId for the steps below.
      const projectId = await findOrCreateProjectId(raw)
      // Check whether !projectId before running this branch.
      if (!projectId) continue
      await ensureTeamForProject(projectId)

      // Check whether chosenProjectIds.includes(projectId) before running this branch.
      if (chosenProjectIds.includes(projectId)) continue
      // Call chosenProjectIds.push to run this step.
      chosenProjectIds.push(projectId)
    }

    // Define record for the steps below.
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
    await processBidRecord(semesterId, meetingDay, record)
    studentsImported++
    choicesCreated += chosenProjectIds.length
  }

  // Pass { studentsImported, choicesCreated, partnersCreated, projectsCreated, teamsCreated, skippedStudents, back to the caller.
  return {
    studentsImported,
    choicesCreated,
    partnersCreated,
    projectsCreated,
    teamsCreated,
    skippedStudents,
  }
})
