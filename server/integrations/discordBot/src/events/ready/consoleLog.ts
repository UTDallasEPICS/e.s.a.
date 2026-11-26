/**
 * Purpose
 * Provide the console log logic used by other parts of ESA.
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
//Console logs when the bot comes online

import { Client } from 'discord.js'

export default (client: Client) => {
  // Call console.log to run this step.
  console.log(`${client.user?.tag} is online.`)
}
