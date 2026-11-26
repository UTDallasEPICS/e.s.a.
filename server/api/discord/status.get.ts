/**
 * Purpose
 * Handle requests for the status API operation.
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
/**
 * API endpoint to get Discord bot status
 * GET /api/discord/status
 */

import { getBotStatus } from '#server/services/discordBotService'

export default defineEventHandler(async (event) => {
  try {
    // Use getBotStatus to initialize status.
    const status = getBotStatus()

    // Pass { success: true, data: { status: status.status, error: status.error, uptime: status.uptime, uptimeFo back to the caller.
    return {
      success: true,
      data: {
        status: status.status,
        error: status.error,
        uptime: status.uptime,
        uptimeFormatted: status.uptime ? formatUptime(status.uptime) : null,
      },
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to get bot status',
    })
  }
})

// Define the helper that will format uptime.
function formatUptime(ms: number): string {
  // Use Math.floor to initialize seconds.
  const seconds = Math.floor(ms / 1000)
  // Use Math.floor to initialize minutes.
  const minutes = Math.floor(seconds / 60)
  // Use Math.floor to initialize hours.
  const hours = Math.floor(minutes / 60)
  // Use Math.floor to initialize days.
  const days = Math.floor(hours / 24)

  // Check whether days > 0 before running this branch.
  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`
  // Check whether hours > 0 before running this branch.
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  // Check whether minutes > 0 before running this branch.
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  // Pass `${seconds}s` back to the caller.
  return `${seconds}s`
}
