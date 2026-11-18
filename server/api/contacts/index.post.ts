import { contactCreateSchema, parseBody } from '#server/utils/schemas'
import contactService from '#server/services/contactService'

export default defineEventHandler(async (event) => {
  const data = await parseBody(event, contactCreateSchema)
  setResponseStatus(event, 201)
  return await contactService.createContact(data)
})
