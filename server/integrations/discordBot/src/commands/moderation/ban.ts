/**
 * Purpose
 * Provide the ban logic used by other parts of ESA.
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
import {
  Client,
  ChatInputCommandInteraction,
  ApplicationCommandOptionType,
  PermissionFlagsBits,
  GuildMember,
} from 'discord.js'

// Define banCommand for the steps below.
const banCommand = {
  name: 'ban',
  description: 'Bans a user from the server',
  options: [
    {
      name: 'target-user',
      description: 'The user to ban',
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: 'reason',
      description: 'The reason for the ban',
      type: ApplicationCommandOptionType.String,
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
    // Define targetUserId for the steps below.
    const targetUserId = interaction.options.get('target-user')?.value as string
    // Define reason for the steps below.
    const reason = (interaction.options.get('reason')?.value as string) || 'No reason provided'

    await interaction.deferReply()

    // Define targetUser for the steps below.
    const targetUser = await interaction.guild?.members.fetch(targetUserId)

    // Check whether !targetUser before running this branch.
    if (!targetUser) {
      // Call interaction.editReply to run this step.
      interaction.editReply('User not found.')
      return
    }

    try {
      await targetUser.ban({ reason })
      await interaction.editReply(`User ${targetUser.user.tag} was banned\nReason: ${reason}`)
    } catch (error) {
      // Call console.log to run this step.
      console.log(`There was an error when banning: ${error}`)
      await interaction.editReply(`There was an error when banning: ${error}`)
    }
  },
}

export default banCommand
