/**
 * Purpose
 * Handle requests for the [...all] API operation.
 *
 * Inputs
 * - Request parameters, body, and any session required by the handler.
 *
 * Outputs
 * - The operation’s response or an error with an HTTP status.
 *
 * Pseudocode
 * Read the request → apply the handler’s checks → call the matching operation → return its result.
 */
import { auth } from '#server/utils/auth'

export default defineEventHandler((event) => {
  // Pass auth.handler(toWebRequest(event)) back to the caller.
  return auth.handler(toWebRequest(event))
})
