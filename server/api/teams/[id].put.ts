import { teamUpdateSchema, parseBody } from '#server/utils/schemas'
import teamService from '#server/services/teamService'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id parameter' })
  }

  const data = await parseBody(event, teamUpdateSchema)
  return await teamService.updateTeam(id, data)
})
