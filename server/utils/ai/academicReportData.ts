/**
 * Purpose
 * Prepare records for one report request.
 *
 * Inputs
 * - Imported records, current workspace edits, and database metadata.
 *
 * Outputs
 * - An isolated data set used for the duration of the request.
 *
 * Pseudocode
 * Validate browser records → load database details → combine the sources → reuse derived data within this request.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { z } from 'zod'
import baseline from '../../../app/components/verified-data.json'
import seedStudents from '../../../prisma/seeddata/students.json'
import { prisma } from '../prisma'
// Use z.string().max to initialize text.
const text = z.string().max(50000)
// Use z.string().min(1).max to initialize id.
const id = z.string().min(1).max(200)
// Use z.object to initialize enrollment.
const enrollment = z.object({
  gender: text,
  major: text,
  year: text,
  class: text,
  skills: z.array(text).max(100),
  meetingDay: text,
  courseEnrollment: text.nullable().optional(),
  participationStatus: text.optional(),
  comments: text.optional(),
  statusNote: text.optional(),
})
// Use enrollment.extend to initialize student.
const student = enrollment.extend({
  id,
  name: text,
  email: text.optional(),
  netID: text.nullable().optional(),
  firstName: text.optional(),
  lastName: text.optional(),
  raceEthnicity: text.optional(),
  semesters: z.array(id).max(50),
  projects: z.array(id).max(200),
  isMentor: z.boolean(),
  statusNote: text.optional(),
  sourceSemester: text.optional(),
  enrollmentDetails: z.record(id, enrollment).optional(),
  github: text.optional(),
  discord: text.optional(),
  comments: text.optional(),
})
// Use z.object to initialize detail.
const detail = z.object({
  semesterId: id,
  contactName: text,
  contactEmail: text,
  contactPhone: text,
  mentorName: text,
  mentorEmail: text,
  teamSkills: z.array(text).optional(),
  status: text.optional(),
  statusNote: text.optional(),
})
// Use z.object to initialize schema.
const schema = z.object({
  semesters: z
    .array(
      z.object({
        id,
        label: text,
        year: z.number().int(),
        term: z.enum(['Spring', 'Summer', 'Fall']),
      })
    )
    .max(50),
  students: z.array(student).max(10000),
  projects: z
    .array(
      z.object({
        id,
        name: text,
        projectNumber: z.number().optional(),
        partnerId: id,
        type: text.optional(),
        status: text,
        description: text,
        semesters: z.array(id),
        mentorName: text.optional(),
        mentorEmail: text.optional(),
        semesterDetails: z.array(detail).optional(),
        repoURL: text.optional(),
        statusNote: text.optional(),
      })
    )
    .max(5000),
  partners: z
    .array(
      z.object({
        id,
        name: text,
        contact: text,
        email: text,
        phone: text,
        activeProjects: z.number(),
      })
    )
    .max(5000),
  teams: z
    .array(
      z.object({
        projectId: id,
        semesterId: id,
        peerLeadId: id.optional(),
        studentIds: z.array(id).max(500),
        meetingDay: text.optional(),
      })
    )
    .max(10000),
  choices: z
    .array(
      z.object({
        studentId: id,
        projectId: id,
        semesterId: id,
        rank: z.number().int().min(1).max(100),
      })
    )
    .max(100000),
})
export type WorkspaceInput = z.infer<typeof schema>
export type ReportData = Record<string, any>
// Define context for the steps below.
const context = new AsyncLocalStorage<ReportData>()
// Define memo for the steps below.
const memo = new WeakMap<object, Map<string, unknown>>()
// Define the helper that will report memo.
export function reportMemo<T>(key: string, calculate: () => T): T {
  // Define data for the steps below.
  const data = context.getStore() ?? baseline
  // Use memo.get to initialize store.
  let store = memo.get(data)
  // Check whether !store before running this branch.
  if (!store) {
    // Update store with the value on the right.
    store = new Map()
    // Call memo.set to run this step.
    memo.set(data, store)
  }
  // Check whether store.has(key) before running this branch.
  if (store.has(key)) return store.get(key) as T
  // Use calculate to initialize result.
  const result = calculate()
  // Call store.set to run this step.
  store.set(key, result)
  // Pass result back to the caller.
  return result
}
// Define reportSource for the steps below.
export const reportSource = new Proxy(baseline as ReportData, {
  get(target, key) {
    // Pass (context.getStore() ?? target)[key as string] back to the caller.
    return (context.getStore() ?? target)[key as string]
  },
})
// Define the helper that will validate workspace.
export function validateWorkspace(input: unknown): WorkspaceInput {
  // Use schema.parse to initialize data.
  const data = schema.parse(input)
  // Repeat the following steps for each item in ['students', 'projects', 'partners', 'semesters'] as const.
  for (const key of ['students', 'projects', 'partners', 'semesters'] as const) {
    // Use data[key].map to initialize ids.
    const ids = data[key].map((item) => item.id)
    // Check whether new Set(ids).size !== ids.length before running this branch.
    if (new Set(ids).size !== ids.length) throw Error(`Duplicate ${key} IDs in workspace`)
  }
  // Define students for the steps below.
  const students = new Set(data.students.map((s) => s.id)),
    projects = new Set(data.projects.map((p) => p.id)),
    semesters = new Set(data.semesters.map((s) => s.id))
  // Update data.teams with the value on the right.
  data.teams = data.teams
    .filter((t) => projects.has(t.projectId) && semesters.has(t.semesterId))
    .map((t) => ({ ...t, studentIds: t.studentIds.filter((id) => students.has(id)) }))
  // Update data.choices with the value on the right.
  data.choices = data.choices.filter(
    (c) => students.has(c.studentId) && projects.has(c.projectId) && semesters.has(c.semesterId)
  )
  // Pass data back to the caller.
  return data
}
// Define the helper that will with report data.
export function withReportData<T>(data: ReportData, fn: () => T): T {
  // Pass context.run(data, fn) back to the caller.
  return context.run(data, fn)
}
// Define the helper that will load report data.
export async function loadReportData(input?: unknown): Promise<ReportData> {
  // Define workspace for the steps below.
  const workspace = input === undefined ? baseline : validateWorkspace(input)
  // Define [students, projects, partners, contacts, enrollments] for the steps below.
  const [students, projects, partners, contacts, enrollments] = await Promise.all([
    prisma.student.findMany({
      select: {
        id: true,
        github: true,
        discord: true,
        email: true,
        netID: true,
        isMentor: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.project.findMany({
      select: { id: true, repoURL: true, description: true, createdAt: true, updatedAt: true },
    }),
    prisma.partner.findMany({ select: { id: true, createdAt: true, updatedAt: true } }),
    prisma.contact.findMany({
      select: { id: true, partnerId: true, name: true, email: true, phone: true, isPrimary: true },
    }),
    prisma.enrollment.findMany({
      select: {
        studentId: true,
        semesterId: true,
        comments: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ])
  // Pass { ...baseline, ...workspace, _origin: input === undefined ? 'Verified imported records and recorded  back to the caller.
  return {
    ...baseline,
    ...workspace,
    _origin:
      input === undefined
        ? 'Verified imported records and recorded database fields'
        : 'Current workspace records and recorded database fields',
    _database: { students, projects, partners, contacts, enrollments },
    _seedStudents: seedStudents,
  }
}
// Define the helper that will database details.
export function databaseDetails(kind: string, id: string): any {
  // Pass ( reportMemo( 'db-index:' + kind, () => new Map<string, any>( (reportSource._database?.[kind] ?? []) back to the caller.
  return (
    reportMemo(
      'db-index:' + kind,
      () =>
        new Map<string, any>(
          (reportSource._database?.[kind] ?? []).map((row: any) => [row.id, row])
        )
    ).get(id) ?? {}
  )
}
// Define the helper that will recorded student notes.
export function recordedStudentNotes(student: any, semesterId: string): string {
  // Define current for the steps below.
  const current = student.enrollmentDetails?.[semesterId]?.comments ?? student.comments
  // Check whether current !== undefined before running this branch.
  if (current !== undefined) return current
  // Check whether semesterId === 'SP26' before running this branch.
  if (semesterId === 'SP26') {
    // Use (reportSource._seedStudents ?? seedStudents).find to initialize match.
    const match = (reportSource._seedStudents ?? seedStudents).find(
      (record: any) =>
        (student.email && record.email?.toLowerCase() === student.email.toLowerCase()) ||
        (student.netID && record.netID === student.netID)
    )
    // Check whether match?.comments before running this branch.
    if (match?.comments) return match.comments
  }
  // Define stored for the steps below.
  const stored =
    reportSource._database?.enrollments?.find(
      (record: any) => record.studentId === student.id && record.semesterId === semesterId
    )?.comments ?? ''
  // Pass /^Imported from verified/.test(stored) ? '' : stored back to the caller.
  return /^Imported from verified/.test(stored) ? '' : stored
}
