import studentService from '#server/services/studentService'

export default defineEventHandler(async (event) => {
  const { semesterId } = getQuery<{ semesterId?: string }>(event)
  return await studentService.getAllStudents(semesterId)
})
