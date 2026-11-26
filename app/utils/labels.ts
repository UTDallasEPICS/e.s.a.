/**
 * Purpose
 * Provide the labels logic used by other parts of ESA.
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
// Display-formatting helpers shared by the Database tabs and Team Formation.

/** `WEDNESDAY` -> `Wednesday`. Enum spellings are SCREAMING_CASE with no underscores. */
export function titleCase(value: string) {
  // Pass value[0] + value.slice(1).toLowerCase() back to the caller.
  return value[0] + value.slice(1).toLowerCase()
}

/** `1 partner` / `3 partners`, for confirmation titles. */
export function plural(count: number, noun: string) {
  // Pass `${count} ${noun}${count === 1 ? '' : 's'}` back to the caller.
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

// Define the helper that will format semester.
export function formatSemester(semester: { season: string; year: number }) {
  // Pass `${titleCase(semester.season)} ${semester.year}` back to the caller.
  return `${titleCase(semester.season)} ${semester.year}`
}

/** Orders semesters chronologically within a year. */
export function semesterOrder(semester: { season: string; year: number }) {
  // Define order for the steps below.
  const order = { SPRING: 0, SUMMER: 1, FALL: 2 } as const
  // Pass semester.year * 10 + (order[semester.season as keyof typeof order] ?? 0) back to the caller.
  return semester.year * 10 + (order[semester.season as keyof typeof order] ?? 0)
}

// Define the helper that will student label.
export function studentLabel(student: { firstName: string; lastName: string; netID: string }) {
  // Pass `${student.firstName} ${student.lastName} (${student.netID})` back to the caller.
  return `${student.firstName} ${student.lastName} (${student.netID})`
}

// Define the helper that will project label.
export function projectLabel(project: { name: string; Partner: { name: string } }) {
  // Pass `${project.name} (${project.Partner.name})` back to the caller.
  return `${project.name} (${project.Partner.name})`
}
