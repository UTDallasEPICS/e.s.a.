import { projectCreateSchema, parseBody } from '#server/utils/schemas'
import projectService from '#server/services/projectService'

export default defineEventHandler(async (event) => {
  const data = await parseBody(event, projectCreateSchema)
  setResponseStatus(event, 201)
  return await projectService.createProject(data)
})
