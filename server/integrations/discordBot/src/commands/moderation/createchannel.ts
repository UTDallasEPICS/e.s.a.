/**
 * Purpose
 * Provide the createchannel logic used by other parts of ESA.
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
import { ApplicationCommandOptionType, ChatInputCommandInteraction, Client } from 'discord.js'

// Define createChannelCommand for the steps below.
const createChannelCommand = {
  name: 'createchannel',
  description: 'Creates a new channel',
  options: [
    {
      name: 'name',
      description: 'The name of the channel',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: 'category',
      description: 'The category to create the channel in',
      type: ApplicationCommandOptionType.Channel,
      required: false,
    },
  ],
  defaultPermission: false,
  permissions: [
    {
      id: 'ROLE_ID', // Replace with the actual role ID that should have permission
      type: 'ROLE',
      permission: true,
    },
  ],

  /**
   * @param {Client} client
   * @param {ChatInputCommandInteraction} interaction
   */
  callback: async (client: Client, interaction: ChatInputCommandInteraction) => {
    // Defer the reply to give us time to process
    await interaction.deferReply()

    // Extract the name of the channel from the command options
    const channelName = interaction.options.getString('name')
    // Use interaction.options.getChannel to initialize categoryId.
    const categoryId = interaction.options.getChannel('category')

    try {
      // Create the new channel
      const newChannel = await interaction.guild?.channels.create({
        name: channelName!,
        parent: categoryId?.id,
      })

      // Call interaction.editReply to run this step.
      interaction.editReply(`Channel ${newChannel?.name} created successfully.`)
    } catch (error) {
      // Call console.error to run this step.
      console.error(error)
      // Call interaction.editReply to run this step.
      interaction.editReply('Failed to create channel.')
    }
  },
}

export default createChannelCommand
