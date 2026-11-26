/**
 * Purpose
 * Provide the auth.global logic used by other parts of ESA.
 *
 * Inputs
 * - Values passed by callers and any configuration or records imported here.
 *
 * Outputs
 * - The values, types, or functions exported by this file.
 *
 * Pseudocode
 * Load the dependencies → define the file’s rules or helpers → expose them for other files to use.
 */
import { authClient } from '../utils/auth-client'

export default defineNuxtRouteMiddleware(async (to) => {
  // Check whether import.meta.dev && to.path === '/database-redesign' before running this branch.
  if (import.meta.dev && to.path === '/database-redesign') {
    return
  }
  // Define { data: session } for the steps below.
  const { data: session } = await authClient.useSession(useFetch)

  // Check whether session.value before running this branch.
  if (session.value) {
    // Check whether to.path === '/auth' before running this branch.
    if (to.path === '/auth') {
      // Pass navigateTo('/') back to the caller.
      return navigateTo('/')
    }
    // Check whether !session.value.user.active before running this branch.
    if (!session.value.user.active) {
      // Check whether to.path !== '/inactive' before running this branch.
      if (to.path !== '/inactive') {
        // Pass navigateTo('/inactive') back to the caller.
        return navigateTo('/inactive')
      }
      return
    }
    // Check whether to.path === '/inactive' before running this branch.
    if (to.path === '/inactive') {
      // Pass navigateTo('/') back to the caller.
      return navigateTo('/')
    }
    // Check whether to.path === '/users' && session.value.user.role !== 'ADMIN' before running this branch.
    if (to.path === '/users' && session.value.user.role !== 'ADMIN') {
      // Pass createError({ statusCode: 403, statusMessage: 'Admins only' }) back to the caller.
      return createError({ statusCode: 403, statusMessage: 'Admins only' })
    }
  } else {
    // Check whether to.path !== '/auth' before running this branch.
    if (to.path !== '/auth') {
      // Pass navigateTo('/auth') back to the caller.
      return navigateTo('/auth')
    }
  }
})
