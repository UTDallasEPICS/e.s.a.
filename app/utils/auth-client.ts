/**
 * Purpose
 * Provide the auth client logic used by other parts of ESA.
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
import { createAuthClient } from 'better-auth/vue'
import { emailOTPClient, inferAdditionalFields } from 'better-auth/client/plugins'
import type { auth } from '#server/utils/auth'

// Use createAuthClient to initialize authClient.
export const authClient = createAuthClient({
  plugins: [emailOTPClient(), inferAdditionalFields<typeof auth>()],
})
