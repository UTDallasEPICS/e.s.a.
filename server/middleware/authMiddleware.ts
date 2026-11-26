/**
 * Purpose
 * Provide the auth middleware logic used by other parts of ESA.
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
import { auth } from '#server/utils/auth'

// Unauthenticated requests to anything under /api/** get 401, except the public prefixes below.
// Inactive users (active === false) may only reach those same prefixes — everything else 403s. New
// sign-ups start inactive (prisma/schema.prisma User.active) until an admin activates them
// from /users.
//
// /api/auth/** is Better Auth's own handler (sign-in, OTP, get-session) and must stay reachable
// signed out. /api/_nuxt_icon/** is @nuxt/icon's bundle endpoint, which @nuxt/ui hits to render
// icons — gating it would break every icon on the signed-out /auth page.
const PUBLIC_API_PREFIXES = ['/api/auth', '/api/_nuxt_icon']

export default defineEventHandler(async (event) => {
  // Define path for the steps below.
  const path = getRequestURL(event).pathname

  // Check whether !path.startsWith('/api') || PUBLIC_API_PREFIXES.some((p) => path.startsWith(p)) before running this branch.
  if (!path.startsWith('/api') || PUBLIC_API_PREFIXES.some((p) => path.startsWith(p))) {
    return
  }

  // Define session for the steps below.
  const session = await auth.api.getSession({ headers: event.headers })
  // Check whether !session before running this branch.
  if (!session) {
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  // Check whether !session.user.active before running this branch.
  if (!session.user.active) {
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({
      statusCode: 403,
      statusMessage: 'Your account is inactive. Contact an admin for approval.',
    })
  }
})
