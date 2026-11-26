/**
 * Purpose
 * Handle requests for the assign project roles API operation.
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
import { defineEventHandler, readBody } from 'h3'
import { getClient } from '#server/integrations/discordBot/src/utils/clientInstance'
import semesterService from '#server/services/semesterService'
import projectService from '#server/services/projectService'
import studentService from '#server/services/studentService'

type Body = {
  semesterId?: string
}

// Define normalizeDiscordHandle for the steps below.
const normalizeDiscordHandle = (value: string): string =>
  value.trim().replace(/^@/, '').toLowerCase()

export default defineEventHandler(async (event) => {
  try {
    // Define body for the steps below.
    const body = await readBody<Body>(event)

    // Define semesterId for the steps below.
    let semesterId = body?.semesterId
    // Check whether !semesterId before running this branch.
    if (!semesterId) {
      // Define semester for the steps below.
      const semester = await semesterService.getRecentSemester()
      // Check whether !semester before running this branch.
      if (!semester) {
        // Pass { success: false, message: 'No semesters found in database.' } back to the caller.
        return { success: false, message: 'No semesters found in database.' }
      }
      // Update semesterId with the value on the right.
      semesterId = semester.id
    }

    // Define [projects, students] for the steps below.
    const [projects, students] = await Promise.all([
      projectService.getAllProjects(),
      studentService.getAllStudents(),
    ])
    // Define studentsById for the steps below.
    const studentsById = new Map(students.map((s) => [s.id, s]))

    // Use projects.flatMap to initialize projectTeams.
    const projectTeams = projects.flatMap((project) =>
      project.Teams.filter((team) => team.semesterId === semesterId).map((team) => ({
        projectName: project.name,
        students: team.Memberships.map((membership) => studentsById.get(membership.studentId)!),
      }))
    )

    // Check whether projectTeams.length === 0 before running this branch.
    if (projectTeams.length === 0) {
      // Pass { success: false, message: 'No teams found for selected semester.' } back to the caller.
      return { success: false, message: 'No teams found for selected semester.' }
    }

    // Use getClient to initialize client.
    const client = getClient()
    // Define guildId for the steps below.
    const guildId = process.env.GUILD_ID
    // Check whether !guildId before running this branch.
    if (!guildId) {
      // Pass { success: false, message: 'GUILD_ID is not defined in environment variables.' } back to the caller.
      return { success: false, message: 'GUILD_ID is not defined in environment variables.' }
    }

    // Define guild for the steps below.
    const guild = await client.guilds.fetch(guildId)
    await guild.members.fetch()

    // Define assigned for the steps below.
    const assigned: Array<{ student: string; role: string }> = []
    // Define errors for the steps below.
    const errors: string[] = []

    // Repeat the following steps for each item in projectTeams.
    for (const team of projectTeams) {
      // Define roleName for the steps below.
      const roleName = `${team.projectName} - Current`
      // Use guild.roles.cache.find to initialize role.
      const role = guild.roles.cache.find((r) => r.name === roleName)

      // Check whether !role before running this branch.
      if (!role) {
        // Call errors.push to run this step.
        errors.push(
          `${team.projectName}: role '${roleName}' does not exist. Run channel/role creation first.`
        )
        continue
      }

      // Repeat the following steps for each item in team.students.
      for (const student of team.students) {
        // Check whether !student.discord before running this branch.
        if (!student.discord) {
          // Call errors.push to run this step.
          errors.push(
            `${student.firstName} ${student.lastName}: no Discord username in student record.`
          )
          continue
        }

        // Use normalizeDiscordHandle to initialize handle.
        const handle = normalizeDiscordHandle(student.discord)

        // Use guild.members.cache.find to initialize member.
        const member = guild.members.cache.find((m) => {
          // Use m.user.username?.toLowerCase to initialize username.
          const username = m.user.username?.toLowerCase()
          // Use m.user.globalName?.toLowerCase to initialize globalName.
          const globalName = m.user.globalName?.toLowerCase()
          // Use m.displayName?.toLowerCase to initialize displayName.
          const displayName = m.displayName?.toLowerCase()
          // Use `${m.user.username}#${m.user.discriminator}`.toLowerCase to initialize tag.
          const tag = `${m.user.username}#${m.user.discriminator}`.toLowerCase()
          // Pass ( handle === username || handle === globalName || handle === displayName || handle === tag ) back to the caller.
          return (
            handle === username || handle === globalName || handle === displayName || handle === tag
          )
        })

        // Check whether !member before running this branch.
        if (!member) {
          // Call errors.push to run this step.
          errors.push(
            `${student.firstName} ${student.lastName}: Discord user '${student.discord}' not found in guild.`
          )
          continue
        }

        // Check whether member.roles.cache.has(role.id) before running this branch.
        if (member.roles.cache.has(role.id)) {
          continue
        }

        try {
          await member.roles.add(role)
          // Call assigned.push to run this step.
          assigned.push({
            student: `${student.firstName} ${student.lastName}`,
            role: roleName,
          })
        } catch (err: any) {
          // Call errors.push to run this step.
          errors.push(
            `${student.firstName} ${student.lastName}: failed to assign '${roleName}' (${err?.message || err}).`
          )
        }
      }
    }

    // Pass { success: errors.length === 0, message: `Assigned ${assigned.length} project role(s).`, assignedCou back to the caller.
    return {
      success: errors.length === 0,
      message: `Assigned ${assigned.length} project role(s).`,
      assignedCount: assigned.length,
      assigned,
      errors,
    }
  } catch (error: any) {
    // Pass { success: false, message: error?.message || 'Failed to assign project roles.', } back to the caller.
    return {
      success: false,
      message: error?.message || 'Failed to assign project roles.',
    }
  }
})
