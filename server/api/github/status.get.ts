/**
 * Purpose
 * Handle requests for the status API operation.
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
import { getGitHubStatus } from '#server/services/githubService'

export default defineEventHandler(async () => {
  // Pass { success: true, data: getGitHubStatus(), timestamp: new Date().toISOString(), } back to the caller.
  return {
    success: true,
    data: getGitHubStatus(),
    timestamp: new Date().toISOString(),
  }
})
