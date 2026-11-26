/**
 * Purpose
 * Provide the get application commands logic used by other parts of ESA.
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
  Guild,
  ApplicationCommandManager,
  GuildApplicationCommandManager,
} from 'discord.js'

// Gets all command files registered with the discord bot
const getApplicationCommands = async (
  client: Client,
  guildId?: string
): Promise<ApplicationCommandManager | GuildApplicationCommandManager> => {
  // Define applicationCommands for the steps below.
  let applicationCommands: ApplicationCommandManager | GuildApplicationCommandManager

  // If server exists
  if (guildId) {
    // Define guild for the steps below.
    const guild: Guild = await client.guilds.fetch(guildId)
    // Copies a list of registered server commands to applicationCommands
    applicationCommands = guild.commands
  } else {
    // Fetches global commands
    if (!client.application) {
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('Client application is not available')
    }
    // Update applicationCommands with the value on the right.
    applicationCommands = client.application.commands
  }

  await applicationCommands.fetch({ force: true })
  // Pass applicationCommands back to the caller.
  return applicationCommands
}

export default getApplicationCommands
