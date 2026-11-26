/**
 * Purpose
 * Provide the authz logic used by other parts of ESA.
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
import type { H3Event } from 'h3'
import { auth } from './auth'

// Throws 401/403 and otherwise returns the session for the requesting user,
// who must be signed in with an ADMIN role.
export async function requireAdmin(event: H3Event) {
  // Define session for the steps below.
  const session = await auth.api.getSession({ headers: event.headers })

  // Check whether !session before running this branch.
  if (!session) {
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  // Check whether session.user.role !== 'ADMIN' before running this branch.
  if (session.user.role !== 'ADMIN') {
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  // Pass session back to the caller.
  return session
}
