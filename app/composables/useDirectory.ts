/**
 * Purpose
 * Provide the use directory logic used by other parts of ESA.
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
// The unfiltered lists the Database page searches against. Each shares one Nuxt fetch key, so any
// component may call these without issuing another request — which is what lets the row-expansion
// components resolve names on their own instead of having lists drilled down to them.

import type { PartnerRead } from '#server/services/partnerService'
import type { ProjectRead } from '#server/services/projectService'
import type { StudentRead } from '#server/services/studentService'

// Define the helper that will use all partners.
export function useAllPartners() {
  // Pass useFetch<PartnerRead[]>('/api/partners', { key: 'partners-all', default: () => [] }) back to the caller.
  return useFetch<PartnerRead[]>('/api/partners', { key: 'partners-all', default: () => [] })
}

// Define the helper that will use all projects.
export function useAllProjects() {
  // Pass useFetch<ProjectRead[]>('/api/projects', { key: 'projects-all', default: () => [] }) back to the caller.
  return useFetch<ProjectRead[]>('/api/projects', { key: 'projects-all', default: () => [] })
}

// Define the helper that will use all students.
export function useAllStudents() {
  // Pass useFetch<StudentRead[]>('/api/students', { key: 'students-all', default: () => [] }) back to the caller.
  return useFetch<StudentRead[]>('/api/students', { key: 'students-all', default: () => [] })
}
