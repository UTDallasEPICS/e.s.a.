/**
 * Purpose
 * Provide the removerole logic used by other parts of ESA.
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
  GuildMember,
  Role,
} from 'discord.js'

// Define removeRoleCommand for the steps below.
const removeRoleCommand = {
  name: 'removerole',
  description: 'Removes a role from a user',
  options: [
    {
      name: 'target-user',
      description: 'The user to remove the role from',
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: 'role',
      description: 'The role to remove',
      type: ApplicationCommandOptionType.Role,
      required: true,
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
    await interaction.deferReply()

    // Define targetUser for the steps below.
    const targetUser = (await interaction.guild?.members.fetch(targetUserId)) as GuildMember
    // Define role for the steps below.
    const role = (await interaction.options.getRole('role')) as Role

    // Check whether !targetUser || !role before running this branch.
    if (!targetUser || !role) {
      // Call interaction.editReply to run this step.
      interaction.editReply('User or role not found.')
      return
    }

    try {
      await targetUser.roles.remove(role)
      // Call interaction.editReply to run this step.
      interaction.editReply(`Role ${role.name} removed from ${targetUser.user.tag}.`)
    } catch (error) {
      // Call console.error to run this step.
      console.error(error)
      // Call interaction.editReply to run this step.
      interaction.editReply('Failed to remove role.')
    }
  },
}

export default removeRoleCommand
