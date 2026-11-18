import { teamCreateSchema, parseBody } from '#server/utils/schemas'
import teamService from '#server/services/teamService'

export default defineEventHandler(async (event) => {
  const data = await parseBody(event, teamCreateSchema)
  setResponseStatus(event, 201)
  return await teamService.createTeam(data)
})
