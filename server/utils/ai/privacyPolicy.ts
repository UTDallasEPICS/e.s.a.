/**
 * Purpose
 * Provide the privacy policy logic used by other parts of ESA.
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
import { aiSchemaCatalog } from './schemaCatalog'
import { validateStructuredQueryPlan, type StructuredQueryPlan } from './queryPlan'
// Define forbiddenTokens for the steps below.
const forbiddenTokens = new Set([
  'student', 'students', 'enrollment', 'enrollments', 'membership', 'memberships',
  'choice', 'choices', 'contact', 'contacts', 'email', 'phone', 'password',
  'token', 'credential', 'gender', 'major', 'demographic', 'comment', 'comments',
])

/** Shared server-side policy gate for the isolated v1 executor. */
export function enforceStructuredQueryPrivacy(input: unknown): StructuredQueryPlan {
  // Check whether referencesForbiddenData(input) before running this branch.
  if (referencesForbiddenData(input)) {
    // Stop this operation and tell the caller why it cannot continue.
    throw new PrivacyPolicyError()
  }
  // This derives authority from the runtime-schema-backed explicit allowlist.
  // No student-facing model or relation is included in that catalog.
  return validateStructuredQueryPlan(input)
}

// Define the helper that will references forbidden data.
function referencesForbiddenData(value: unknown): boolean {
  // Check whether Array.isArray(value) before running this branch.
  if (Array.isArray(value)) return value.some(referencesForbiddenData)
  // Check whether typeof value !== 'object' || value === null before running this branch.
  if (typeof value !== 'object' || value === null) return false
  // Pass Object.entries(value as Record<string, unknown>).some(([key, child]) => { if (containsForbiddenToken back to the caller.
  return Object.entries(value as Record<string, unknown>).some(([key, child]) => {
    // Check whether containsForbiddenToken(key) before running this branch.
    if (containsForbiddenToken(key)) return true
    // Check whether ['model', 'field', 'relation'].includes(key) before running this branch.
    if (['model', 'field', 'relation'].includes(key)) {
      // Check whether typeof child === 'string' && containsForbiddenToken(child) before running this branch.
      if (typeof child === 'string' && containsForbiddenToken(child)) return true
    }
    // Check whether ['select', 'groupBy'].includes(key) && Array.isArray(child) before running this branch.
    if (['select', 'groupBy'].includes(key) && Array.isArray(child)) {
      // Check whether child.some((path) => typeof path === 'string' && containsForbiddenToken(path)) before running this branch.
      if (child.some((path) => typeof path === 'string' && containsForbiddenToken(path))) return true
    }
    // Pass referencesForbiddenData(child) back to the caller.
    return referencesForbiddenData(child)
  })
}

// Define the helper that will contains forbidden token.
function containsForbiddenToken(value: string): boolean {
  // Pass value.split(/[^a-zA-Z0-9]+/).some((part) => forbiddenTokens.has(part.toLowerCase())) back to the caller.
  return value.split(/[^a-zA-Z0-9]+/).some((part) => forbiddenTokens.has(part.toLowerCase()))
}

export class PrivacyPolicyError extends Error {}

// Fail startup if a future allowlist change accidentally introduces a student-facing model.
for (const model of Object.keys(aiSchemaCatalog)) {
  // Check whether containsForbiddenToken(model) before running this branch.
  if (containsForbiddenToken(model)) throw new Error('AI schema catalog violates privacy policy')
}
