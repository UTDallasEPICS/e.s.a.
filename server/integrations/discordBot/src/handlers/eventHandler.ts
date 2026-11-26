/**
 * Purpose
 * Provide the event handler logic used by other parts of ESA.
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
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fs from 'fs'
import getAllFiles from '../utils/getAllFiles'
import { Client } from 'discord.js'

// Use fileURLToPath to initialize __filename.
const __filename = fileURLToPath(import.meta.url)
// Use dirname to initialize __dirname.
const __dirname = dirname(__filename)

export default (client: Client) => {
  // Use join to initialize candidateProjectPath.
  const candidateProjectPath = join(
    process.cwd(),
    'server',
    'integrations',
    'discordBot',
    'src',
    'events'
  )
  // Use join to initialize candidateRelativePath.
  const candidateRelativePath = join(__dirname, '../events')

  // Define eventsDir for the steps below.
  let eventsDir: string | null = null
  // Check whether fs.existsSync(candidateProjectPath) before running this branch.
  if (fs.existsSync(candidateProjectPath)) {
    // Update eventsDir with the value on the right.
    eventsDir = candidateProjectPath
  } else if (fs.existsSync(candidateRelativePath)) {
    // Update eventsDir with the value on the right.
    eventsDir = candidateRelativePath
  } else {
    // Call console.warn to run this step.
    console.warn(
      `[DiscordBot] Events folder not found. Checked:\n  ${candidateProjectPath}\n  ${candidateRelativePath}`
    )
    return
  }

  // Use getAllFiles to initialize eventFolders.
  const eventFolders = getAllFiles(eventsDir, true)

  // Repeat the following steps for each item in eventFolders.
  for (const eventFolder of eventFolders) {
    // Use getAllFiles to initialize eventFiles.
    const eventFiles = getAllFiles(eventFolder)

    // sort files inside folders so that files with lower numbers get higher priority
    eventFiles.sort((a, b) => (a > b ? 1 : -1))

    // gets the name of the event based on the folder name
    const eventName = eventFolder.replace(/\\/g, '/').split('/').pop()

    // Check whether !eventName before running this branch.
    if (!eventName) continue // Ensure eventName is valid

    // support both legacy 'ready' and new 'clientReady' to be future-proof
    const eventNames =
      eventName === 'ready'
        ? ['clientReady']
        : eventName === 'clientReady'
          ? ['clientReady']
          : [eventName]

    // Repeat the following steps for each item in eventNames.
    for (const name of eventNames) {
      // listens for events to happen and then calls the required event
      client.on(name as any, async (arg) => {
        // Repeat the following steps for each item in eventFiles.
        for (const eventFile of eventFiles) {
          try {
            // Define module for the steps below.
            let module: any

            // try direct import first
            try {
              // prefer jiti for TS/ESM runtime loading
              const { default: jiti } = await import('jiti')
              // Use (jiti as any) to initialize j.
              const j = (jiti as any)(import.meta.url)
              // Update module with the value on the right.
              module = j(eventFile)
            } catch (e) {
              // final fallback to native dynamic import (for .js files)
              const { pathToFileURL } = await import('url')
              // Update module with the value on the right.
              module = await import(pathToFileURL(eventFile).href)
            }

            // Define eventFunction for the steps below.
            const eventFunction = module.default

            // Check whether typeof eventFunction === 'function' before running this branch.
            if (typeof eventFunction === 'function') {
              await eventFunction(client, arg)
            } else {
              // Call console.error to run this step.
              console.error(`Default export in ${eventFile} is not a function`)
            }
          } catch (importErr: any) {
            // Call console.error to run this step.
            console.error(
              `[DiscordBot] Failed to import event file ${eventFile}:`,
              importErr?.message || importErr
            )
            // Call console.error to run this step.
            console.error(importErr)
          }
        }
      })
    }
  }
}
