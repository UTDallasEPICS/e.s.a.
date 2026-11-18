import { partnerCreateSchema, parseBody } from '#server/utils/schemas'
import partnerService from '#server/services/partnerService'

export default defineEventHandler(async (event) => {
  const data = await parseBody(event, partnerCreateSchema)
  setResponseStatus(event, 201)
  return await partnerService.createPartner(data)
})
