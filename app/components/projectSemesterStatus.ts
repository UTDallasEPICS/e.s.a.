/**
 * Purpose
 * Decide which project status applies to a particular semester.
 *
 * Inputs
 * - A project with semester history and the selected semester ID.
 *
 * Outputs
 * - New, In Progress, Paused, Completed, or Dropped.
 *
 * Pseudocode
 * Find the relevant semester → use its recorded status if present → otherwise use the project history to distinguish a new project from a continuation.
 */
import type { Project } from './data'

// Define the helper that will semester order.
function semesterOrder(id: string) {
  // Define terms for the steps below.
  const terms: Record<string, number> = { SP: 1, SU: 2, FA: 3 }
  // Pass Number(id.slice(-2)) * 10 + (terms[id.slice(0, 2)] ?? 0) back to the caller.
  return Number(id.slice(-2)) * 10 + (terms[id.slice(0, 2)] ?? 0)
}

// Define the helper that will latest project semester.
export function latestProjectSemester(project: Pick<Project, 'semesters'>) {
  // Pass [...project.semesters].sort((a, b) => semesterOrder(a) - semesterOrder(b)).at(-1) ?? '' back to the caller.
  return [...project.semesters].sort((a, b) => semesterOrder(a) - semesterOrder(b)).at(-1) ?? ''
}

// Define the helper that will project status for semester.
export function projectStatusForSemester(
  project: Project,
  semesterId: string
): Exclude<Project['status'], 'Active'> {
  // Define term for the steps below.
  const term = semesterId === 'all' ? latestProjectSemester(project) : semesterId
  // Define recorded for the steps below.
  const recorded = project.semesterDetails?.find((detail) => detail.semesterId === term)?.status
  // Check whether recorded && recorded !== 'Active' before running this branch.
  if (recorded && recorded !== 'Active') return recorded
  // Check whether term === latestProjectSemester(project) && (project.status === 'Paused' || project.status === 'Compl before running this branch.
  if (
    term === latestProjectSemester(project) &&
    (project.status === 'Paused' || project.status === 'Completed' || project.status === 'Dropped')
  ) {
    // Pass project.status back to the caller.
    return project.status
  }
  // Pass project.semesters.some((id) => semesterOrder(id) < semesterOrder(term)) ? 'In Progress' : 'New' back to the caller.
  return project.semesters.some((id) => semesterOrder(id) < semesterOrder(term))
    ? 'In Progress'
    : 'New'
}
