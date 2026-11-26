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
import contactService from '#server/services/contactService'

export default defineEventHandler(async (event) => {
  // Use getRouterParam to initialize id.
  const id = getRouterParam(event, 'id')
  // Check whether !id before running this branch.
  if (!id) {
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({ statusCode: 400, statusMessage: 'Missing id parameter' })
  }

  // Define contact for the steps below.
  const contact = await contactService.getContactById(id)
  // Check whether !contact before running this branch.
  if (!contact) {
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({ statusCode: 404, statusMessage: 'Contact not found' })
  }

  // Pass contact back to the caller.
  return contact
})
