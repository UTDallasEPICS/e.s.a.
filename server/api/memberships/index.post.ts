import { membershipCreateSchema, parseBody } from '#server/utils/schemas'
import membershipService from '#server/services/membershipService'

export default defineEventHandler(async (event) => {
  const data = await parseBody(event, membershipCreateSchema)
  setResponseStatus(event, 201)
  return await membershipService.createMembership(data)
})
