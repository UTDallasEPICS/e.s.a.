import { studentCreateSchema, parseBody } from '#server/utils/schemas'
import studentService from '#server/services/studentService'

export default defineEventHandler(async (event) => {
  const data = await parseBody(event, studentCreateSchema)
  setResponseStatus(event, 201)
  return await studentService.createStudent(data)
})
