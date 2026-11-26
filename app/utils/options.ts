/**
 * Purpose
 * Provide the options logic used by other parts of ESA.
 *
 * Inputs
 * - Values passed by callers and any configuration or records imported here.
 *
 * Outputs
 * - The values, types, or functions exported by this file.
 *
 * Pseudocode
 * Load the dependencies → define the file’s rules or helpers → expose them for other files to use.
 */
// One home for every enum option list rendered by a USelectMenu, URadioGroup, or column filter.
//
// The labels are written out rather than derived from the enum spellings: a generic transform gets
// `EPCS_2200` wrong, and these strings are user-facing copy that should not move when an enum does.
// The value *types* still come from the server Read types, so a schema change breaks the build here.

import type { TeamRead } from '#server/services/teamService'
import type { EnrollmentRead } from '#server/services/enrollmentService'
import type { ProjectRead } from '#server/services/projectService'
import type { SemesterRead } from '#server/services/semesterService'
import { titleCase } from '~/utils/labels'

export interface SelectOption<V extends string = string> {
  label: string
  value: V
}

export type MeetingDay = TeamRead['meetingDay']
export type Gender = EnrollmentRead['gender']
export type Year = EnrollmentRead['year']
export type Class = EnrollmentRead['class']
export type ProjectType = ProjectRead['type']
export type ProjectStatus = ProjectRead['status']
export type Season = SemesterRead['season']

// Define MEETING_DAY_OPTIONS for the steps below.
export const MEETING_DAY_OPTIONS: SelectOption<MeetingDay>[] = [
  { label: 'Wednesday', value: 'WEDNESDAY' },
  { label: 'Thursday', value: 'THURSDAY' },
]

// Define GENDER_OPTIONS for the steps below.
export const GENDER_OPTIONS: SelectOption<Gender>[] = [
  { label: 'Male', value: 'MALE' },
  { label: 'Female', value: 'FEMALE' },
  { label: 'Other', value: 'OTHER' },
]

// Define YEAR_OPTIONS for the steps below.
export const YEAR_OPTIONS: SelectOption<Year>[] = [
  { label: 'Freshman', value: 'FRESHMAN' },
  { label: 'Sophomore', value: 'SOPHOMORE' },
  { label: 'Junior', value: 'JUNIOR' },
  { label: 'Senior', value: 'SENIOR' },
]

// Define CLASS_OPTIONS for the steps below.
export const CLASS_OPTIONS: SelectOption<Class>[] = [
  { label: 'EPCS 2200', value: 'EPCS_2200' },
  { label: 'EPCS 3200', value: 'EPCS_3200' },
]

// Define PROJECT_TYPE_OPTIONS for the steps below.
export const PROJECT_TYPE_OPTIONS: SelectOption<ProjectType>[] = [
  { label: 'Software', value: 'SOFTWARE' },
  { label: 'Hardware', value: 'HARDWARE' },
  { label: 'Both', value: 'BOTH' },
]

// Define PROJECT_STATUS_OPTIONS for the steps below.
export const PROJECT_STATUS_OPTIONS: SelectOption<ProjectStatus>[] = [
  { label: 'New', value: 'NEW' },
  { label: 'Returning', value: 'RETURNING' },
  { label: 'Complete', value: 'COMPLETE' },
  { label: 'Withdrawn', value: 'WITHDRAWN' },
  { label: 'Hold', value: 'HOLD' },
]

// Define SEASON_OPTIONS for the steps below.
export const SEASON_OPTIONS: SelectOption<Season>[] = [
  { label: 'Spring', value: 'SPRING' },
  { label: 'Summer', value: 'SUMMER' },
  { label: 'Fall', value: 'FALL' },
]

/** Mentor/Student as a column filter, where the multiselect matches on stringified booleans. */
export const MENTOR_FILTER_OPTIONS: SelectOption[] = [
  { label: 'Mentor', value: 'true' },
  { label: 'Student', value: 'false' },
]

// Define the helper that will day label.
export function dayLabel(day?: string | null) {
  // Pass day ? titleCase(day) : '—' back to the caller.
  return day ? titleCase(day) : '—'
}

/** The five enrollment fields shared by the Students columns (§3.2.1) and its cards (§3.2.3). */
export const ENROLLMENT_FIELDS = [
  { field: 'meetingDay', label: 'Meeting Day', options: MEETING_DAY_OPTIONS },
  { field: 'gender', label: 'Gender', options: GENDER_OPTIONS },
  { field: 'major', label: 'Major', options: undefined },
  { field: 'year', label: 'Year', options: YEAR_OPTIONS },
  { field: 'class', label: 'Class', options: CLASS_OPTIONS },
] as const
