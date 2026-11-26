/**
 * Purpose
 * Provide the client instance logic used by other parts of ESA.
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
import { Client } from 'discord.js'

// Define client for the steps below.
let client: Client | null = null

// Define setClient for the steps below.
export const setClient = (discordClient: Client) => {
  // Update client with the value on the right.
  client = discordClient
}

// Define getClient for the steps below.
export const getClient = (): Client => {
  // Check whether !client before running this branch.
  if (!client) {
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error('Client has not been initialized.')
  }
  // Pass client back to the caller.
  return client
}
