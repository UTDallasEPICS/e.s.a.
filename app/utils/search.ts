/**
 * Purpose
 * Provide the search logic used by other parts of ESA.
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
// Client-side typeahead filters for RecordSearchInput. Every list the Database page searches is
// already fetched in full, so these are plain array filters rather than network calls.

import type { PartnerRead } from '#server/services/partnerService'
import type { ProjectRead } from '#server/services/projectService'
import type { StudentRead } from '#server/services/studentService'

/** Callers cap results so a long list cannot flood the dropdown (§2.5). */
export const SEARCH_LIMIT = 10

// Define the helper that will normalize.
function normalize(query: string) {
  // Pass query.trim().toLowerCase() back to the caller.
  return query.trim().toLowerCase()
}

// Define the helper that will search partners.
export function searchPartners(partners: PartnerRead[], query: string) {
  // Use normalize to initialize q.
  const q = normalize(query)
  // Pass partners.filter((p) => !q || p.name.toLowerCase().includes(q)).slice(0, SEARCH_LIMIT) back to the caller.
  return partners.filter((p) => !q || p.name.toLowerCase().includes(q)).slice(0, SEARCH_LIMIT)
}

// Define the helper that will search students.
export function searchStudents(students: StudentRead[], query: string, exclude?: Set<string>) {
  // Use normalize to initialize q.
  const q = normalize(query)
  // Pass students .filter((student) => !exclude?.has(student.id)) .filter( (student) => !q || student.netID.t back to the caller.
  return students
    .filter((student) => !exclude?.has(student.id))
    .filter(
      (student) =>
        !q ||
        student.netID.toLowerCase().includes(q) ||
        `${student.firstName} ${student.lastName}`.toLowerCase().includes(q)
    )
    .slice(0, SEARCH_LIMIT)
}

/**
 * Projects matching by their own name or their partner's. `semesterId` narrows to projects that
 * actually have a team that semester, which is what makes a project assignable there.
 */
export function searchProjects(
  projects: ProjectRead[],
  query: string,
  opts?: { semesterId?: string; exclude?: Set<string> }
) {
  // Use normalize to initialize q.
  const q = normalize(query)
  // Pass projects .filter( (project) => !opts?.semesterId || project.Teams.some((team) => team.semesterId === back to the caller.
  return projects
    .filter(
      (project) =>
        !opts?.semesterId || project.Teams.some((team) => team.semesterId === opts.semesterId)
    )
    .filter((project) => !opts?.exclude?.has(project.id))
    .filter(
      (project) =>
        !q ||
        project.name.toLowerCase().includes(q) ||
        project.Partner.name.toLowerCase().includes(q)
    )
    .slice(0, SEARCH_LIMIT)
}
