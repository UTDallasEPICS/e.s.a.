/**
 * Purpose
 * Handle requests for the delete channels API operation.
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
import { getClient } from '#server/integrations/discordBot/src/utils/clientInstance'
import { ChannelType } from 'discord.js'

export default defineEventHandler(async (event) => {
  try {
    // Use getClient to initialize client.
    const client = getClient()
    // Check whether !client || !client.isReady() before running this branch.
    if (!client || !client.isReady()) {
      // Stop this operation and tell the caller why it cannot continue.
      throw createError({
        statusCode: 503,
        statusMessage: 'Service Unavailable',
        message: 'Discord bot is not ready',
      })
    }

    // Define guildId for the steps below.
    const guildId = process.env.GUILD_ID
    // Check whether !guildId before running this branch.
    if (!guildId) {
      // Stop this operation and tell the caller why it cannot continue.
      throw createError({
        statusCode: 500,
        statusMessage: 'Configuration Error',
        message: 'GUILD_ID is not defined',
      })
    }

    // Define guild for the steps below.
    const guild = await client.guilds.fetch(guildId)

    // Categories to preserve (case-insensitive)
    const preservedCategories = ['information', 'text channels', 'voice channels', 'projects']

    // Channels to preserve (case-insensitive) - standard server channels not in categories
    const preservedChannels = [
      'general',
      'welcome-and-rules',
      'announcements',
      'resources',
      'meeting-plans',
      'off-topic',
      'bot-development',
      'lounge',
      'meeting room 1',
      'meeting room 2',
      'events',
    ]

    // Define deletedCategories for the steps below.
    let deletedCategories = 0
    // Define deletedTextChannels for the steps below.
    let deletedTextChannels = 0
    // Define deletedVoiceChannels for the steps below.
    let deletedVoiceChannels = 0
    // Define errors for the steps below.
    const errors: Array<{ channel: string; error: string }> = []
    // Define deletedChannels for the steps below.
    const deletedChannels: string[] = []

    // First, delete orphaned channels (channels without a parent category)
    const orphanedChannels = guild.channels.cache.filter(
      (channel) =>
        !channel.parentId &&
        (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildVoice) &&
        !preservedChannels.includes(channel.name.toLowerCase())
    )

    // Call console.log to run this step.
    console.log(`Found ${orphanedChannels.size} orphaned channels to delete`)

    // Repeat the following steps for each item in orphanedChannels.
    for (const [, channel] of orphanedChannels) {
      try {
        await channel.delete(`Bulk delete orphaned project channels`)
        // Call deletedChannels.push to run this step.
        deletedChannels.push(channel.name)

        // Check whether channel.type === ChannelType.GuildText before running this branch.
        if (channel.type === ChannelType.GuildText) {
          deletedTextChannels++
        } else if (channel.type === ChannelType.GuildVoice) {
          deletedVoiceChannels++
        }
        // Call console.log to run this step.
        console.log(`Deleted orphaned channel: ${channel.name}`)
      } catch (err: any) {
        // Call console.error to run this step.
        console.error(`Failed to delete orphaned channel ${channel.name}:`, err?.message)
        // Call errors.push to run this step.
        errors.push({
          channel: channel.name,
          error: err?.message || 'Unknown error',
        })
      }
    }

    // Get all categories in the guild
    const categories = guild.channels.cache.filter(
      (channel) => channel.type === ChannelType.GuildCategory
    )

    // Call console.log to run this step.
    console.log(`Found ${categories.size} total categories`)

    // Repeat the following steps for each item in categories.
    for (const [, category] of categories) {
      // Skip preserved categories
      if (preservedCategories.includes(category.name.toLowerCase())) {
        // Call console.log to run this step.
        console.log(`Skipping preserved category: ${category.name}`)
        continue
      }

      try {
        // First, delete all channels within this category
        const channelsInCategory = guild.channels.cache.filter(
          (channel) => channel.parentId === category.id
        )

        // Call console.log to run this step.
        console.log(`Category "${category.name}" has ${channelsInCategory.size} child channels`)

        // Repeat the following steps for each item in channelsInCategory.
        for (const [, channel] of channelsInCategory) {
          try {
            await channel.delete(`Bulk delete via bot management`)
            // Call deletedChannels.push to run this step.
            deletedChannels.push(channel.name)

            // Check whether channel.type === ChannelType.GuildText before running this branch.
            if (channel.type === ChannelType.GuildText) {
              deletedTextChannels++
            } else if (channel.type === ChannelType.GuildVoice) {
              deletedVoiceChannels++
            }
            // Call console.log to run this step.
            console.log(`  Deleted channel: ${channel.name}`)
          } catch (err: any) {
            // Call console.error to run this step.
            console.error(`  Failed to delete channel ${channel.name}:`, err?.message)
            // Call errors.push to run this step.
            errors.push({
              channel: channel.name,
              error: err?.message || 'Unknown error',
            })
          }
        }

        // Then delete the category itself
        await category.delete(`Bulk delete via bot management`)
        deletedCategories++
        // Call deletedChannels.push to run this step.
        deletedChannels.push(category.name)
        // Call console.log to run this step.
        console.log(`Deleted category: ${category.name}`)
      } catch (err: any) {
        // Call console.error to run this step.
        console.error(`Failed to delete category ${category.name}:`, err?.message)
        // Call errors.push to run this step.
        errors.push({
          channel: category.name,
          error: err?.message || 'Unknown error',
        })
      }
    }

    // Define totalDeleted for the steps below.
    const totalDeleted = deletedCategories + deletedTextChannels + deletedVoiceChannels

    // Pass { success: errors.length === 0, message: errors.length === 0 ? `Successfully deleted ${totalDeleted} back to the caller.
    return {
      success: errors.length === 0,
      message:
        errors.length === 0
          ? `Successfully deleted ${totalDeleted} channels (${deletedCategories} categories, ${deletedTextChannels} text, ${deletedVoiceChannels} voice)`
          : `Deleted ${totalDeleted} channels with ${errors.length} errors`,
      deletedCount: totalDeleted,
      categories: deletedCategories,
      textChannels: deletedTextChannels,
      voiceChannels: deletedVoiceChannels,
      channels: deletedChannels,
      errors,
    }
  } catch (error: any) {
    // Call console.error to run this step.
    console.error('Error deleting Discord channels:', error)
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: error?.message || 'Failed to delete Discord channels',
    })
  }
})
