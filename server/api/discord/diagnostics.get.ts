/**
 * Purpose
 * Handle requests for the diagnostics API operation.
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
 * API endpoint to get Discord bot diagnostics
 * GET /api/discord/diagnostics
 */
import { getClient } from '#server/integrations/discordBot/src/utils/clientInstance'

export default defineEventHandler(async (event) => {
  try {
    // Use getClient to initialize client.
    const client = getClient()

    // Check whether !client before running this branch.
    if (!client) {
      // Pass { error: 'Discord client not initialized', isReady: false, } back to the caller.
      return {
        error: 'Discord client not initialized',
        isReady: false,
      }
    }

    // Define guildId for the steps below.
    const guildId = process.env.GUILD_ID
    // Check whether !guildId before running this branch.
    if (!guildId) {
      // Pass { error: 'GUILD_ID environment variable not set', isReady: client.isReady(), user: client.user?.tag, back to the caller.
      return {
        error: 'GUILD_ID environment variable not set',
        isReady: client.isReady(),
        user: client.user?.tag,
      }
    }

    // Define guild for the steps below.
    let guild
    try {
      // Update guild with the value on the right.
      guild = await client.guilds.fetch(guildId)
    } catch (err: any) {
      // Pass { error: `Failed to fetch guild: ${err.message}`, isReady: client.isReady(), user: client.user?.tag, back to the caller.
      return {
        error: `Failed to fetch guild: ${err.message}`,
        isReady: client.isReady(),
        user: client.user?.tag,
        guildId,
      }
    }

    // Get bot member in the guild
    const botMember = await guild.members.fetch(client.user!.id)

    // Check permissions
    const permissions = botMember.permissions
    // Use permissions.has to initialize hasManageChannels.
    const hasManageChannels = permissions.has('ManageChannels')
    // Use permissions.has to initialize hasManageRoles.
    const hasManageRoles = permissions.has('ManageRoles')
    // Use permissions.has to initialize hasViewChannels.
    const hasViewChannels = permissions.has('ViewChannel')

    // Get channel counts
    const channels = guild.channels.cache
    // Define categories for the steps below.
    const categories = channels.filter((c) => c.type === 4).size // CategoryChannel
    // Define textChannels for the steps below.
    const textChannels = channels.filter((c) => c.type === 0).size // TextChannel
    // Define voiceChannels for the steps below.
    const voiceChannels = channels.filter((c) => c.type === 2).size // VoiceChannel
    // Define totalChannels for the steps below.
    const totalChannels = channels.size

    // Get role info
    const roles = guild.roles.cache
    // Use roles.filter to initialize projectRoles.
    const projectRoles = roles.filter((r) => r.name.endsWith(' - Current'))
    // Use roles.some to initialize hasAdminRole.
    const hasAdminRole = roles.some((r) => r.name === 'Professor/Faculty/Staff')

    // Pass { success: true, bot: { tag: client.user?.tag, isReady: client.isReady(), }, guild: { name: guild.na back to the caller.
    return {
      success: true,
      bot: {
        tag: client.user?.tag,
        isReady: client.isReady(),
      },
      guild: {
        name: guild.name,
        memberCount: guild.memberCount,
      },
      permissions: {
        manageChannels: hasManageChannels,
        manageRoles: hasManageRoles,
        viewChannel: hasViewChannels,
      },
      channels: {
        total: totalChannels,
        categories,
        text: textChannels,
        voice: voiceChannels,
        remaining: 500 - totalChannels,
      },
      roles: {
        total: roles.size,
        projectRoles: projectRoles.size,
        hasAdminRole,
      },
    }
  } catch (error: any) {
    // Pass { error: error?.message || 'Unknown error', stack: error?.stack, } back to the caller.
    return {
      error: error?.message || 'Unknown error',
      stack: error?.stack,
    }
  }
})
