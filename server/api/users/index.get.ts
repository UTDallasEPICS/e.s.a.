/**
 * Purpose
 * Handle requests for the index API operation.
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
import userService from '#server/services/userService'
import { requireAdmin } from '#server/utils/authz'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  // Pass await userService.getAllUsers() back to the caller.
  return await userService.getAllUsers()
})
