/**
 * Purpose
 * Handle requests for the [id] API operation.
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
import teamService from '#server/services/teamService'

export default defineEventHandler(async (event) => {
  // Use getRouterParam to initialize id.
  const id = getRouterParam(event, 'id')
  // Check whether !id before running this branch.
  if (!id) {
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({ statusCode: 400, statusMessage: 'Missing id parameter' })
  }

  // Define team for the steps below.
  const team = await teamService.getTeamById(id)
  // Check whether !team before running this branch.
  if (!team) {
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({ statusCode: 404, statusMessage: 'Team not found' })
  }

  // Pass team back to the caller.
  return team
})
