/**
 * Purpose
 * Provide the github management logic used by other parts of ESA.
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
import { Octokit } from '@octokit/rest'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as readline from 'readline'
import { pathToFileURL } from 'url'

// Call dotenv.config to run this step.
dotenv.config()

export class GitHubManager {
  private octokit: Octokit

  constructor() {
    // Define token for the steps below.
    const token = process.env.GITHUB_TOKEN
    // Check whether !token before running this branch.
    if (!token) {
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('GitHub token not found. Please add it to the .env file.')
    }
    // Update this.octokit with the value on the right.
    this.octokit = new Octokit({ auth: token })
  }

  // get authenticated user's username
  async getAuthenticatedUsername(): Promise<string> {
    try {
      // Define response for the steps below.
      const response = await this.octokit.users.getAuthenticated()
      // Pass response.data.login back to the caller.
      return response.data.login
    } catch (error: any) {
      // Define isBadCredentials for the steps below.
      const isBadCredentials =
        error?.status === 401 || /bad credentials/i.test(String(error?.message ?? ''))
      // Check whether isBadCredentials before running this branch.
      if (isBadCredentials) {
        // Stop this operation and tell the caller why it cannot continue.
        throw new Error('GitHub authentication failed: invalid or expired GITHUB_TOKEN.')
      }
      // Call console.error to run this step.
      console.error('Error fetching authenticated username:', error)
      // Stop this operation and tell the caller why it cannot continue.
      throw error
    }
  }

  // Check if a repository exists
  async repositoryExists(owner: string, repoName: string): Promise<boolean> {
    try {
      await this.octokit.repos.get({
        owner,
        repo: repoName,
      })
      // Pass true back to the caller.
      return true
    } catch (error: any) {
      // Check whether error.status === 404 before running this branch.
      if (error.status === 404) {
        // Pass false back to the caller.
        return false
      } else {
        // Call console.error to run this step.
        console.error('Error checking repository existence:', error)
        // Stop this operation and tell the caller why it cannot continue.
        throw error
      }
    }
  }

  // Create a new repository
  async createRepository(repoName: string, isPrivate: boolean = true): Promise<void> {
    try {
      // Define response for the steps below.
      const response = await this.octokit.repos.createForAuthenticatedUser({
        name: repoName,
        private: isPrivate,
      })
      // Call console.log to run this step.
      console.log(`Repository created: ${response.data.html_url}`)
    } catch (error) {
      // Call console.error to run this step.
      console.error('Error creating repository:', error)
      // Stop this operation and tell the caller why it cannot continue.
      throw error
    }
  }

  // Add a collaborator to a repository
  async addUserToRepository(owner: string, repoName: string, username: string): Promise<void> {
    try {
      await this.octokit.repos.addCollaborator({
        owner,
        repo: repoName,
        username,
        permission: 'push', // Default to pull/push access
      })
      // Call console.log to run this step.
      console.log(`User ${username} added to ${owner}/${repoName} with push permission.`)
    } catch (error) {
      // Call console.error to run this step.
      console.error(`Error adding user ${username} to repository:`, error)
      // Stop this operation and tell the caller why it cannot continue.
      throw error
    }
  }

  // Remove a collaborator from a repository
  async removeUserFromRepository(owner: string, repoName: string, username: string): Promise<void> {
    try {
      await this.octokit.repos.removeCollaborator({
        owner,
        repo: repoName,
        username,
      })
      // Call console.log to run this step.
      console.log(`User ${username} removed from ${owner}/${repoName}.`)
    } catch (error) {
      // Call console.error to run this step.
      console.error(`Error removing user ${username} from repository:`, error)
      // Stop this operation and tell the caller why it cannot continue.
      throw error
    }
  }

  // List collaborators of a repository
  async listCollaborators(owner: string, repoName: string): Promise<string[]> {
    try {
      // Define response for the steps below.
      const response = await this.octokit.repos.listCollaborators({
        owner,
        repo: repoName,
      })
      // Pass response.data.map((collaborator) => collaborator.login) back to the caller.
      return response.data.map((collaborator) => collaborator.login)
    } catch (error) {
      // Call console.error to run this step.
      console.error('Error listing collaborators:', error)
      // Stop this operation and tell the caller why it cannot continue.
      throw error
    }
  }
}

// Helper function to prompt for file path
const promptFilePath = async (query: string): Promise<string> => {
  // Use readline.createInterface to initialize rl.
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  // Pass new Promise((resolve) => rl.question(query, (ans) => { rl.close() resolve(ans) }) ) back to the caller.
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      // Call rl.close to run this step.
      rl.close()
      // Call resolve to run this step.
      resolve(ans)
    })
  )
}

// Main Function
const runCli = async () => {
  // Define manager for the steps below.
  const manager = new GitHubManager()
  // Define username for the steps below.
  const username = await manager.getAuthenticatedUsername()

  // Call console.log to run this step.
  console.log(`Authenticated as: ${username}`)

  // Define filePath for the steps below.
  const filePath = await promptFilePath('Enter the JSON file path: ')

  // Read and parse the JSON file
  let teamData
  try {
    // Use fs.readFileSync to initialize fileContent.
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    // Update teamData with the value on the right.
    teamData = JSON.parse(fileContent)
  } catch (error) {
    // Call console.error to run this step.
    console.error('Error reading or parsing JSON file:', error)
    return
  }

  // Define { teamName, collaborators } for the steps below.
  const { teamName, collaborators } = teamData

  // Check whether !teamName || !Array.isArray(collaborators) before running this branch.
  if (!teamName || !Array.isArray(collaborators)) {
    // Call console.error to run this step.
    console.error("Invalid JSON format. Please provide 'teamName' and 'collaborators' array.")
    return
  }

  // Define repoExists for the steps below.
  const repoExists = await manager.repositoryExists(username, teamName)

  // Check whether repoExists before running this branch.
  if (repoExists) {
    // Call console.log to run this step.
    console.log(`Repository '${teamName}' exists. Updating collaborators...`)

    // Get current collaborators
    const currentCollaborators = await manager.listCollaborators(username, teamName)

    // Normalize usernames to lowercase for case-insensitive comparison
    const normalizedCurrentCollaborators = currentCollaborators.map((collab) =>
      collab.toLowerCase()
    )
    // Use collaborators.map to initialize normalizedCollaborators.
    const normalizedCollaborators = collaborators.map((collab: string) => collab.toLowerCase())
    // Use username.toLowerCase to initialize normalizedUsername.
    const normalizedUsername = username.toLowerCase()

    // Determine collaborators to add and remove
    const collaboratorsToAdd = normalizedCollaborators.filter(
      (collab) => !normalizedCurrentCollaborators.includes(collab)
    )
    // Use normalizedCurrentCollaborators.filter to initialize collaboratorsToRemove.
    const collaboratorsToRemove = normalizedCurrentCollaborators.filter(
      (collab) => !normalizedCollaborators.includes(collab) && collab !== normalizedUsername // Do not remove the repo owner
    )

    // Add new collaborators
    for (const collab of collaboratorsToAdd) {
      await manager.addUserToRepository(username, teamName, collab)
    }

    // Remove collaborators not in the JSON file
    for (const collab of collaboratorsToRemove) {
      await manager.removeUserFromRepository(username, teamName, collab)
    }

    // Call console.log to run this step.
    console.log('Collaborators updated.')
  } else {
    // Call console.log to run this step.
    console.log(
      `Repository '${teamName}' does not exist. Creating repository and adding collaborators...`
    )
    await manager.createRepository(teamName, true)

    // Add collaborators
    for (const collab of collaborators) {
      await manager.addUserToRepository(username, teamName, collab)
    }

    // Call console.log to run this step.
    console.log('Repository created and collaborators added.')
  }

  // Call console.log to run this step.
  console.log('Program completed.')
}

// Define isDirectExecution for the steps below.
const isDirectExecution =
  !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
// Define isCliEnabled for the steps below.
const isCliEnabled = process.env.GITHUB_MANAGER_CLI === 'true'

// Check whether isDirectExecution && isCliEnabled before running this branch.
if (isDirectExecution && isCliEnabled) {
  // Call runCli().catch to run this step.
  runCli().catch((error) => {
    // Call console.error to run this step.
    console.error('GitHubManager CLI failed:', error instanceof Error ? error.message : error)
    // Update process.exitCode with the value on the right.
    process.exitCode = 1
  })
}
