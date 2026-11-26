/**
 * Purpose
 * Provide the record drafts logic used by other parts of ESA.
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
// What each minor-record modal resolves with. These live outside the components because a
// `<script setup>` block only ever emits its default export — a type declared inside one cannot be
// imported by the tab that consumes it.

import type { ProjectRead } from '#server/services/projectService'
import type { Class, Gender, MeetingDay, Year } from '~/utils/options'

export interface ContactDraft {
  name: string
  email: string
  phone?: string
}

export interface TeamDraft {
  semesterId: string
  meetingDay: MeetingDay
}

export interface SemesterInfoDraft {
  semesterId: string
  role: 'STUDENT' | 'MENTOR'
  meetingDay: MeetingDay
  major: string
  year: Year
  class: Class
  gender: Gender
  project?: ProjectRead
}
