/**
 * Purpose
 * Handle requests for the [id].put API operation.
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
import { choiceUpdateSchema, parseBody } from '#server/utils/schemas'
import choiceService from '#server/services/choiceService'

export default defineEventHandler(async (event) => {
  // Use getRouterParam to initialize id.
  const id = getRouterParam(event, 'id')
  // Check whether !id before running this branch.
  if (!id) {
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({ statusCode: 400, statusMessage: 'Missing id parameter' })
  }

  // Define data for the steps below.
  const data = await parseBody(event, choiceUpdateSchema)
  // Pass await choiceService.updateChoice(id, data) back to the caller.
  return await choiceService.updateChoice(id, data)
})
