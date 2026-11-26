/**
 * Purpose
 * Provide the ortools logic used by other parts of ESA.
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
//typeScript wrapper for Google OR-Tools Python CP-SAT solver
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'

export type Gender = 'Male' | 'Female' | 'Non-binary' | 'Prefer not to say'

export type Student = {
  id: string
  name: string
  major: 'CS' | 'SE' | 'EE' | 'ME' | 'BME' | 'DS' | 'CE' | 'Systems' | 'Other'
  seniority: 'Freshman' | 'Sophomore' | 'Junior' | 'Senior'
  choices: string[]
  choicesString: string
  class: '2200' | '3200'
  previousProject?: string
  gender: Gender
  day?: 'Wednesday' | 'Thursday'
}

export type Project = {
  id: string
  name: string
  type: 'SW' | 'HW' | 'Both'
  day?: 'Wednesday' | 'Thursday'
}

// Defines a mapping from project names to lists of students (team assignments).
// Input string is project names, and the values are arrays of Student[] objects.
export type TeamAssignments = Record<string, Student[]>

export interface CPSATRunResult {
  assignments: TeamAssignments
}

export interface CPSATConfig {
  min_team_size?: number
  max_team_size?: number
  prioritize_returning_students?: boolean
  prioritize_3200_first_choice?: boolean
  balance_gender?: boolean
}

export interface CPSATResult {
  success: boolean
  teams?: { [projectName: string]: string[] }
  score?: number
  solve_time?: number
  status?: string
  error?: string
}

/**
 * Generate team assignments using Google OR-Tools CP-SAT solver via Python
 *
 * @param students - Array of students to assign
 * @param projects - Array of projects to assign students to
 * @param config - Optional configuration
 * @returns Team assignments mapping project names to arrays of students
 */
export async function generateTeamsORTools(
  students: Student[],
  projects: Project[],
  config?: CPSATConfig
): Promise<CPSATRunResult> {
  // Call console.log to run this step.
  console.log('Starting OR-Tools CP-SAT team generation...')
  // Call console.log to run this step.
  console.log(`Students: ${students.length}, Projects: ${projects.length}`)

  // Use Date.now to initialize startTime.
  const startTime = Date.now()
  // Use fileURLToPath to initialize __filename.
  const __filename = fileURLToPath(import.meta.url)
  // Use dirname to initialize __dirname.
  const __dirname = dirname(__filename)

  // Define pythonScriptCandidates for the steps below.
  const pythonScriptCandidates = [
    resolve(process.cwd(), 'algorithms', 'CPSAT', 'team_generator.py'),
    resolve(process.cwd(), 'Teambuilder', 'algorithms', 'CPSAT', 'team_generator.py'),
    resolve(process.cwd(), 'server', 'services', 'CPSAT', 'team_generator.py'),
    join(__dirname, 'team_generator.py'),
  ]
  // Use pythonScriptCandidates.find to initialize pythonScriptPath.
  const pythonScriptPath = pythonScriptCandidates.find((candidate) => existsSync(candidate))

  // Check whether !pythonScriptPath before running this branch.
  if (!pythonScriptPath) {
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error(`team_generator.py not found. Tried: ${pythonScriptCandidates.join(', ')}`)
  }

  // Prepare input data
  const inputData = {
    students: students.map((s) => ({
      id: s.id,
      name: s.name,
      major: s.major,
      seniority: s.seniority,
      choices: s.choices,
      class: s.class,
      previousProject: s.previousProject,
      gender: s.gender,
      day: s.day,
    })),
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      day: p.day,
    })),
    config: config || {
      min_team_size: 4,
      max_team_size: 6,
      prioritize_returning_students: true,
      prioritize_3200_first_choice: true,
      balance_gender: true,
    },
  }

  // Use JSON.stringify to initialize inputJson.
  const inputJson = JSON.stringify(inputData)

  // Pass new Promise((resolve, reject) => { // Spawn Python process const pythonProcess = spawn('python', [py back to the caller.
  return new Promise((resolve, reject) => {
    // Spawn Python process
    const pythonProcess = spawn('python', [pythonScriptPath], {
      cwd: dirname(pythonScriptPath),
    })

    // Define stdout for the steps below.
    let stdout = ''
    // Define stderr for the steps below.
    let stderr = ''

    // Call pythonProcess.stdout.on to run this step.
    pythonProcess.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    // Call pythonProcess.stderr.on to run this step.
    pythonProcess.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    // Call pythonProcess.on to run this step.
    pythonProcess.on('error', (error: Error) => {
      // Call reject to run this step.
      reject(new Error(`Failed to start Python process: ${error.message}`))
    })

    // Call pythonProcess.on to run this step.
    pythonProcess.on('close', (code: number | null) => {
      // Check whether code !== 0 before running this branch.
      if (code !== 0) {
        // Call console.error to run this step.
        console.error('Python stderr:', stderr)
        // Call reject to run this step.
        reject(new Error(`Python process exited with code ${code}: ${stderr}`))
        return
      }

      try {
        // Parse result
        const result: CPSATResult = JSON.parse(stdout)

        // Check whether !result.success before running this branch.
        if (!result.success) {
          // Call reject to run this step.
          reject(new Error(result.error || 'Failed to generate teams'))
          return
        }

        // Call console.log to run this step.
        console.log(`\nSolution found in ${result.solve_time?.toFixed(3)}s`)
        // Call console.log to run this step.
        console.log(`Status: ${result.status}`)
        // Call console.log to run this step.
        console.log(`Score: ${result.score}`)

        // Convert student IDs back to student objects
        const teamAssignments: TeamAssignments = {}
        // Define studentMap for the steps below.
        const studentMap = new Map(students.map((s) => [s.id, s]))

        // Repeat the following steps for each item in Object.entries(result.teams!).
        for (const [projectName, studentIds] of Object.entries(result.teams!)) {
          // Update teamAssignments[projectName] with the value on the right.
          teamAssignments[projectName] = studentIds
            .map((id) => studentMap.get(id))
            .filter((s): s is Student => s !== undefined)
        }

        // Use Date.now to initialize endTime.
        const endTime = Date.now()
        // Call console.log to run this step.
        console.log(`Total execution time: ${endTime - startTime}ms\n`)

        // Call resolve to run this step.
        resolve({
          assignments: teamAssignments,
        })
      } catch (error: any) {
        // Call reject to run this step.
        reject(new Error(`Failed to parse Python output: ${error.message}\nOutput: ${stdout}`))
      }
    })

    // Write input to stdin
    pythonProcess.stdin.write(inputJson)
    // Call pythonProcess.stdin.end to run this step.
    pythonProcess.stdin.end()
  })
}

/**
 * Backward compatibility export - uses OR-Tools
 */
export const generateTeamsCSP = generateTeamsORTools
