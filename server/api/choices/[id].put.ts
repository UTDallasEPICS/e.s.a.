import { choiceUpdateSchema, parseBody } from '#server/utils/schemas'
import choiceService from '#server/services/choiceService'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id parameter' })
  }

  const data = await parseBody(event, choiceUpdateSchema)
  return await choiceService.updateChoice(id, data)
})
