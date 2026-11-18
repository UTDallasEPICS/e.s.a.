import { enrollmentCreateSchema, parseBody } from '#server/utils/schemas'
import enrollmentService from '#server/services/enrollmentService'

export default defineEventHandler(async (event) => {
  const data = await parseBody(event, enrollmentCreateSchema)
  setResponseStatus(event, 201)
  return await enrollmentService.createEnrollment(data)
})
