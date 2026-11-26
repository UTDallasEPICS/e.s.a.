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
import semesterService from '#server/services/semesterService'

export default defineEventHandler(async () => {
  // Pass await semesterService.getAllSemesters() back to the caller.
  return await semesterService.getAllSemesters()
})
