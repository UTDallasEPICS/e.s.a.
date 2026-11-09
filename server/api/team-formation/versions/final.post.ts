/**
 * POST /api/team-formation/versions/final
 * Makes a version final (it goes on the board and every team is locked), or takes
 * the final mark off again (final: false), putting back the version's own locks.
 * Body: { id: string, final: boolean }
 */

import teamVersionService from '#server/services/teamVersionService'

export default defineEventHandler(async (event) => {
  const { id, final } = await readBody<{ id: string; final: boolean }>(event)
  if (!id || typeof final !== 'boolean') {
    throw createError({ statusCode: 400, message: 'id and final are required.' })
  }
  try {
    if (final) await teamVersionService.markFinal(id)
    else await teamVersionService.unmarkFinal(id)
  } catch (e: any) {
    if (e?.message === 'Version not found.') throw createError({ statusCode: 404, message: e.message })
    throw e
  }
  return { ok: true }
})
