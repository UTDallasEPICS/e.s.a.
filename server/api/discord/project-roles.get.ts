/**
 * Purpose
 * Handle requests for the project roles API operation.
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
import { defineEventHandler, getQuery } from 'h3'
import { getClient as getDiscordClient } from '#server/integrations/discordBot/src/utils/clientInstance'
import semesterService from '#server/services/semesterService'
import projectService from '#server/services/projectService'

export default defineEventHandler(async (event) => {
  try {
    // Use getQuery to initialize query.
    const query = getQuery(event)
    // Define semesterId for the steps below.
    const semesterId = (query.semesterId as string) || undefined

    // Resolve semester: if not provided, use latest
    let resolvedSemesterId = semesterId
    // Check whether !resolvedSemesterId before running this branch.
    if (!resolvedSemesterId) {
      // Define recentSemester for the steps below.
      const recentSemester = await semesterService.getRecentSemester()
      // Check whether recentSemester before running this branch.
      if (recentSemester) {
        // Update resolvedSemesterId with the value on the right.
        resolvedSemesterId = recentSemester.id
      }
    }

    // Check whether !resolvedSemesterId before running this branch.
    if (!resolvedSemesterId) {
      // Pass { success: false, message: 'No semester found' } back to the caller.
      return { success: false, message: 'No semester found' }
    }

    // Get project names that have a team in this semester
    const projects = await projectService.getAllProjects()
    // Use projects .filter((project) => project.Teams.some((team) => team.semesterId === resolvedSemesterId))  to initialize projectNames.
    const projectNames = projects
      .filter((project) => project.Teams.some((team) => team.semesterId === resolvedSemesterId))
      .map((project) => project.name)

    // Use getDiscordClient to initialize discordClient.
    const discordClient = getDiscordClient()
    // Define guildId for the steps below.
    const guildId = process.env.GUILD_ID
    // Check whether !discordClient || !guildId before running this branch.
    if (!discordClient || !guildId) {
      // Pass { success: false, message: 'Discord client or GUILD_ID not available' } back to the caller.
      return { success: false, message: 'Discord client or GUILD_ID not available' }
    }

    // Define guild for the steps below.
    const guild = await discordClient.guilds.fetch(guildId)
    await guild.roles.fetch()

    // Define roles for the steps below.
    const roles = guild.roles.cache

    // Roles that follow the convention "<Project Name> - Current"
    const projectRoleSuffix = ' - Current'

    // Use projectNames.map to initialize projectRoleMatches.
    const projectRoleMatches: { projectName: string; roleId?: string; roleName?: string }[] =
      projectNames.map((p) => {
        // Define expected for the steps below.
        const expected = `${p}${projectRoleSuffix}`
        // Use roles.find to initialize role.
        const role = roles.find((r) => r.name === expected)
        // Pass { projectName: p, roleId: role?.id, roleName: role?.name } back to the caller.
        return { projectName: p, roleId: role?.id, roleName: role?.name }
      })

    // Roles in guild that look like project roles (end with suffix)
    const guildProjectRoles = roles
      .filter((r) => r.name.endsWith(projectRoleSuffix))
      .map((r) => ({
        id: r.id,
        name: r.name,
      }))

    // Non-project roles (as simple names) - sample a subset to avoid huge payloads
    const nonProjectRoles = roles
      .filter((r) => !r.name.endsWith(projectRoleSuffix))
      .map((r) => ({ id: r.id, name: r.name }))

    // Pass { success: true, semesterId: resolvedSemesterId, projects: projectRoleMatches, guildProjectRoles, no back to the caller.
    return {
      success: true,
      semesterId: resolvedSemesterId,
      projects: projectRoleMatches,
      guildProjectRoles,
      nonProjectRoles,
    }
  } catch (err: any) {
    // Pass { success: false, error: err?.message || String(err) } back to the caller.
    return { success: false, error: err?.message || String(err) }
  }
})
