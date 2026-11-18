import { authClient } from '../utils/auth-client'

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.dev && to.path === '/database-redesign') {
    return
  }
  const { data: session } = await authClient.useSession(useFetch)

  if (session.value) {
    if (to.path === '/auth') {
      return navigateTo('/')
    }
    if (!session.value.user.active) {
      if (to.path !== '/inactive') {
        return navigateTo('/inactive')
      }
      return
    }
    if (to.path === '/inactive') {
      return navigateTo('/')
    }
    if (to.path === '/users' && session.value.user.role !== 'ADMIN') {
      return createError({ statusCode: 403, statusMessage: 'Admins only' })
    }
  } else {
    if (to.path !== '/auth') {
      return navigateTo('/auth')
    }
  }
})
