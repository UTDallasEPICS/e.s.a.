/**
 * Purpose
 * Provide the sync member logic used by other parts of ESA.
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
import { Client, GuildMember } from 'discord.js'
import { prisma } from '#server/utils/prisma'

interface Membership {
  Team: {
    Project: {
      name: string
    }
  }
}

/**
 * On guild member add, syncs the member's roles and nickname with their project data in the database.
 * Depends that role names are already created in the format "Project Name - Current".
 *
 * @param {Client} client - The Discord client.
 * @param {GuildMember} member - The new guild member.
 * @throws {Error} if an error occurs while syncing the member.
 */
const syncMember = async (client: Client, member: GuildMember) => {
  try {
    // Extract the student's project name based on the new member's Discord username
    const student = await prisma.student.findUnique({
      where: {
        discord: member.user.username,
      },
      include: {
        Memberships: {
          include: {
            Team: {
              include: {
                Project: true,
              },
            },
          },
        },
      },
    })

    // Check whether !student before running this branch.
    if (!student) {
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error(`Student with discordUser ${member.user.username} not found`)
    }

    // Use student.Memberships.map to initialize projects.
    const projects = student.Memberships.map((membership: Membership) => membership.Team.Project)
    // Repeat the following steps for each item in projects.
    for (const project of projects) {
      // Define projectName for the steps below.
      const projectName = project.name
      // Define roleName for the steps below.
      const roleName = `${projectName} - Current`
      // Use member.guild.roles.cache.find to initialize role.
      const role = member.guild.roles.cache.find((r) => r.name === roleName)
      // Check whether role before running this branch.
      if (role) {
        await member.roles.add(role)
      }
    }

    await member.setNickname(`${student.firstName} ${student.lastName}`)
  } catch (error) {
    // Call console.error to run this step.
    console.error('Error syncing member:', error)
    // Stop this operation and tell the caller why it cannot continue.
    throw error
  }
}

export default syncMember
