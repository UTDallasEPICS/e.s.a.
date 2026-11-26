/**
 * Purpose
 * Handle requests for the disconnect API operation.
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
import { disconnectGitHub } from '#server/services/githubService'

export default defineEventHandler(async () => {
  // Define result for the steps below.
  const result = await disconnectGitHub()
  // Pass { success: result.success, message: result.message, timestamp: new Date().toISOString(), } back to the caller.
  return {
    success: result.success,
    message: result.message,
    timestamp: new Date().toISOString(),
  }
})
