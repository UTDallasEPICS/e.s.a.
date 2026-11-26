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
import { semesterCreateSchema, parseBody } from '#server/utils/schemas'
import semesterService from '#server/services/semesterService'

export default defineEventHandler(async (event) => {
  // Define data for the steps below.
  const data = await parseBody(event, semesterCreateSchema)
  // Call setResponseStatus to run this step.
  setResponseStatus(event, 201)
  // Pass await semesterService.createSemester(data) back to the caller.
  return await semesterService.createSemester(data)
})
