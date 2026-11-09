import { z } from 'zod'
import type { H3Event } from 'h3'
import type {
  Year,
  Class,
  Gender,
  Season,
  ProjectType,
  ProjectStatus,
  ProjectMeetingDay,
} from '@@/prisma/generated/client'

// ---------------------------------------------------------------------------
// Runtime validation for API write-handler bodies.
//
// `readBody<XCreate>(event)` only casts the parsed JSON at compile time — it does not
// check anything at runtime, so a client can send arbitrary extra keys (including
// Prisma nested-write operators like `{ Memberships: { deleteMany: {} } }`) straight
// into a service call that spreads the body into `prisma.<model>.update({ data })`.
//
// Every schema below is a plain `z.object({...})`, which in zod v4 strips unrecognized
// keys during `parse`/`safeParse` rather than passing them through (confirmed against
// the installed zod 4.3.6: `z.object({ a: z.string().optional() }).safeParse({ b: 1 })`
// succeeds with `data = {}`). That is sufficient to keep unexpected keys — including
// nested-write operators — from ever reaching Prisma, without needing `.passthrough()`
// or `.strict()`.
// ---------------------------------------------------------------------------

// ---- enums (kept in sync with the Prisma enums in prisma/schema.prisma) ----

const yearEnum = z.enum(['FRESHMAN', 'SOPHOMORE', 'JUNIOR', 'SENIOR']) satisfies z.ZodType<Year>
const classEnum = z.enum(['EPCS_2200', 'EPCS_3200']) satisfies z.ZodType<Class>
const genderEnum = z.enum(['MALE', 'FEMALE', 'OTHER']) satisfies z.ZodType<Gender>
const seasonEnum = z.enum(['SPRING', 'SUMMER', 'FALL']) satisfies z.ZodType<Season>
const projectTypeEnum = z.enum(['SOFTWARE', 'HARDWARE', 'BOTH']) satisfies z.ZodType<ProjectType>
const projectStatusEnum = z.enum([
  'NEW',
  'RETURNING',
  'COMPLETE',
  'WITHDRAWN',
  'HOLD',
]) satisfies z.ZodType<ProjectStatus>
const meetingDayEnum = z.enum(['WEDNESDAY', 'THURSDAY']) satisfies z.ZodType<ProjectMeetingDay>

// ---- choice ----
// prisma/schema.prisma: Choice.rank is Int, all fields non-nullable.

export const choiceCreateSchema = z.object({
  rank: z.int(),
  studentId: z.string(),
  projectId: z.string(),
  semesterId: z.string(),
})

export const choiceUpdateSchema = z.object({
  rank: z.int().optional(),
  semesterId: z.string().optional(),
})

// Nested under StudentCreate.Choices (Omit<ChoiceCreate, 'studentId'>).
const nestedChoiceCreateSchema = choiceCreateSchema.omit({ studentId: true })

// ---- contact ----
// prisma/schema.prisma: Contact.phone is String? (nullable) — PartnerContactList.vue
// clears it to '' rather than null today, but null is a legitimate cleared value for
// this column, so accept it defensively too.

export const contactCreateSchema = z.object({
  partnerId: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullish(),
  isPrimary: z.boolean().optional(),
})

export const contactUpdateSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().nullish(),
  isPrimary: z.boolean().optional(),
})

// Nested under PartnerCreate.Contacts (Omit<ContactCreate, 'partnerId'>).
const nestedContactCreateSchema = contactCreateSchema.omit({ partnerId: true })

// ---- enrollment ----
// All Enrollment columns other than skills/comments (which default to '') are
// non-nullable in the schema.

export const enrollmentCreateSchema = z.object({
  studentId: z.string(),
  semesterId: z.string(),
  gender: genderEnum,
  major: z.string(),
  year: yearEnum,
  class: classEnum,
  meetingDay: meetingDayEnum,
  skills: z.array(z.string()).optional(),
  comments: z.string().optional(),
})

export const enrollmentUpdateSchema = z.object({
  semesterId: z.string().optional(),
  gender: genderEnum.optional(),
  major: z.string().optional(),
  year: yearEnum.optional(),
  class: classEnum.optional(),
  meetingDay: meetingDayEnum.optional(),
  skills: z.array(z.string()).optional(),
  comments: z.string().optional(),
})

// Nested under StudentCreate.Enrollments (Omit<EnrollmentCreate, 'studentId'>).
const nestedEnrollmentCreateSchema = enrollmentCreateSchema.omit({ studentId: true })

// ---- membership ----
// MembershipCreate is nested from two different parents, each omitting a different
// key, so two distinct nested variants are needed (there is no MembershipUpdate —
// the service exposes no update function).

export const membershipCreateSchema = z.object({
  teamId: z.string(),
  studentId: z.string(),
  isMentor: z.boolean().optional(),
})

// Nested under TeamCreate.Memberships (Omit<MembershipCreate, 'teamId'>).
const nestedMembershipForTeamSchema = membershipCreateSchema.omit({ teamId: true })

// Nested under StudentCreate.Memberships (Omit<MembershipCreate, 'studentId'>).
const nestedMembershipForStudentSchema = membershipCreateSchema.omit({ studentId: true })

// ---- team ----

export const teamCreateSchema = z.object({
  projectId: z.string(),
  semesterId: z.string(),
  meetingDay: meetingDayEnum,
  Memberships: z.array(nestedMembershipForTeamSchema).optional(),
})

export const teamUpdateSchema = z.object({
  semesterId: z.string().optional(),
  meetingDay: meetingDayEnum.optional(),
})

// Nested under ProjectCreate.Teams (Omit<TeamCreate, 'projectId'>).
const nestedTeamCreateSchema = teamCreateSchema.omit({ projectId: true })

// ---- project ----
// name/description/repoURL/partnerId are all non-nullable strings in the schema.

export const projectCreateSchema = z.object({
  name: z.string(),
  description: z.string(),
  type: projectTypeEnum,
  status: projectStatusEnum,
  repoURL: z.string(),
  skills: z.string().optional(),
  partnerId: z.string(),
  Teams: z.array(nestedTeamCreateSchema).optional(),
})

export const projectUpdateSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  type: projectTypeEnum.optional(),
  status: projectStatusEnum.optional(),
  repoURL: z.string().optional(),
  skills: z.string().optional(),
  partnerId: z.string().optional(),
})

// ---- partner ----

export const partnerCreateSchema = z.object({
  name: z.string(),
  Contacts: z.array(nestedContactCreateSchema).optional(),
})

export const partnerUpdateSchema = z.object({
  name: z.string().optional(),
})

// ---- semester ----
// Semester.year is Int.

export const semesterCreateSchema = z.object({
  year: z.int(),
  season: seasonEnum,
})

export const semesterUpdateSchema = z.object({
  year: z.int().optional(),
  season: seasonEnum.optional(),
})

// ---- student ----
// prisma/schema.prisma: Student.github/discord/email are all String? (nullable and
// unique). StudentsTab.vue's updateStudent() legitimately sends `email: null` /
// `discord: null` to clear those fields (`fields[key] === '' ? null : fields[key]`),
// so both create and update must accept null here, not just omission.

export const studentCreateSchema = z.object({
  github: z.string().nullish(),
  discord: z.string().nullish(),
  email: z.string().nullish(),
  netID: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  isMentor: z.boolean().optional(),
  Enrollments: z.array(nestedEnrollmentCreateSchema).optional(),
  Memberships: z.array(nestedMembershipForStudentSchema).optional(),
  Choices: z.array(nestedChoiceCreateSchema).optional(),
})

export const studentUpdateSchema = z.object({
  github: z.string().nullish(),
  discord: z.string().nullish(),
  email: z.string().nullish(),
  netID: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  isMentor: z.boolean().optional(),
})

// ---------------------------------------------------------------------------
// Handler helper: parse+validate a request body against one of the schemas above,
// mapping a failed parse to a readable 400. Named `parseBody` (not `readValidatedBody`)
// to avoid colliding with h3's own auto-imported `readValidatedBody`.
// ---------------------------------------------------------------------------

export async function parseBody<T>(event: H3Event, schema: z.ZodType<T>): Promise<T> {
  const body = await readBody(event)
  const result = schema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: z.prettifyError(result.error),
    })
  }
  return result.data
}
