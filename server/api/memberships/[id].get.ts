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
import membershipService from '#server/services/membershipService'

export default defineEventHandler(async (event) => {
  // Use getRouterParam to initialize id.
  const id = getRouterParam(event, 'id')
  // Check whether !id before running this branch.
  if (!id) {
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({ statusCode: 400, statusMessage: 'Missing id parameter' })
  }

  // Define membership for the steps below.
  const membership = await membershipService.getMembershipById(id)
  // Check whether !membership before running this branch.
  if (!membership) {
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({ statusCode: 404, statusMessage: 'Membership not found' })
  }

  // Pass membership back to the caller.
  return membership
})
