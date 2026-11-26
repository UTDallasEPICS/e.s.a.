/**
 * Purpose
 * Handle requests for the create repos API operation.
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
import { createOrSyncTeamRepositories } from '#server/services/githubService'
import { prisma } from '#server/utils/prisma'

export default defineEventHandler(async (event) => {
  // Define body for the steps below.
  const body = await readBody<{ semesterId?: string; projectIds?: string[] }>(event)

  // Check whether !body?.semesterId before running this branch.
  if (!body?.semesterId) {
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({ statusCode: 400, message: 'semesterId is required' })
  }

  // Define normalizedProjectIds for the steps below.
  const normalizedProjectIds = Array.isArray(body.projectIds)
    ? Array.from(
        new Set(
          body.projectIds
            .filter((id): id is string => typeof id === 'string')
            .map((id) => id.trim())
            .filter(Boolean)
        )
      )
    : []

  // Define teams for the steps below.
  const teams = await prisma.team.findMany({
    where: {
      semesterId: body.semesterId,
      ...(normalizedProjectIds.length > 0 ? { projectId: { in: normalizedProjectIds } } : {}),
    },
    include: {
      Project: { select: { name: true } },
      Memberships: { include: { Student: { select: { github: true } } } },
    },
  })

  // Check whether teams.length === 0 before running this branch.
  if (teams.length === 0) {
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({
      statusCode: 404,
      message:
        normalizedProjectIds.length > 0
          ? 'No teams found for this semester and selected team filter'
          : 'No teams found for this semester',
    })
  }

  // Use teams.map to initialize inputs.
  const inputs = teams.map((team) => ({
    projectName: team.Project.name,
    githubUsernames: team.Memberships.map((m) => m.Student.github?.trim()).filter(
      (username: string | undefined): username is string => Boolean(username)
    ),
  }))

  // Define result for the steps below.
  const result = await createOrSyncTeamRepositories(inputs)

  // Pass { success: result.success, message: result.message, results: result.results, timestamp: new Date().t back to the caller.
  return {
    success: result.success,
    message: result.message,
    results: result.results,
    timestamp: new Date().toISOString(),
  }
})
