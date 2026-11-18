import partnerService from '#server/services/partnerService'

export default defineEventHandler(async (event) => {
  const { semesterId } = getQuery<{ semesterId?: string }>(event)
  return await partnerService.getAllPartners(semesterId)
})
