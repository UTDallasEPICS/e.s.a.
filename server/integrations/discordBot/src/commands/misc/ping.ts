/**
 * Purpose
 * Provide the ping logic used by other parts of ESA.
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
import { Client, ChatInputCommandInteraction } from 'discord.js'

// Define pingCommand for the steps below.
const pingCommand = {
  name: 'ping',
  description: 'Replies with the bot ping!',

  callback: async (client: Client, interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply()

    // Define reply for the steps below.
    const reply = await interaction.fetchReply()

    // Define ping for the steps below.
    const ping = reply.createdTimestamp - interaction.createdTimestamp

    // Call interaction.editReply to run this step.
    interaction.editReply(`Pong! Client ${ping}ms | Websocket: ${client.ws.ping}ms`)
  },
}

export default pingCommand
