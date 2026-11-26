/**
 * Purpose
 * Provide the handle commands logic used by other parts of ESA.
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
// This file handles all slash commands

import type { Client, Interaction, GuildMember } from 'discord.js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'
import getLocalCommands from '../../utils/getLocalCommands.js'

// Convert import.meta.url to __dirname equivalent
const __filename = fileURLToPath(import.meta.url)
// Use dirname to initialize __dirname.
const __dirname = dirname(__filename)

// Read and parse the config.json file
const configPath = join(__dirname, '../../../config.json')
// Use JSON.parse to initialize config.
const config = JSON.parse(readFileSync(configPath, 'utf-8'))

// Destructure the necessary fields from the config object
const { devs, testServer } = config

export default async (client: Client, interaction: Interaction) => {
  //Is the interaction a chat-input command
  if (!interaction.isChatInputCommand()) return

  //Imports local commands
  const localCommands = await getLocalCommands()

  //Check if command matches local commands
  try {
    //Checks if command names match
    const commandObject = localCommands.find(
      (cmd: { name: string }) => cmd.name === interaction.commandName
    )

    //console.log(commandObject?.name);

    //Checks if commandObject exists
    if (!commandObject) return

    //Checks if command has "Dev Only" set to true,
    //if so, checks to make sure person running command has
    //developer permissions.
    if (commandObject.devOnly) {
      // Check whether !interaction.member || !devs.includes((interaction.member as GuildMember).id) before running this branch.
      if (!interaction.member || !devs.includes((interaction.member as GuildMember).id)) {
        // Call interaction.reply to run this step.
        interaction.reply({
          content: 'Only developers are allowed to run this command.',
          //Only person running command can see message
          ephemeral: true,
        })
        return
      }
    }

    //Checks if command has "Test Only" set to true,
    //if so, checks if the server is a test server.
    //if server isnt a test serevr, bot does not run command.
    if (commandObject.testOnly) {
      // Check whether !interaction.guild || interaction.guild.id !== testServer before running this branch.
      if (!interaction.guild || interaction.guild.id !== testServer) {
        // Call interaction.reply to run this step.
        interaction.reply({
          content: 'This command cannot be ran here.',
          ephemeral: true,
        })
        return
      }
    }

    //Checks if person runnig command has required permissions
    if (commandObject.permissionsRequired?.length) {
      // Repeat the following steps for each item in commandObject.permissionsRequired.
      for (const permission of commandObject.permissionsRequired) {
        // Check whether !interaction.member || !(interaction.member as GuildMember).permissions.has(permission) before running this branch.
        if (
          !interaction.member ||
          !(interaction.member as GuildMember).permissions.has(permission)
        ) {
          // Call interaction.reply to run this step.
          interaction.reply({
            content: 'Not enough permissions.',
            ephemeral: true,
          })
          return
        }
      }
    }

    //Checks if bot has permissions to run command
    if (commandObject.botPermissions?.length) {
      // Repeat the following steps for each item in commandObject.botPermissions.
      for (const permission of commandObject.botPermissions) {
        // Define bot for the steps below.
        const bot = interaction.guild?.members.me
        // Check whether !bot before running this branch.
        if (!bot) {
          // Call interaction.reply to run this step.
          interaction.reply({
            content: "I don't have enough permissions.",
            ephemeral: true,
          })
          return
        }

        // Check whether !bot.permissions.has(permission) before running this branch.
        if (!bot.permissions.has(permission)) {
          // Call interaction.reply to run this step.
          interaction.reply({
            content: "I don't have enough permissions.",
            ephemeral: true,
          })
          return
        }
      }
    }

    //If all checks are fine, runs command
    await commandObject.callback(client, interaction)

    //Error handling
  } catch (error) {
    // Call console.log to run this step.
    console.log(`There was an error running this command: ${error}`)
  }
}
