/**
 * Purpose
 * Provide the structured response logic used by other parts of ESA.
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

// Define the helper that will execute structured query request.
export async function executeStructuredQueryRequest(
  input: unknown,
  options: StructuredExecutionOptions
): Promise<StructuredAIResponse> {
  // Check whether !options.authorized before running this branch.
  if (!options.authorized) {
    // Pass { status: 'execution_error', explanation: 'You are not authorized to run this database search.' } back to the caller.
    return { status: 'execution_error', explanation: 'You are not authorized to run this database search.' }
  }

  // Define plan for the steps below.
  let plan: StructuredQueryPlan
  try {
    // Update plan with the value on the right.
    plan = enforceStructuredQueryPrivacy(input)
  } catch (error) {
    // Check whether error instanceof PrivacyPolicyError before running this branch.
    if (error instanceof PrivacyPolicyError) {
      // Pass { status: 'privacy_restricted', explanation: 'This request involves restricted personal or student i back to the caller.
      return { status: 'privacy_restricted', explanation: 'This request involves restricted personal or student information.' }
    }
    // Pass { status: 'unsupported_capability', explanation: 'This request uses a data field or operation that t back to the caller.
    return {
      status: 'unsupported_capability',
      explanation: 'This request uses a data field or operation that the academic search does not support.',
    }
  }

  try {
    // Define result for the steps below.
    const result = await (options.execute ?? ((validated) => executeStructuredQueryPlan(validated)))(
      enforceStructuredQueryPrivacy(plan)
    )
    // Call validateStructuredResult to run this step.
    validateStructuredResult(plan, result)
    // Pass result.empty ? { status: 'no_data', explanation: 'No records matched the requested conditions.', res back to the caller.
    return result.empty
      ? { status: 'no_data', explanation: 'No records matched the requested conditions.', result }
      : { status: 'answer', explanation: 'The results match the requested conditions.', result }
  } catch (error) {
    // Check whether error instanceof PrivacyPolicyError before running this branch.
    if (error instanceof PrivacyPolicyError) {
      // Pass { status: 'privacy_restricted', explanation: 'This request involves restricted personal or student i back to the caller.
      return { status: 'privacy_restricted', explanation: 'This request involves restricted personal or student information.' }
    }
    // Check whether error instanceof StructuredQueryExecutionError before running this branch.
    if (error instanceof StructuredQueryExecutionError) {
      // Check whether error.code.endsWith('_LIMIT_EXCEEDED') before running this branch.
      if (error.code.endsWith('_LIMIT_EXCEEDED')) {
        // Pass { status: 'unsupported_capability', explanation: 'This request exceeds the safe query limits. Add fi back to the caller.
        return { status: 'unsupported_capability', explanation: 'This request exceeds the safe query limits. Add filters or reduce the requested grouping.' }
      }
      // Check whether error.code === 'UNSUPPORTED_SORT' || error.code === 'INVALID_AGGREGATE' before running this branch.
      if (error.code === 'UNSUPPORTED_SORT' || error.code === 'INVALID_AGGREGATE') {
        // Pass { status: 'unsupported_capability', explanation: 'This request uses a query operation that is not su back to the caller.
        return { status: 'unsupported_capability', explanation: 'This request uses a query operation that is not supported for the selected data.' }
      }
    }
    // Pass { status: 'execution_error', explanation: 'The database search could not be completed. Please try ag back to the caller.
    return { status: 'execution_error', explanation: 'The database search could not be completed. Please try again or simplify the request.' }
  }
}

// Define the helper that will clarification needed.
export function clarificationNeeded(
  explanation = 'Please clarify which records, time period, or grouping you mean.'
): StructuredAIResponse {
  // Pass { status: 'clarification_needed', explanation } back to the caller.
  return { status: 'clarification_needed', explanation }
}

// Define the helper that will validate structured result.
function validateStructuredResult(plan: StructuredQueryPlan, result: StructuredQueryResult): void {
  // Check whether result.model !== plan.model || result.rows.length > result.limit || result.rows.length > 100 || resu before running this branch.
  if (
    result.model !== plan.model ||
    result.rows.length > result.limit ||
    result.rows.length > 100 ||
    result.columns.length > 40
  ) {
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error('Result does not satisfy the structured output policy')
  }
  // Define allowedColumns for the steps below.
  const allowedColumns = new Set([
    ...(plan.select ?? []),
    ...(plan.groupBy ?? []),
    ...(plan.aggregates ?? []).map((metric) => metric.alias),
    ...(plan.calculations ?? []).map((calculation) => calculation.alias),
  ])
  // Repeat the following steps for each item in result.columns.
  for (const column of result.columns) {
    // Check whether !allowedColumns.has(column.key) before running this branch.
    if (!allowedColumns.has(column.key)) throw new Error('Result includes an unrequested column')
    // Check whether (column.role === 'field' || column.role === 'dimension') && !resolveAIFieldPath(plan.model, column.k before running this branch.
    if (
      (column.role === 'field' || column.role === 'dimension') &&
      !resolveAIFieldPath(plan.model, column.key)
    ) {
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('Result field is not approved')
    }
  }
  // Repeat the following steps for each item in result.rows.
  for (const row of result.rows) {
    // Check whether Object.keys(row.values).some((key) => !allowedColumns.has(key)) before running this branch.
    if (Object.keys(row.values).some((key) => !allowedColumns.has(key))) {
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('Result includes an unrequested value')
    }
  }
}
