import { contactUpdateSchema, parseBody } from '#server/utils/schemas'
import contactService from '#server/services/contactService'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id parameter' })
  }

  const data = await parseBody(event, contactUpdateSchema)
  return await contactService.updateContact(id, data)
})
