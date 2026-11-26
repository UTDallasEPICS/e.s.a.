/**
 * Purpose
 * Provide the use semesters logic used by other parts of ESA.
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
import type { SemesterCreate, SemesterRead } from '#server/services/semesterService'
import { formatSemester, semesterOrder } from '~/utils/labels'
import { dayLabel, type SelectOption } from '~/utils/options'

// Define the helper that will use semesters.
export function useSemesters() {
  // Use useFetch to initialize { data, refresh, status }.
  const { data, refresh, status } = useFetch<SemesterRead[]>('/api/semesters', {
    key: 'semesters',
    default: () => [],
  })

  // Define the helper that will create semester.
  async function createSemester(input: SemesterCreate) {
    await $fetch('/api/semesters', { method: 'POST', body: input })
    await refresh()
  }

  // Define the helper that will delete semester.
  async function deleteSemester(id: string) {
    await $fetch(`/api/semesters/${id}`, { method: 'DELETE' })
    await refresh()
  }

  // Pass { semesters: data, status, refresh, createSemester, deleteSemester } back to the caller.
  return { semesters: data, status, refresh, createSemester, deleteSemester }
}

/**
 * Semester display helpers keyed by id, for the many places that hold a `semesterId` and need to
 * render or order it. Shares the `semesters` fetch key, so this costs no extra request.
 */
export function useSemesterLookup() {
  // Use useSemesters to initialize { semesters }.
  const { semesters } = useSemesters()

  // Define the helper that will find.
  function find(id?: string | null) {
    // Pass id ? semesters.value.find((semester) => semester.id === id) : undefined back to the caller.
    return id ? semesters.value.find((semester) => semester.id === id) : undefined
  }

  // Define the helper that will semester label.
  function semesterLabel(id?: string | null) {
    // Use find to initialize semester.
    const semester = find(id)
    // Pass semester ? formatSemester(semester) : 'Unknown Semester' back to the caller.
    return semester ? formatSemester(semester) : 'Unknown Semester'
  }

  // Define the helper that will semester sort key.
  function semesterSortKey(id?: string | null) {
    // Use find to initialize semester.
    const semester = find(id)
    // Pass semester ? semesterOrder(semester) : 0 back to the caller.
    return semester ? semesterOrder(semester) : 0
  }

  // Recalculate semesterOptions when the values it reads change.
  const semesterOptions = computed<SelectOption[]>(() =>
    semesters.value.map((semester) => ({ label: formatSemester(semester), value: semester.id }))
  )

  /** `Fall 2025 — Wednesday`, the heading a Team card carries. */
  function teamLabel(team: { semesterId: string; meetingDay?: string | null }) {
    // Pass `${semesterLabel(team.semesterId)} — ${dayLabel(team.meetingDay)}` back to the caller.
    return `${semesterLabel(team.semesterId)} — ${dayLabel(team.meetingDay)}`
  }

  // Pass { semesters, semesterLabel, semesterSortKey, semesterOptions, teamLabel } back to the caller.
  return { semesters, semesterLabel, semesterSortKey, semesterOptions, teamLabel }
}
