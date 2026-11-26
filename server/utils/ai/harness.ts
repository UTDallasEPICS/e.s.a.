/**
 * Purpose
 * Provide the harness logic used by other parts of ESA.
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
import { validateQueryPlan, type AnalyticsQuery } from './queryPlan'

// Define MIN_GROUP_SIZE for the steps below.
const MIN_GROUP_SIZE = 5

// Define studentRelatedSources for the steps below.
const studentRelatedSources = ['enrollments', 'memberships', 'choices'] as const

type ValidatedPlan = ReturnType<typeof validateQueryPlan>

// Define the helper that will validate aiplan.
export function validateAIPlan(input: unknown): ValidatedPlan {
  // Use validateQueryPlan to initialize plan.
  const plan = validateQueryPlan(input)

  // Check whether 'source' in plan before running this branch.
  if ('source' in plan) {
    // Call validateAnalyticsPrivacy to run this step.
    validateAnalyticsPrivacy(plan)
  } else if (plan.entity === 'enrollments') {
    // Call validateEnrollmentPrivacy to run this step.
    validateEnrollmentPrivacy(plan)
  }

  // Pass plan back to the caller.
  return plan
}

// Define the helper that will validate enrollment privacy.
function validateEnrollmentPrivacy(plan: Extract<ValidatedPlan, { entity: 'enrollments' }>): void {
  // Define hasMajorFilter for the steps below.
  const hasMajorFilter = plan.filters.major !== undefined
  // Define hasYearFilter for the steps below.
  const hasYearFilter = plan.filters.year !== undefined

  // Keep each request to one demographic slice. A demographic filter combined
  // with any demographic breakdown can expose intersections through subtraction.
  if (hasMajorFilter && hasYearFilter) {
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error('Enrollment queries cannot combine demographic filters')
  }
  // Check whether plan.groupBy !== 'none' && (hasMajorFilter || hasYearFilter) before running this branch.
  if (plan.groupBy !== 'none' && (hasMajorFilter || hasYearFilter)) {
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error('Enrollment breakdowns cannot include demographic filters')
  }
}

// Define the helper that will validate analytics privacy.
function validateAnalyticsPrivacy(plan: AnalyticsQuery): void {
  // Use studentRelatedSources.some to initialize isStudentRelated.
  const isStudentRelated = studentRelatedSources.some((source) => source === plan.source)

  // Check whether !isStudentRelated before running this branch.
  if (!isStudentRelated) {
    return
  }

  // Student-related queries must use aggregate counts.
  if (
    plan.metrics.length === 0 ||
    plan.metrics.some((metric) => metric.function !== 'count' || metric.field !== undefined)
  ) {
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error('Student-related queries must use aggregate counts')
  }

  // Restrict combinations of demographic dimensions.
  if (plan.dimensions.length > 1) {
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error('Student-related queries support one grouping dimension')
  }
}

// Define the helper that will protect aggregate count.
export function protectAggregateCount(count: number): number | null {
  // Check whether !Number.isInteger(count) || count < 0 before running this branch.
  if (!Number.isInteger(count) || count < 0) {
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error('Invalid aggregate count')
  }

  // Pass count >= MIN_GROUP_SIZE ? count : null back to the caller.
  return count >= MIN_GROUP_SIZE ? count : null
}

// Define the helper that will protect aggregate results.
export function protectAggregateResults<T extends { count: number }>(results: T[]): T[] {
  // Pass results.filter( (result) => Number.isInteger(result.count) && result.count >= MIN_GROUP_SIZE ) back to the caller.
  return results.filter(
    (result) => Number.isInteger(result.count) && result.count >= MIN_GROUP_SIZE
  )
}
