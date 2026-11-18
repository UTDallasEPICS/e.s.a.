import { choiceCreateSchema, parseBody } from '#server/utils/schemas'
import choiceService from '#server/services/choiceService'

export default defineEventHandler(async (event) => {
  const data = await parseBody(event, choiceCreateSchema)
  setResponseStatus(event, 201)
  return await choiceService.createChoice(data)
})
