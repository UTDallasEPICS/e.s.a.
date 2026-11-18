import projectService from '#server/services/projectService'

export default defineEventHandler(async (event) => {
  const { semesterId } = getQuery<{ semesterId?: string }>(event)
  return await projectService.getAllProjects(semesterId)
})
