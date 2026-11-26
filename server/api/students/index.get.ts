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
import studentService from '#server/services/studentService'

export default defineEventHandler(async (event) => {
  // Use getQuery to initialize { semesterId }.
  const { semesterId } = getQuery<{ semesterId?: string }>(event)
  // Pass await studentService.getAllStudents(semesterId) back to the caller.
  return await studentService.getAllStudents(semesterId)
})
