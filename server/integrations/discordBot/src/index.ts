/**
 * Purpose
 * Provide the index logic used by other parts of ESA.
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
/*
S.C.I.P.E. - Smart Computer Interface for Protocol Execution
Created by: Alex Quigley
*/
import dotenv from 'dotenv'
import { Client, IntentsBitField } from 'discord.js'
import eventHandler from './handlers/eventHandler'
import { setClient } from './utils/clientInstance'

// Call dotenv.config to run this step.
dotenv.config()

// Define client for the steps below.
const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
  ],
})

// Call eventHandler to run this step.
eventHandler(client)
// Call setClient to run this step.
setClient(client)

// Call client.login to run this step.
client.login(process.env.TOKEN)
