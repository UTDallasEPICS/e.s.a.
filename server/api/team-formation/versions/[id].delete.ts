/**
 * DELETE /api/team-formation/versions/:id
 * Deletes a saved version. The board is left as it is.
 */

import teamVersionService from '#server/services/teamVersionService'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'id is required.' })
  }
  try {
    await teamVersionService.deleteVersion(id)
  } catch {
    throw createError({ statusCode: 404, message: 'Version not found.' })
  }
  return { ok: true }
})
