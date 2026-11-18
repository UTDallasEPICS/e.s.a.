import { partnerUpdateSchema, parseBody } from '#server/utils/schemas'
import partnerService from '#server/services/partnerService'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id parameter' })
  }

  const data = await parseBody(event, partnerUpdateSchema)
  return await partnerService.updatePartner(id, data)
})
