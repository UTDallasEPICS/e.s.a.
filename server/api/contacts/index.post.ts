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
import { contactCreateSchema, parseBody } from '#server/utils/schemas'
import contactService from '#server/services/contactService'

export default defineEventHandler(async (event) => {
  // Define data for the steps below.
  const data = await parseBody(event, contactCreateSchema)
  // Call setResponseStatus to run this step.
  setResponseStatus(event, 201)
  // Pass await contactService.createContact(data) back to the caller.
  return await contactService.createContact(data)
})
