//typeScript wrapper for Google OR-Tools Python CP-SAT solver
import { spawn, spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

// Some hosts (notably recent macOS) only have `python3` on PATH, not `python`; others
// (Windows, older setups) are the reverse. Try both rather than hardcoding one.
// Probed once and cached: spawnSync blocks the event loop.
let pythonCommand: string | undefined;
function resolvePythonCommand(): string {
  if (pythonCommand) return pythonCommand;
  for (const candidate of ['python3', 'python']) {
    // status 0, not just "spawned": Windows' Store alias python3.exe runs and exits 9009.
    if (spawnSync(candidate, ['--version']).status === 0) return (pythonCommand = candidate);
  }
  throw new Error('No Python interpreter found on PATH (tried python3, python).');
}

export type Gender = "Male" | "Female" | "Non-binary" | "Prefer not to say";

export type Student = {
  id: string;
  name: string;
  major: "CS" | "SE" | "EE" | "ME" | "BME" | "DS" | "CE" | "Systems" | "Other";
  seniority: "Freshman" | "Sophomore" | "Junior" | "Senior";
  choices: string[];
  choicesString: string;
  class: "2200" | "3200";
  previousProject?: string;
  gender: Gender;
  day?: "Wednesday" | "Thursday";
  // Semesters enrolled before this one, and how many of those were 3200. Only used to
  // break ties between students who want the same project.
  priorSemesters?: number;
  prior3200Semesters?: number;
  // Free-text skills from the bid form. Used with Project.skills for the last-level tie-break.
  skills?: string;
  // Optional precomputed skill fit (0..1) per project name, e.g. from the LLM scorer. When
  // absent the solver computes a local TF-IDF cosine from `skills` itself.
  skillScores?: Record<string, number>;
};

export type Project = {
  id: string;
  name: string;
  type: "SW" | "HW" | "Both";
  day?: "Wednesday" | "Thursday";
  // Students already locked into this project ahead of the solve (e.g. 3200 students
  // staff placed manually) — not passed as students, just counted toward team size.
  lockedCount?: number;
  // Of those locked students, how many are 3200-level — counted separately against
  // max_upperclass_per_project (which only caps 3200s, not the team as a whole).
  lockedUpperclassCount?: number;
  // Skills the project needs (comma separated). Empty = no skill signal for tie-breaks.
  skills?: string;
};

// Defines a mapping from project names to lists of students (team assignments).
// Input string is project names, and the values are arrays of Student[] objects.
export type TeamAssignments = Record<string, Student[]>

export interface CPSATRunResult {
  assignments: TeamAssignments;
}

export interface CPSATConfig {
  min_team_size?: number;
  max_team_size?: number;
  prioritize_returning_students?: boolean;
  prioritize_3200_first_choice?: boolean;
  balance_gender?: boolean;
  // Caps how many 3200-level students can land on any one project. Omit to leave
  // uncapped (the historical behavior).
  max_upperclass_per_project?: number;
  // Requires at least this many 3200-level students on every project (e.g. "every
  // team needs a 3200 to lead it"). Defaults to 1; set 0 to disable. This is tight by
  // nature (needs roughly one 3200 per team) and can make the solve infeasible if
  // there genuinely aren't enough 3200 students to go around.
  min_upperclass_per_project?: number;
}

export interface CPSATResult {
  success: boolean;
  teams?: { [projectName: string]: string[] };
  score?: number;
  solve_time?: number;
  status?: string;
  error?: string;
}

export interface UpperclassPlacement {
  studentId: string;
  projectName: string;
  choiceRank: number; // 1-indexed
  isReturning: boolean;
}

export interface SuggestUpperclassResult {
  success: boolean;
  placements?: UpperclassPlacement[];
  usedFallbackThirdChoice?: boolean;
  noChoicesStudentIds?: string[];
  error?: string;
}

function findPythonScript(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  const candidates = [
    resolve(process.cwd(), 'algorithms', 'CPSAT', 'team_generator.py'),
    resolve(process.cwd(), 'Teambuilder', 'algorithms', 'CPSAT', 'team_generator.py'),
    resolve(process.cwd(), 'server', 'services', 'CPSAT', 'team_generator.py'),
    join(__dirname, 'team_generator.py'),
  ];
  const found = candidates.find(candidate => existsSync(candidate));
  if (!found) {
    throw new Error(`team_generator.py not found. Tried: ${candidates.join(', ')}`);
  }
  return found;
}

// Spawns team_generator.py with the given JSON input on stdin and returns its parsed
// JSON output. Shared by both the main generate call and the 3200 suggestion call —
// they differ only in `inputData.mode` and what they do with the parsed result.
function runPythonCPSAT<T extends { success: boolean; error?: string }>(inputData: object): Promise<T> {
  const pythonScriptPath = findPythonScript();
  const inputJson = JSON.stringify(inputData);

  return new Promise((resolve, reject) => {
    const pythonProcess = spawn(resolvePythonCommand(), [pythonScriptPath], {
      cwd: dirname(pythonScriptPath),
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    pythonProcess.on('error', (error: Error) => {
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });

    pythonProcess.on('close', (code: number | null) => {
      if (code !== 0) {
        console.error('Python stderr:', stderr);
        // main() prints {success:false, error} to stdout before exiting 1 — prefer
        // that message (e.g. a config ValueError) over raw stderr.
        let message: string | undefined;
        try {
          message = (JSON.parse(stdout) as { error?: string }).error;
        } catch {}
        reject(new Error(message || `Python process exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout) as T;
        if (!result.success) {
          reject(new Error(result.error || 'Python solver reported failure'));
          return;
        }
        resolve(result);
      } catch (error: any) {
        reject(new Error(`Failed to parse Python output: ${error.message}\nOutput: ${stdout}`));
      }
    });

    pythonProcess.stdin.write(inputJson);
    pythonProcess.stdin.end();
  });
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
  console.log('Starting OR-Tools CP-SAT team generation...');
  console.log(`Students: ${students.length}, Projects: ${projects.length}`);

  const startTime = Date.now();

  const inputData = {
    mode: 'generate',
    students: students.map(s => ({
      id: s.id,
      name: s.name,
      major: s.major,
      seniority: s.seniority,
      choices: s.choices,
      class: s.class,
      previousProject: s.previousProject,
      gender: s.gender,
      day: s.day,
      priorSemesters: s.priorSemesters ?? 0,
      prior3200Semesters: s.prior3200Semesters ?? 0,
      skills: s.skills ?? '',
      skillScores: s.skillScores,
    })),
    projects: projects.map(p => ({
      id: p.id,
      name: p.name,
      type: p.type,
      day: p.day,
      skills: p.skills ?? '',
      locked_count: p.lockedCount ?? 0,
      locked_upperclass_count: p.lockedUpperclassCount ?? 0,
    })),
    config: config || {
      min_team_size: 4,
      max_team_size: 6,
      prioritize_returning_students: true,
      prioritize_3200_first_choice: true,
      balance_gender: true,
    },
  };

  const result = await runPythonCPSAT<CPSATResult>(inputData);

  console.log(`\nSolution found in ${result.solve_time?.toFixed(3)}s`);
  console.log(`Status: ${result.status}`);
  console.log(`Score: ${result.score}`);

  const teamAssignments: TeamAssignments = {};
  const studentMap = new Map(students.map(s => [s.id, s]));

  for (const [projectName, studentIds] of Object.entries(result.teams!)) {
    teamAssignments[projectName] = studentIds
      .map(id => studentMap.get(id))
      .filter((s): s is Student => s !== undefined);
  }

  console.log(`Total execution time: ${Date.now() - startTime}ms\n`);

  return { assignments: teamAssignments };
}

/**
 * Suggest placements for a subset of students (typically 3200-level) ahead of the
 * main solve — guaranteeing 1st/2nd choice whenever possible, falling back to 3rd
 * choice only if required. Does not persist anything; callers decide what to do
 * with the suggestions (e.g. pre-fill a review UI before staff locks them in).
 */
export async function suggestUpperclassPlacements(
  students: Student[],
  projects: Project[],
  config?: Pick<CPSATConfig, 'max_team_size'> & { max_upperclass_per_project?: number }
): Promise<SuggestUpperclassResult> {
  const inputData = {
    mode: 'suggest_3200',
    students: students.map(s => ({
      id: s.id,
      choices: s.choices,
      previousProject: s.previousProject,
      priorSemesters: s.priorSemesters ?? 0,
      prior3200Semesters: s.prior3200Semesters ?? 0,
      skills: s.skills ?? '',
      skillScores: s.skillScores,
    })),
    projects: projects.map(p => ({
      name: p.name,
      skills: p.skills ?? '',
      locked_count: p.lockedCount ?? 0,
      locked_upperclass_count: p.lockedUpperclassCount ?? 0,
    })),
    config: config || { max_team_size: 6, max_upperclass_per_project: 4 },
  };

  return runPythonCPSAT<SuggestUpperclassResult>(inputData);
}

/**
 * Backward compatibility export - uses OR-Tools
 */
export const generateTeamsCSP = generateTeamsORTools;
