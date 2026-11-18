import { validateQueryPlan, type AnalyticsQuery } from './queryPlan'

const MIN_GROUP_SIZE = 5

const studentRelatedSources = ['enrollments', 'memberships', 'choices'] as const

type ValidatedPlan = ReturnType<typeof validateQueryPlan>

export function validateAIPlan(input: unknown): ValidatedPlan {
  const plan = validateQueryPlan(input)

  if ('source' in plan) {
    validateAnalyticsPrivacy(plan)
  } else if (plan.entity === 'enrollments') {
    validateEnrollmentPrivacy(plan)
  }

  return plan
}

function validateEnrollmentPrivacy(plan: Extract<ValidatedPlan, { entity: 'enrollments' }>): void {
  const hasMajorFilter = plan.filters.major !== undefined
  const hasYearFilter = plan.filters.year !== undefined

  // Keep each request to one demographic slice. A demographic filter combined
  // with any demographic breakdown can expose intersections through subtraction.
  if (hasMajorFilter && hasYearFilter) {
    throw new Error('Enrollment queries cannot combine demographic filters')
  }
  if (plan.groupBy !== 'none' && (hasMajorFilter || hasYearFilter)) {
    throw new Error('Enrollment breakdowns cannot include demographic filters')
  }
}

function validateAnalyticsPrivacy(plan: AnalyticsQuery): void {
  const isStudentRelated = studentRelatedSources.some((source) => source === plan.source)

  if (!isStudentRelated) {
    return
  }

  // Student-related queries must use aggregate counts.
  if (
    plan.metrics.length === 0 ||
    plan.metrics.some((metric) => metric.function !== 'count' || metric.field !== undefined)
  ) {
    throw new Error('Student-related queries must use aggregate counts')
  }

  // Restrict combinations of demographic dimensions.
  if (plan.dimensions.length > 1) {
    throw new Error('Student-related queries support one grouping dimension')
  }
}

export function protectAggregateCount(count: number): number | null {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error('Invalid aggregate count')
  }

  return count >= MIN_GROUP_SIZE ? count : null
}

export function protectAggregateResults<T extends { count: number }>(results: T[]): T[] {
  return results.filter(
    (result) => Number.isInteger(result.count) && result.count >= MIN_GROUP_SIZE
  )
}
