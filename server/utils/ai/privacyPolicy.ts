import { aiSchemaCatalog } from './schemaCatalog'
import { validateStructuredQueryPlan, type StructuredQueryPlan } from './queryPlan'
const forbiddenTokens = new Set([
  'student', 'students', 'enrollment', 'enrollments', 'membership', 'memberships',
  'choice', 'choices', 'contact', 'contacts', 'email', 'phone', 'password',
  'token', 'credential', 'gender', 'major', 'demographic', 'comment', 'comments',
])

/** Shared server-side policy gate for the isolated v1 executor. */
export function enforceStructuredQueryPrivacy(input: unknown): StructuredQueryPlan {
  if (referencesForbiddenData(input)) {
    throw new PrivacyPolicyError()
  }
  // This derives authority from the runtime-schema-backed explicit allowlist.
  // No student-facing model or relation is included in that catalog.
  return validateStructuredQueryPlan(input)
}

function referencesForbiddenData(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(referencesForbiddenData)
  if (typeof value !== 'object' || value === null) return false
  return Object.entries(value as Record<string, unknown>).some(([key, child]) => {
    if (containsForbiddenToken(key)) return true
    if (['model', 'field', 'relation'].includes(key)) {
      if (typeof child === 'string' && containsForbiddenToken(child)) return true
    }
    if (['select', 'groupBy'].includes(key) && Array.isArray(child)) {
      if (child.some((path) => typeof path === 'string' && containsForbiddenToken(path))) return true
    }
    return referencesForbiddenData(child)
  })
}

function containsForbiddenToken(value: string): boolean {
  return value.split(/[^a-zA-Z0-9]+/).some((part) => forbiddenTokens.has(part.toLowerCase()))
}

export class PrivacyPolicyError extends Error {}

// Fail startup if a future allowlist change accidentally introduces a student-facing model.
for (const model of Object.keys(aiSchemaCatalog)) {
  if (containsForbiddenToken(model)) throw new Error('AI schema catalog violates privacy policy')
}
