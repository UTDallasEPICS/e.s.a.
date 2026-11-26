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
import { teamCreateSchema, parseBody } from '#server/utils/schemas'
import teamService from '#server/services/teamService'

export default defineEventHandler(async (event) => {
  // Define data for the steps below.
  const data = await parseBody(event, teamCreateSchema)
  // Call setResponseStatus to run this step.
  setResponseStatus(event, 201)
  // Pass await teamService.createTeam(data) back to the caller.
  return await teamService.createTeam(data)
})
