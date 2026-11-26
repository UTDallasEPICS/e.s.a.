/**
 * Purpose
 * Provide the discord bot logic used by other parts of ESA.
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
import { Client, IntentsBitField } from 'discord.js'
import { setClient } from '../integrations/discordBot/src/utils/clientInstance'

export default async () => {
  // Define token for the steps below.
  const token = process.env.DISCORD_BOT_TOKEN || process.env.TOKEN
  // Check whether !token before running this branch.
  if (!token) {
    // Call console.error to run this step.
    console.error('[DiscordBot] DISCORD_BOT_TOKEN or TOKEN is not defined in environment variables')
    return
  }

  // Define tsRuntimeRegistered for the steps below.
  let tsRuntimeRegistered = false
  // Define tryRegister for the steps below.
  const tryRegister = async () => {
    // Define attempts for the steps below.
    const attempts: { name: string; loader: () => Promise<boolean> }[] = [
      {
        name: 'esbuild-register (dist/node)',
        loader: async () => {
          // Define mod for the steps below.
          const mod = await import('esbuild-register/dist/node')
          // Check whether mod && typeof mod.register === 'function' before running this branch.
          if (mod && typeof mod.register === 'function') {
            // Call mod.register to run this step.
            mod.register({ extensions: ['.ts', '.tsx'] })
            // Pass true back to the caller.
            return true
          }
          // Pass false back to the caller.
          return false
        },
      },
      {
        name: 'esbuild-register (package)',
        loader: async () => {
          // Define mod for the steps below.
          const mod = await import('esbuild-register')
          // Check whether mod && typeof (mod as any).register === 'function' before running this branch.
          if (mod && typeof (mod as any).register === 'function') {
            ;(mod as any).register({ extensions: ['.ts', '.tsx'] })
            // Pass true back to the caller.
            return true
          }
          // Pass false back to the caller.
          return false
        },
      },
      {
        name: 'ts-node/esm',
        loader: async () => {
          await import('ts-node/esm')
          // Pass true back to the caller.
          return true
        },
      },
      {
        name: 'ts-node/register',
        loader: async () => {
          await import('ts-node/register')
          // Pass true back to the caller.
          return true
        },
      },
      {
        name: 'ts-node (programmatic)',
        loader: async () => {
          // Define mod for the steps below.
          const mod = await import('ts-node')
          // Check whether mod && typeof (mod as any).register === 'function' before running this branch.
          if (mod && typeof (mod as any).register === 'function') {
            ;(mod as any).register({ transpileOnly: true, skipProject: true })
            // Pass true back to the caller.
            return true
          }
          // Pass false back to the caller.
          return false
        },
      },
    ]

    // Repeat the following steps for each item in attempts.
    for (const attempt of attempts) {
      try {
        // Define ok for the steps below.
        const ok = await attempt.loader()
        // Check whether ok before running this branch.
        if (ok) {
          // Call console.log to run this step.
          console.log(`[DiscordBot] Registered TypeScript runtime via ${attempt.name}`)
          // Pass true back to the caller.
          return true
        }
      } catch (err) {}
    }
    // Pass false back to the caller.
    return false
  }

  try {
    // Update tsRuntimeRegistered with the value on the right.
    tsRuntimeRegistered = await tryRegister()
  } catch (e) {
    // Update tsRuntimeRegistered with the value on the right.
    tsRuntimeRegistered = false
  }

  // Check whether !tsRuntimeRegistered before running this branch.
  if (!tsRuntimeRegistered) {
    // Call console.warn to run this step.
    console.warn(
      '[DiscordBot] No TypeScript runtime found. To load .ts event handlers at runtime, install one of:\n' +
        '  pnpm add -D esbuild-register' +
        '\n' +
        '  or pnpm add -D ts-node' +
        '\n' +
        'After installing, restart the dev server. Falling back to JS-only imports.'
    )
  }

  // Define eventHandler for the steps below.
  let eventHandler: any = null
  try {
    // Define mod for the steps below.
    const mod = await import('../integrations/discordBot/src/handlers/eventHandler')
    // Update eventHandler with the value on the right.
    eventHandler = mod?.default || mod
  } catch (err) {
    // Call console.error to run this step.
    console.error('[DiscordBot] Failed to import eventHandler:', err)
  }

  // Define client for the steps below.
  const client = new Client({
    intents: [
      IntentsBitField.Flags.Guilds,
      IntentsBitField.Flags.GuildMembers,
      IntentsBitField.Flags.GuildMessages,
      IntentsBitField.Flags.MessageContent,
    ],
  })

  // Check whether eventHandler before running this branch.
  if (eventHandler) {
    try {
      // Call eventHandler to run this step.
      eventHandler(client)
    } catch (err) {
      // Call console.error to run this step.
      console.error('[DiscordBot] eventHandler threw an error during registration:', err)
    }
  } else {
    // Call console.warn to run this step.
    console.warn('[DiscordBot] eventHandler is not available; no events will be registered.')
  }

  // Call setClient to run this step.
  setClient(client)

  try {
    await client.login(token)
    // Call console.log to run this step.
    console.log('[DiscordBot] Bot started and logged in successfully')
  } catch (error) {
    // Call console.error to run this step.
    console.error('[DiscordBot] Failed to login:', error)
  }
}
