/**
 * Purpose
 * Provide the create project discord logic used by other parts of ESA.
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
/**
 * @file createProjectDiscord.ts
 *
 * This file contains the implementation of the `createProjectDiscord` function, which is responsible for creating a project category and associated text and voice channels in a Discord server.
 *
 * The function checks if a category with the specified project name exists. If not, it creates the category. It then checks if a text channel with the specified name exists under the category. If not, it creates the text channel. The function also sets permission overwrites for the created category and channels.
 *
 * @module createProjectDiscord
 */

import {
  Client,
  Guild,
  PermissionFlagsBits,
  CategoryChannel,
  TextChannel,
  ChannelType,
  VoiceChannel,
} from 'discord.js'
import { getClient } from '../utils/clientInstance'
import { ProjectRead } from '#server/services/projectService'

/**
 * Creates a project category, associated text and voice channels, and roles in a Discord server.
 *
 * This function checks if a category with the specified project name exists. If not, it creates the category.
 * It then checks if a text/voice channels with the specified name exists under the category. If not, it creates the text/voice channels.
 * The function also sets permission overwrites for the created category and channels.
 *
 * @param {Project} project - The project object containing details about the project.
 *
 * @throws {Error} If the GUILD_ID environment variable is not defined or if an error occurs while creating the category or channels.
 */
const createProjectDiscord = async (project: ProjectRead) => {
  // Use getClient to initialize client.
  const client = getClient()
  // Define guildId for the steps below.
  const guildId = process.env.GUILD_ID
  // Check whether !guildId before running this branch.
  if (!guildId) {
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error('GUILD_ID is not defined')
  }
  // Get the list of existing channels in the guild
  const guild: Guild = await client.guilds.fetch(guildId)
  // Define existingChannels for the steps below.
  const existingChannels = guild.channels.cache
  // Define projectName for the steps below.
  const projectName = project.name

  // Use projectName.toLowerCase().replace to initialize formattedChannelName.
  const formattedChannelName = projectName.toLowerCase().replace(/\s+/g, '-')

  // Check if a role with the formatted name already exists
  const formattedRoleName = `${projectName} - Current`
  // Use guild.roles.cache.find to initialize projectRole.
  let projectRole = guild.roles.cache.find((role) => role.name === formattedRoleName)

  // Use guild.roles.cache.find to initialize adminRole.
  const adminRole = guild.roles.cache.find((r) => r.name === 'Professor/Faculty/Staff')
  // Check whether !adminRole before running this branch.
  if (!adminRole) {
    // Call console.error to run this step.
    console.error('Role "Professor/Faculty/Staff" not found')
    return
  }

  // If the role doesn't exist, create it
  if (!projectRole) {
    // Update projectRole with the value on the right.
    projectRole = await guild.roles.create({
      name: formattedRoleName,
      permissions: [],
    })
  }

  // Check if a category with the formatted name already exists
  let projectCategory = existingChannels.find(
    (channel) => channel.name === formattedChannelName && channel.type === ChannelType.GuildCategory
  ) as CategoryChannel

  // If the category doesn't exist, create it
  if (!projectCategory) {
    try {
      // Update projectCategory with the value on the right.
      projectCategory = (await guild.channels.create({
        name: formattedChannelName,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: projectRole.id,
            allow: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: adminRole.id,
            allow: [PermissionFlagsBits.ViewChannel],
          },
        ],
      })) as CategoryChannel
      // Call console.log to run this step.
      console.log(`Created category: ${formattedChannelName}`)
    } catch (error) {
      // Call console.error to run this step.
      console.error(`Error creating category ${formattedChannelName}:`, error)
    }
  }

  // If category still doesn't exist (e.g., server hit 500 channel limit), skip channel creation
  if (!projectCategory) {
    // Call console.warn to run this step.
    console.warn(
      `[DiscordBot] Skipping channel creation for ${formattedChannelName} because category is missing (possibly due to channel limit).`
    )
    return
  }

  // Check if a text channel with the formatted name already exists under the category
  const textChannelExists = existingChannels.some(
    (channel) =>
      channel.name === formattedChannelName &&
      channel.parentId === projectCategory.id &&
      channel.type === ChannelType.GuildText
  )

  // If the text channel doesn't exist, create it
  if (!textChannelExists) {
    try {
      await guild.channels.create({
        name: formattedChannelName,
        type: ChannelType.GuildText,
        parent: projectCategory.id,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: projectRole.id,
            allow: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: adminRole.id,
            allow: [PermissionFlagsBits.ViewChannel],
          },
        ],
      })
      // Call console.log to run this step.
      console.log(`Created text channel: ${formattedChannelName}`)
    } catch (error) {
      // Call console.error to run this step.
      console.error(`Error creating text channel ${formattedChannelName}:`, error)
    }
  }

  // Check if a voice channel with the formatted name already exists under the category
  const voiceChannelExists = existingChannels.some(
    (channel) =>
      channel.name === formattedChannelName &&
      channel.parentId === projectCategory.id &&
      channel.type === ChannelType.GuildVoice
  )

  // If the voice channel doesn't exist, create it
  if (!voiceChannelExists) {
    try {
      await guild.channels.create({
        name: formattedChannelName,
        type: ChannelType.GuildVoice,
        parent: projectCategory.id,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: projectRole.id,
            allow: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: adminRole.id,
            allow: [PermissionFlagsBits.ViewChannel],
          },
        ],
      })
      // Call console.log to run this step.
      console.log(`Created voice channel: ${formattedChannelName}`)
    } catch (error) {
      // Call console.error to run this step.
      console.error(`Error creating voice channel ${formattedChannelName}:`, error)
    }
  }
}

// Export the createProjectDiscord function
export default createProjectDiscord
