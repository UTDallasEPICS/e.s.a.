/**
 * Purpose
 * Handle requests for the delete roles API operation.
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
 * API endpoint to delete all project roles created by the bot
 * Deletes all roles with the " - Current" suffix
 */
import { defineEventHandler } from 'h3'
import { getClient } from '../../integrations/discordBot/src/utils/clientInstance'

export default defineEventHandler(async (event) => {
  try {
    // Use getClient to initialize client.
    const client = getClient()
    // Define guildId for the steps below.
    const guildId = process.env.GUILD_ID

    // Check whether !guildId before running this branch.
    if (!guildId) {
      // Pass { success: false, error: 'GUILD_ID is not defined in environment variables', } back to the caller.
      return {
        success: false,
        error: 'GUILD_ID is not defined in environment variables',
      }
    }

    // Fetch the guild
    const guild = await client.guilds.fetch(guildId)

    // Find all roles that end with " - Current"
    const projectRoles = guild.roles.cache.filter((role) => role.name.endsWith(' - Current'))

    // Check whether projectRoles.size === 0 before running this branch.
    if (projectRoles.size === 0) {
      // Pass { success: true, message: 'No project roles found to delete', deletedCount: 0, roles: [], } back to the caller.
      return {
        success: true,
        message: 'No project roles found to delete',
        deletedCount: 0,
        roles: [],
      }
    }

    // Define deletedRoles for the steps below.
    const deletedRoles: string[] = []
    // Define errors for the steps below.
    const errors: { role: string; error: string }[] = []

    // Delete each role
    for (const [roleId, role] of projectRoles) {
      try {
        await role.delete(`Bulk delete via bot management`)
        // Call deletedRoles.push to run this step.
        deletedRoles.push(role.name)
        // Call console.log to run this step.
        console.log(`[DiscordBot] Deleted role: ${role.name}`)
      } catch (error: any) {
        // Define errorMsg for the steps below.
        const errorMsg = error?.message || 'Unknown error'
        // Call errors.push to run this step.
        errors.push({ role: role.name, error: errorMsg })
        // Call console.error to run this step.
        console.error(`[DiscordBot] Failed to delete role ${role.name}:`, errorMsg)
      }
    }

    // Pass { success: true, message: `Deleted ${deletedRoles.length} role(s)`, deletedCount: deletedRoles.lengt back to the caller.
    return {
      success: true,
      message: `Deleted ${deletedRoles.length} role(s)`,
      deletedCount: deletedRoles.length,
      roles: deletedRoles,
      errors: errors.length > 0 ? errors : undefined,
    }
  } catch (error: any) {
    // Call console.error to run this step.
    console.error('[DiscordBot] Error deleting roles:', error)
    // Pass { success: false, error: error?.message || 'Failed to delete roles', } back to the caller.
    return {
      success: false,
      error: error?.message || 'Failed to delete roles',
    }
  }
})
