import { semesterCreateSchema, parseBody } from '#server/utils/schemas'
import semesterService from '#server/services/semesterService'

export default defineEventHandler(async (event) => {
  const data = await parseBody(event, semesterCreateSchema)
  setResponseStatus(event, 201)
  return await semesterService.createSemester(data)
})
