/**
 * Purpose
 * Provide the github service logic used by other parts of ESA.
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
import { GitHubManager } from '../integrations/github/GithubManagement'

// Define manager for the steps below.
let manager: GitHubManager | null = null
// Define githubStatus for the steps below.
let githubStatus: 'connected' | 'disconnected' | 'error' = 'disconnected'
// Define githubError for the steps below.
let githubError: string | null = null
// Define githubUsername for the steps below.
let githubUsername: string | null = null
// Define connectedAt for the steps below.
let connectedAt: Date | null = null

export interface TeamRepoInput {
  projectName: string
  githubUsernames: string[]
}

export interface TeamRepoResult {
  team: string
  success: boolean
  repoUrl?: string
  created?: boolean
  error?: string
}

// Define the helper that will get git hub status.
export function getGitHubStatus() {
  // Pass { status: githubStatus, error: githubError, username: githubUsername, connectedAt: connectedAt?.toIS back to the caller.
  return {
    status: githubStatus,
    error: githubError,
    username: githubUsername,
    connectedAt: connectedAt?.toISOString() ?? null,
  }
}

// Define the helper that will connect git hub.
export async function connectGitHub(): Promise<{
  success: boolean
  message: string
  username?: string
}> {
  // Check whether manager && githubStatus === 'connected' before running this branch.
  if (manager && githubStatus === 'connected') {
    // Pass { success: true, message: `Already connected as ${githubUsername}`, username: githubUsername ?? unde back to the caller.
    return {
      success: true,
      message: `Already connected as ${githubUsername}`,
      username: githubUsername ?? undefined,
    }
  }

  // Define token for the steps below.
  const token = process.env.GITHUB_TOKEN
  // Check whether !token before running this branch.
  if (!token) {
    // Define message for the steps below.
    const message = 'GITHUB_TOKEN is not defined in environment variables'
    // Update githubStatus with the value on the right.
    githubStatus = 'disconnected'
    // Update githubError with the value on the right.
    githubError = message
    // Pass { success: false, message } back to the caller.
    return { success: false, message }
  }

  try {
    // Update manager with the value on the right.
    manager = new GitHubManager()
    // Update githubUsername with the value on the right.
    githubUsername = await manager.getAuthenticatedUsername()
    // Update githubStatus with the value on the right.
    githubStatus = 'connected'
    // Update githubError with the value on the right.
    githubError = null
    // Update connectedAt with the value on the right.
    connectedAt = new Date()
    // Pass { success: true, message: `Connected as ${githubUsername}`, username: githubUsername } back to the caller.
    return { success: true, message: `Connected as ${githubUsername}`, username: githubUsername }
  } catch (error) {
    // Update githubStatus with the value on the right.
    githubStatus = 'error'
    // Update githubError with the value on the right.
    githubError = error instanceof Error ? error.message : 'Unknown error'
    // Update manager with the value on the right.
    manager = null
    // Update githubUsername with the value on the right.
    githubUsername = null
    // Update connectedAt with the value on the right.
    connectedAt = null
    // Pass { success: false, message: `Failed to connect: ${githubError}` } back to the caller.
    return { success: false, message: `Failed to connect: ${githubError}` }
  }
}

// Define the helper that will disconnect git hub.
export async function disconnectGitHub(): Promise<{ success: boolean; message: string }> {
  // Update manager with the value on the right.
  manager = null
  // Update githubStatus with the value on the right.
  githubStatus = 'disconnected'
  // Update githubError with the value on the right.
  githubError = null
  // Update githubUsername with the value on the right.
  githubUsername = null
  // Update connectedAt with the value on the right.
  connectedAt = null
  // Pass { success: true, message: 'Disconnected from GitHub' } back to the caller.
  return { success: true, message: 'Disconnected from GitHub' }
}

// Define the helper that will to repo name.
function toRepoName(projectName: string): string {
  // Pass projectName .trim() .replace(/[^a-zA-Z0-9._-]+/g, '-') .replace(/^-+|-+$/g, '') .substring(0, 100) back to the caller.
  return projectName
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100)
}

// Define the helper that will create or sync team repositories.
export async function createOrSyncTeamRepositories(
  teams: TeamRepoInput[]
): Promise<{ success: boolean; message: string; results: TeamRepoResult[] }> {
  // Check whether !manager || githubStatus !== 'connected' before running this branch.
  if (!manager || githubStatus !== 'connected') {
    // Define connected for the steps below.
    const connected = await connectGitHub()
    // Check whether !connected.success || !manager before running this branch.
    if (!connected.success || !manager) {
      // Pass { success: false, message: connected.message, results: [] } back to the caller.
      return { success: false, message: connected.message, results: [] }
    }
  }

  // Define owner for the steps below.
  const owner = githubUsername!
  // Define results for the steps below.
  const results: TeamRepoResult[] = []

  // Repeat the following steps for each item in teams.
  for (const team of teams) {
    // Use toRepoName to initialize repoName.
    const repoName = toRepoName(team.projectName)

    // Check whether !repoName before running this branch.
    if (!repoName) {
      // Call results.push to run this step.
      results.push({
        team: team.projectName,
        success: false,
        error: 'Could not derive a valid repository name',
      })
      continue
    }

    try {
      // Define exists for the steps below.
      const exists = await manager!.repositoryExists(owner, repoName)

      // Check whether !exists before running this branch.
      if (!exists) {
        await manager!.createRepository(repoName, true)
      }

      // Define existingCollaborators for the steps below.
      const existingCollaborators = await manager!.listCollaborators(owner, repoName)
      // Define existingSet for the steps below.
      const existingSet = new Set(existingCollaborators.map((c) => c.toLowerCase()))
      // Use owner.toLowerCase to initialize ownerLower.
      const ownerLower = owner.toLowerCase()
      // Use team.githubUsernames.filter to initialize desiredUsernames.
      const desiredUsernames = team.githubUsernames.filter(Boolean)
      // Define desiredSet for the steps below.
      const desiredSet = new Set(desiredUsernames.map((u) => u.toLowerCase()))

      // Repeat the following steps for each item in desiredUsernames.
      for (const username of desiredUsernames) {
        // Check whether !existingSet.has(username.toLowerCase()) before running this branch.
        if (!existingSet.has(username.toLowerCase())) {
          await manager!.addUserToRepository(owner, repoName, username)
        }
      }

      // Repeat the following steps for each item in existingSet.
      for (const existing of existingSet) {
        // Check whether existing === ownerLower before running this branch.
        if (existing === ownerLower) continue
        // Check whether !desiredSet.has(existing) before running this branch.
        if (!desiredSet.has(existing)) {
          await manager!.removeUserFromRepository(owner, repoName, existing)
        }
      }

      // Call results.push to run this step.
      results.push({
        team: team.projectName,
        success: true,
        created: !exists,
        repoUrl: `https://github.com/${owner}/${repoName}`,
      })
    } catch (error) {
      // Call results.push to run this step.
      results.push({
        team: team.projectName,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  // Define failures for the steps below.
  const failures = results.filter((r) => !r.success).length
  // Define successes for the steps below.
  const successes = results.length - failures

  // Pass { success: failures === 0, message: `Processed ${results.length} repos: ${successes} succeeded, ${fa back to the caller.
  return {
    success: failures === 0,
    message: `Processed ${results.length} repos: ${successes} succeeded, ${failures} failed`,
    results,
  }
}
