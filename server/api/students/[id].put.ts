import { studentUpdateSchema, parseBody } from '#server/utils/schemas'
import studentService from '#server/services/studentService'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id parameter' })
  }

  const data = await parseBody(event, studentUpdateSchema)
  return await studentService.updateStudent(id, data)
})
