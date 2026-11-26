/**
 * Purpose
 * Handle requests for the restart API operation.
 *
 * Inputs
 * - Request parameters, body, and any session required by the handler.
 *
 * Outputs
 * - The operation’s response or an error with an HTTP status.
 *
 * Pseudocode
 * Read the request → apply the handler’s checks → call the matching operation → return its result.
 */
import { restartDiscordBot } from '#server/services/discordBotService'

export default defineEventHandler(async (event) => {
  try {
    // Define result for the steps below.
    const result = await restartDiscordBot()

    // Pass { success: result.success, message: result.message, timestamp: new Date().toISOString(), } back to the caller.
    return {
      success: result.success,
      message: result.message,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to restart bot',
    })
  }
})
