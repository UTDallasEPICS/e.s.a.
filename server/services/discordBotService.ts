/**
 * Purpose
 * Provide the discord bot service logic used by other parts of ESA.
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
import eventHandler from '../integrations/discordBot/src/handlers/eventHandler'
import { setClient } from '../integrations/discordBot/src/utils/clientInstance'

// Define botClient for the steps below.
let botClient: Client | null = null
// Define botStatus for the steps below.
let botStatus: 'running' | 'stopped' | 'error' = 'stopped'
// Define botError for the steps below.
let botError: string | null = null

// Define the helper that will start discord bot.
export async function startDiscordBot(): Promise<{ success: boolean; message: string }> {
  // Check whether botClient && botStatus === 'running' before running this branch.
  if (botClient && botStatus === 'running') {
    // Pass { success: false, message: 'Bot is already running' } back to the caller.
    return { success: false, message: 'Bot is already running' }
  }

  try {
    // Define token for the steps below.
    const token = process.env.DISCORD_BOT_TOKEN || process.env.TOKEN

    // If no token is present, do not throw — return a graceful failure so the
    // dev server can start without the Discord bot. Production should provide
    // the token and will start the bot as expected.
    if (!token) {
      // Define msg for the steps below.
      const msg = 'DISCORD_BOT_TOKEN or TOKEN is not defined in environment variables'
      // Call console.warn to run this step.
      console.warn(`⚠️ [DiscordBot] ${msg} — skipping startup`)
      // Pass { success: false, message: msg } back to the caller.
      return { success: false, message: msg }
    }

    // Update botClient with the value on the right.
    botClient = new Client({
      intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
      ],
    })

    // Call eventHandler to run this step.
    eventHandler(botClient)
    // Call setClient to run this step.
    setClient(botClient)

    await botClient.login(token)

    // Update botStatus with the value on the right.
    botStatus = 'running'
    // Update botError with the value on the right.
    botError = null

    // Call console.log to run this step.
    console.log('✅ SCIPE Discord bot started successfully')
    // Pass { success: true, message: 'Bot started successfully' } back to the caller.
    return { success: true, message: 'Bot started successfully' }
  } catch (error) {
    // Update botStatus with the value on the right.
    botStatus = 'error'
    // Update botError with the value on the right.
    botError = error instanceof Error ? error.message : 'Unknown error'
    // Call console.error to run this step.
    console.error('❌ Error starting Discord bot:', error)
    // Pass { success: false, message: `Failed to start bot: ${botError}` } back to the caller.
    return { success: false, message: `Failed to start bot: ${botError}` }
  }
}
// Define the helper that will stop discord bot.
export async function stopDiscordBot(): Promise<{ success: boolean; message: string }> {
  // Check whether !botClient || botStatus === 'stopped' before running this branch.
  if (!botClient || botStatus === 'stopped') {
    // Pass { success: false, message: 'Bot is not running' } back to the caller.
    return { success: false, message: 'Bot is not running' }
  }

  try {
    await botClient.destroy()
    // Update botClient with the value on the right.
    botClient = null
    // Update botStatus with the value on the right.
    botStatus = 'stopped'
    // Update botError with the value on the right.
    botError = null

    // Call console.log to run this step.
    console.log('🛑 SCIPE Discord bot stopped')
    // Pass { success: true, message: 'Bot stopped successfully' } back to the caller.
    return { success: true, message: 'Bot stopped successfully' }
  } catch (error) {
    // Update botStatus with the value on the right.
    botStatus = 'error'
    // Update botError with the value on the right.
    botError = error instanceof Error ? error.message : 'Unknown error'
    // Call console.error to run this step.
    console.error('❌ Error stopping Discord bot:', error)
    // Pass { success: false, message: `Failed to stop bot: ${botError}` } back to the caller.
    return { success: false, message: `Failed to stop bot: ${botError}` }
  }
}

// Define the helper that will restart discord bot.
export async function restartDiscordBot(): Promise<{ success: boolean; message: string }> {
  // Define stopResult for the steps below.
  const stopResult = await stopDiscordBot()
  // Check whether stopResult.success || botStatus === 'stopped' before running this branch.
  if (stopResult.success || botStatus === 'stopped') {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    // Pass await startDiscordBot() back to the caller.
    return await startDiscordBot()
  }
  // Pass stopResult back to the caller.
  return stopResult
}

// Define the helper that will get bot status.
export function getBotStatus(): { status: string; error: string | null; uptime: number | null } {
  // Pass { status: botStatus, error: botError, uptime: botClient?.uptime || null, } back to the caller.
  return {
    status: botStatus,
    error: botError,
    uptime: botClient?.uptime || null,
  }
}

// Define the helper that will get bot client.
export function getBotClient(): Client | null {
  // Pass botClient back to the caller.
  return botClient
}
