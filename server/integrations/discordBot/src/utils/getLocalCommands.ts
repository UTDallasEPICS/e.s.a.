/**
 * Purpose
 * Provide the get local commands logic used by other parts of ESA.
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
import { fileURLToPath, pathToFileURL } from 'url'
import { dirname, join, basename } from 'path'
import fs from 'fs'
import getAllFiles from './getAllFiles'

interface CommandObject {
  name: string
  [key: string]: any
}

// Convert import.meta.url to __dirname equivalent
const __filename = fileURLToPath(import.meta.url)
// Use dirname to initialize __dirname.
const __dirname = dirname(__filename)

// Define getLocalCommands for the steps below.
const getLocalCommands = async (exceptions: string[] = []): Promise<CommandObject[]> => {
  // Array for storing all commands
  let localCommands: CommandObject[] = []

  // Resolve commands directory robustly. Prefer project-root path so this works when code is bundled to temp.
  const candidateProjectPath = join(
    process.cwd(),
    'server',
    'integrations',
    'discordBot',
    'src',
    'commands'
  )
  // Use join to initialize candidateRelativePath.
  const candidateRelativePath = join(__dirname, '..', 'commands')

  // Define commandsDir for the steps below.
  let commandsDir: string | null = null
  // Check whether fs.existsSync(candidateProjectPath) before running this branch.
  if (fs.existsSync(candidateProjectPath)) {
    // Update commandsDir with the value on the right.
    commandsDir = candidateProjectPath
  } else if (fs.existsSync(candidateRelativePath)) {
    // Update commandsDir with the value on the right.
    commandsDir = candidateRelativePath
  } else {
    // Call console.warn to run this step.
    console.warn(
      `[DiscordBot] Commands folder not found. Checked:\n  ${candidateProjectPath}\n  ${candidateRelativePath}`
    )
    // Pass [] back to the caller.
    return []
  }

  // Gets the category folders (/misc, /moderation, etc.)
  const commandCategories = getAllFiles(commandsDir, true)

  // Loops through command categories
  for (const commandCategory of commandCategories) {
    // Gets all files within command categories
    const commandFiles = getAllFiles(commandCategory)

    // Create an array of promises for dynamic imports
    const importPromises = commandFiles.map(async (commandFile) => {
      // Skip files in the exceptions list
      if (exceptions.includes(commandFile)) return

      try {
        // Define commandModule for the steps below.
        let commandModule: any
        try {
          // Define { default: jiti } for the steps below.
          const { default: jiti } = await import('jiti')
          // Use (jiti as any) to initialize j.
          const j = (jiti as any)(import.meta.url)
          // Update commandModule with the value on the right.
          commandModule = j(commandFile)
        } catch (e) {
          // Fallback to native dynamic import for .js files
          commandModule = await import(pathToFileURL(commandFile).href)
        }
        // Define command for the steps below.
        const command = commandModule.default
        // Call localCommands.push to run this step.
        localCommands.push(command)
      } catch (error) {
        // Call console.error to run this step.
        console.error(`Failed to import command file ${commandFile}:`, error)
      }
    })

    // Wait for all imports to complete
    await Promise.all(importPromises)
  }

  // Pass localCommands back to the caller.
  return localCommands
}

export default getLocalCommands
