import { projectUpdateSchema, parseBody } from '#server/utils/schemas'
import projectService from '#server/services/projectService'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id parameter' })
  }

  const data = await parseBody(event, projectUpdateSchema)
  return await projectService.updateProject(id, data)
})
