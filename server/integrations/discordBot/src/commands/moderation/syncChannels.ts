/**
 * Purpose
 * Provide the sync channels logic used by other parts of ESA.
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
import { Client, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js'
import projectService from '#server/services/projectService'

// Define syncChannelsCommand for the steps below.
const syncChannelsCommand = {
  name: 'sync-projects',
  description: 'Sync project names from the database with Discord text channels.',
  options: [],
  permissionsRequired: [PermissionFlagsBits.ManageChannels],
  botPermissions: [PermissionFlagsBits.ManageChannels],

  /**
   * Syncs project names from the database with Discord text channels.
   * @param {Client} client - The Discord client.
   * @param {Interaction} interaction - The interaction object from the slash command.
   */
  callback: async (client: Client, interaction: ChatInputCommandInteraction) => {
    try {
      // Defer the reply to give the bot time to process
      await interaction.deferReply()

      // Check whether !interaction.guild before running this branch.
      if (!interaction.guild) {
        await interaction.editReply('This command can only be used in a server.')
        return
      }

      // Define projects for the steps below.
      const projects = await projectService.getAllProjects()
      // Use projects.map to initialize projectNames.
      const projectNames = projects.map((project) => project.name)

      // Get the list of existing channels in the guild
      const existingChannels = interaction.guild?.channels.cache

      // Loop through each project name
      for (const projectName of projectNames) {
        // Convert project name to Discord channel format (replace spaces with hyphens and make lowercase)
        const formattedChannelName = projectName.toLowerCase().replace(/\s+/g, '-')

        // Check if a channel with the formatted name already exists
        const channelExists = existingChannels?.some(
          (channel) => channel.name === formattedChannelName
        )

        // Find or create the "projects" category
        let projectsCategory = interaction.guild?.channels.cache.find(
          (channel) => channel.name === 'projects' && channel.type === 4 // 4 represents a category in Discord.js v14
        )

        // Check whether !projectsCategory before running this branch.
        if (!projectsCategory) {
          // Update projectsCategory with the value on the right.
          projectsCategory = await interaction.guild.channels.create({
            name: 'projects',
            type: 4, // 4 represents a category
            reason: 'Category for project channels',
          })
        }

        // If the channel doesn't exist, create it under the "projects" category
        if (!channelExists) {
          try {
            await interaction.guild.channels.create({
              name: formattedChannelName,
              type: 0, // 0 represents a text channel
              parent: projectsCategory.id, // Set the parent to the "projects" category
              reason: `Channel created for project: ${projectName}`,
            })
            // Call console.log to run this step.
            console.log(`Created new channel: ${formattedChannelName} under "projects" category`)
          } catch (error) {
            // Call console.error to run this step.
            console.error(`Error creating channel for project ${projectName}:`, error)
          }
        } else {
          // Call console.log to run this step.
          console.log(`Channel already exists for project: ${projectName}`)
        }
      }

      // Reply to the interaction once the process is complete
      await interaction.editReply('Project channels have been synced successfully.')
    } catch (error) {
      // Call console.error to run this step.
      console.error('Error syncing projects with channels:', error)
      await interaction.editReply('There was an error syncing project channels.')
    }
  },
}

export default syncChannelsCommand
