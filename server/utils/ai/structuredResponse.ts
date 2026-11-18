import { resolveAIFieldPath } from './schemaCatalog'
import { enforceStructuredQueryPrivacy, PrivacyPolicyError } from './privacyPolicy'
import type { StructuredQueryPlan } from './queryPlan'
import {
  executeStructuredQueryPlan,
  StructuredQueryExecutionError,
  type StructuredQueryResult,
} from './queryExecutor'

export type StructuredAIStatus =
  | 'answer'
  | 'no_data'
  | 'privacy_restricted'
  | 'clarification_needed'
  | 'unsupported_capability'
  | 'execution_error'

export type StructuredAIResponse = {
  status: StructuredAIStatus
  explanation: string
  result?: StructuredQueryResult
}

export type StructuredExecutionOptions = {
  /** Authorization must be established by the calling server route. */
  authorized: boolean
  execute?: (plan: StructuredQueryPlan) => Promise<StructuredQueryResult>
}

export async function executeStructuredQueryRequest(
  input: unknown,
  options: StructuredExecutionOptions
): Promise<StructuredAIResponse> {
  if (!options.authorized) {
    return { status: 'execution_error', explanation: 'You are not authorized to run this database search.' }
  }

  let plan: StructuredQueryPlan
  try {
    plan = enforceStructuredQueryPrivacy(input)
  } catch (error) {
    if (error instanceof PrivacyPolicyError) {
      return { status: 'privacy_restricted', explanation: 'This request involves restricted personal or student information.' }
    }
    return {
      status: 'unsupported_capability',
      explanation: 'This request uses a data field or operation that the academic search does not support.',
    }
  }

  try {
    const result = await (options.execute ?? ((validated) => executeStructuredQueryPlan(validated)))(
      enforceStructuredQueryPrivacy(plan)
    )
    validateStructuredResult(plan, result)
    return result.empty
      ? { status: 'no_data', explanation: 'No records matched the requested conditions.', result }
      : { status: 'answer', explanation: 'The results match the requested conditions.', result }
  } catch (error) {
    if (error instanceof PrivacyPolicyError) {
      return { status: 'privacy_restricted', explanation: 'This request involves restricted personal or student information.' }
    }
    if (error instanceof StructuredQueryExecutionError) {
      if (error.code.endsWith('_LIMIT_EXCEEDED')) {
        return { status: 'unsupported_capability', explanation: 'This request exceeds the safe query limits. Add filters or reduce the requested grouping.' }
      }
      if (error.code === 'UNSUPPORTED_SORT' || error.code === 'INVALID_AGGREGATE') {
        return { status: 'unsupported_capability', explanation: 'This request uses a query operation that is not supported for the selected data.' }
      }
    }
    return { status: 'execution_error', explanation: 'The database search could not be completed. Please try again or simplify the request.' }
  }
}

export function clarificationNeeded(
  explanation = 'Please clarify which records, time period, or grouping you mean.'
): StructuredAIResponse {
  return { status: 'clarification_needed', explanation }
}

function validateStructuredResult(plan: StructuredQueryPlan, result: StructuredQueryResult): void {
  if (
    result.model !== plan.model ||
    result.rows.length > result.limit ||
    result.rows.length > 100 ||
    result.columns.length > 40
  ) {
    throw new Error('Result does not satisfy the structured output policy')
  }
  const allowedColumns = new Set([
    ...(plan.select ?? []),
    ...(plan.groupBy ?? []),
    ...(plan.aggregates ?? []).map((metric) => metric.alias),
    ...(plan.calculations ?? []).map((calculation) => calculation.alias),
  ])
  for (const column of result.columns) {
    if (!allowedColumns.has(column.key)) throw new Error('Result includes an unrequested column')
    if (
      (column.role === 'field' || column.role === 'dimension') &&
      !resolveAIFieldPath(plan.model, column.key)
    ) {
      throw new Error('Result field is not approved')
    }
  }
  for (const row of result.rows) {
    if (Object.keys(row.values).some((key) => !allowedColumns.has(key))) {
      throw new Error('Result includes an unrequested value')
    }
  }
}
