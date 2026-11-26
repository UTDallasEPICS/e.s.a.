/**
 * Purpose
 * Handle requests for the update channels API operation.
 *
 * Inputs
 * - Request parameters, body, and any session required by the handler.
 *
 * Outputs
 * - The operation’s response or an error with an HTTP status.
 *
 * Pseudocode
 * Read the request → apply the handler’s checks → call the matching operation → return its result.
 */
/**
 * API endpoint to update Discord with channels for all projects
 * POST /api/discord/update-channels
 */
import createProjectDiscord from '#server/integrations/discordBot/src/teambuilderFunc/createProjectDiscord'
import projectService from '#server/services/projectService'

export default defineEventHandler(async () => {
  try {
    // Define projects for the steps below.
    const projects = await projectService.getAllProjects()
    // Define created for the steps below.
    let created = 0
    // Define errors for the steps below.
    let errors: string[] = []
    // Repeat the following steps for each item in projects.
    for (const project of projects) {
      try {
        await createProjectDiscord(project)
        created++
      } catch (err: any) {
        // Call errors.push to run this step.
        errors.push(`${project.name}: ${err?.message || err}`)
      }
    }
    // Pass { success: errors.length === 0, created, total: projects.length, errors, message: errors.length ===  back to the caller.
    return {
      success: errors.length === 0,
      created,
      total: projects.length,
      errors,
      message:
        errors.length === 0
          ? `Successfully updated Discord with ${created} project channels.`
          : `Some errors occurred. ${created} succeeded, ${errors.length} failed.`,
    }
  } catch (error: any) {
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: error?.message || 'Failed to update Discord channels',
    })
  }
})
