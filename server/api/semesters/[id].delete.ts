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
import semesterService from '#server/services/semesterService'

export default defineEventHandler(async (event) => {
  // Use getRouterParam to initialize id.
  const id = getRouterParam(event, 'id')
  // Check whether !id before running this branch.
  if (!id) {
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({ statusCode: 400, statusMessage: 'Missing id parameter' })
  }

  try {
    await semesterService.deleteSemester(id)
  } catch (err) {
    // Define message for the steps below.
    const message = err instanceof Error ? err.message : 'Failed to delete semester.'
    // Define statusCode for the steps below.
    const statusCode = message === 'Semester not found.' ? 404 : 400
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({ statusCode, message })
  }
  // Pass null back to the caller.
  return null
})
