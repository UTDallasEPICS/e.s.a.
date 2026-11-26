/**
 * Purpose
 * Provide the timeout logic used by other parts of ESA.
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

// Define timeoutCommand for the steps below.
const timeoutCommand = {
  name: 'timeout',
  description: 'Timeout a user for a specified duration',
  options: [
    {
      name: 'target-user',
      description: 'The user to timeout',
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: 'duration',
      description: 'The duration of the timeout in minutes',
      type: ApplicationCommandOptionType.Integer,
      required: true,
    },
    {
      name: 'reason',
      description: 'The reason for the timeout',
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
    const targetUserId = interaction.options.get('target-user')!.value as string
    // Define timeoutDuration for the steps below.
    const timeoutDuration = interaction.options.get('duration')!.value as number // Duration in minutes
    // Define reason for the steps below.
    const reason = (interaction.options.get('reason')?.value as string) || 'No reason provided'

    await interaction.deferReply()

    // Check whether !interaction.guild before running this branch.
    if (!interaction.guild) {
      await interaction.editReply('This command can only be used in a server.')
      return
    }

    // Define targetUser for the steps below.
    const targetUser = (await interaction.guild.members.fetch(targetUserId)) as GuildMember

    // Check whether !targetUser before running this branch.
    if (!targetUser) {
      await interaction.editReply('User not found.')
      return
    }

    try {
      await targetUser.timeout(timeoutDuration * 60 * 1000, reason) // Convert minutes to milliseconds
      await interaction.editReply(
        `User ${targetUser.user.tag} has been timed out for ${timeoutDuration} minutes. Reason: ${reason}`
      )
    } catch (error) {
      // Call console.error to run this step.
      console.error(error)
      await interaction.editReply('Failed to timeout user.')
    }
  },
}

export default timeoutCommand
