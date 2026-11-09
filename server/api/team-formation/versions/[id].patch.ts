/**
 * PATCH /api/team-formation/versions/:id
 * Sets a version's description, e.g. "Mentor approved".
 * Body: { note: string }
 */

import teamVersionService from '#server/services/teamVersionService'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const { note } = await readBody<{ note: string }>(event)
  const description = typeof note === 'string' ? note.trim().slice(0, 80) : ''
  if (!id || !description) {
    throw createError({ statusCode: 400, message: 'A description is required.' })
  }
  await teamVersionService.describeVersion(id, description)
  return { ok: true }
})
