/**
 * Purpose
 * Handle requests for the connect API operation.
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
import { connectGitHub } from '#server/services/githubService'

export default defineEventHandler(async () => {
  // Define result for the steps below.
  const result = await connectGitHub()
  // Pass { success: result.success, message: result.message, username: result.username, timestamp: new Date() back to the caller.
  return {
    success: result.success,
    message: result.message,
    username: result.username,
    timestamp: new Date().toISOString(),
  }
})
