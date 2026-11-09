/**
 * POST /api/team-formation/versions/restore
 * Puts a saved version back on the board. The board is saved as a version first,
 * so going back never loses the arrangement it replaces.
 * Body: { id: string }
 */

import teamVersionService from '#server/services/teamVersionService'

export default defineEventHandler(async (event) => {
  const { id } = await readBody<{ id: string }>(event)
  if (!id) {
    throw createError({ statusCode: 400, message: 'id is required.' })
  }
  try {
    await teamVersionService.restoreVersion(id)
  } catch (e: any) {
    if (e?.message === 'Version not found.') throw createError({ statusCode: 404, message: e.message })
    throw e
  }
  return { ok: true }
})
