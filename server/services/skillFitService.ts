/**
 * Optional LLM scoring of student-skills vs project-skills, used ONLY as the last level of the
 * tie-break (after 3200 experience and semester count) and never to override a student's choices.
 *
 * Default is OFF: with provider 'tfidf' nothing here runs and the solver uses its own local,
 * deterministic TF-IDF cosine (CPSAT/skill_match.py). The team's rule is that placement help
 * stays fixed-rule and explainable, so the LLM is opt-in and fully advisory:
 *   - set SKILL_TIEBREAK_PROVIDER=gemini and GEMINI_API_KEY (or flip the switch under ⚙) to enable it (or pass
 *     `skillProvider: 'gemini'` in the request body; the key is still required)
 *   - only students competing for an over-subscribed project (top-3 choices) are scored
 *   - scores use the shared 0-3 rubric from scripts/skills-baseline/benchmark.py, then /3
 *   - results are cached by a fingerprint of (model, rubric, student skills, project skills)
 *   - if any call for a project fails, NO student gets an LLM score for that project, so a tie
 *     is never decided with the LLM for one student and TF-IDF for the other
 *   - any failure falls back to the local TF-IDF; generation never fails because of the LLM
 *
 * Jev is not implemented: add a function with the same shape as scoreWithGemini and register
 * it in PROVIDERS once its API contract is known.
 */
import {createHash} from 'node:crypto'

export type SkillProvider = 'tfidf' | 'gemini'

export const RUBRIC = [
  'No relevant skills evidenced.',
  'Related skills, but little direct coverage of requirements.',
  'Direct coverage of some requirements, with substantial gaps.',
  'Direct coverage of most or all requirements.',
]
const INSTRUCTION =
  'Judge coverage of project skills using only stated student skills. Do not infer unstated proficiency.'

const TOP_CHOICES = 3
const CONCURRENCY = 4
const TIMEOUT_MS = 12_000

const cache = new Map<string, number>() // fingerprint -> rubric score 0..3

export function resolveProvider(requested?: string): SkillProvider {
  const wanted = (requested ?? process.env.SKILL_TIEBREAK_PROVIDER ?? 'tfidf').toLowerCase()
  if (wanted === 'gemini' && process.env.GEMINI_API_KEY) return 'gemini'
  return 'tfidf'
}

// gemini-2.5-flash was scheduled for retirement on Oct 16, 2026 (Google limits it to existing users
// now), so the default is the current Flash model. Override with GEMINI_MODEL in .env if Google
// renames it; the "Test Gemini" button under ⚙ shows the exact error if the name is wrong.
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash'
export function geminiModel() {
  return process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
}

function fingerprint(model: string, studentSkills: string, projectSkills: string) {
  return createHash('sha256')
    .update(JSON.stringify({model, rubric: RUBRIC, instruction: INSTRUCTION, studentSkills, projectSkills}))
    .digest('hex')
}

/** Turns a failed Gemini response into a one-line message a person can act on. */
async function describeHttpError(res: Response, model: string): Promise<string> {
  let detail = ''
  try {
    detail = ((await res.json()) as any)?.error?.message ?? ''
  } catch {
    // body was not JSON
  }
  if (res.status === 400 && /api key/i.test(detail)) return 'Gemini rejected the API key. Check GEMINI_API_KEY in .env.'
  if (res.status === 401 || res.status === 403) return `Gemini refused the key (${res.status}). Check GEMINI_API_KEY and that the Gemini API is enabled for it.`
  if (res.status === 404) return `Gemini has no model called "${model}". Set GEMINI_MODEL in .env to a current model.`
  if (res.status === 429) return 'Gemini rate limit or quota reached. Wait a minute, or check the quota on your key.'
  return `Gemini responded ${res.status}${detail ? `: ${detail.slice(0, 160)}` : ''}`
}

/** One tiny real call, used by the Test Gemini button. Never throws; never returns the key. */
export async function testGemini(): Promise<{ok: boolean; model: string; message: string; ms?: number}> {
  const model = geminiModel()
  if (!process.env.GEMINI_API_KEY) {
    return {ok: false, model, message: 'No GEMINI_API_KEY in .env. Add it and restart `pnpm dev`.'}
  }
  const started = Date.now()
  try {
    const score = await scoreWithGemini('Python, SQL, Git', 'Python, databases')
    return {ok: true, model, ms: Date.now() - started, message: `Working. Test answer: ${score}/3 for a Python/SQL student on a Python/databases project.`}
  } catch (err) {
    const e = err as Error
    return {ok: false, model, message: e.name === 'TimeoutError' ? 'Gemini did not answer in time.' : e.message}
  }
}

async function scoreWithGemini(studentSkills: string, projectSkills: string): Promise<number> {
  const model = geminiModel()
  const prompt =
    `${INSTRUCTION}\n\nRubric (score 0-3):\n${RUBRIC.map((r, i) => `${i}: ${r}`).join('\n')}\n\n` +
    `Student skills: ${studentSkills}\nProject skills: ${projectSkills}\n\n` +
    'Reply with JSON only: {"score": <integer 0-3>}'
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY!},
      body: JSON.stringify({
        contents: [{parts: [{text: prompt}]}],
        generationConfig: {temperature: 0, responseMimeType: 'application/json'},
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }
  )
  if (!res.ok) throw new Error(await describeHttpError(res, model))
  const data: any = await res.json()
  // Gemini 3 models may put "thought" parts first; the answer is the first non-thought text part.
  const parts: any[] = data?.candidates?.[0]?.content?.parts ?? []
  const text: string | undefined = parts.find((p) => typeof p?.text === 'string' && !p.thought)?.text
  const score = Number(JSON.parse(text ?? '{}').score)
  if (!Number.isFinite(score) || score < 0 || score > 3) throw new Error('Gemini returned an invalid score')
  return score
}

export interface SkillStudent {
  id: string
  skills: string
  choices: string[] // project names, best first
}
export interface SkillProject {
  name: string
  skills: string
}

export interface SkillTieBreakStats {
  provider: SkillProvider // what was actually used
  model: string | null
  contestedProjects: number
  projectsScored: number // contested projects where every competing student got a Gemini score
  studentsScored: number
  projectsFellBack: string[] // contested projects that used the local score because a call failed
  error: string | null // first failure message, if any
}

/**
 * Returns {studentId: {projectName: 0..1}} for contested pairs only. Empty when the provider is
 * 'tfidf', nothing is contested, or the LLM is unavailable; the solver then uses TF-IDF.
 */
export async function computeSkillScores(
  provider: SkillProvider,
  students: SkillStudent[],
  projects: SkillProject[],
  maxTeamSize: number,
  topChoices: number = TOP_CHOICES
): Promise<Record<string, Record<string, number>>> {
  return (await computeSkillScoresDetailed(provider, students, projects, maxTeamSize, topChoices)).scores
}

/** Same as computeSkillScores, plus a summary of what happened, so the page can say so. */
export async function computeSkillScoresDetailed(
  provider: SkillProvider,
  students: SkillStudent[],
  projects: SkillProject[],
  maxTeamSize: number,
  topChoices: number = TOP_CHOICES
): Promise<{scores: Record<string, Record<string, number>>; stats: SkillTieBreakStats}> {
  const stats: SkillTieBreakStats = {
    provider: 'tfidf',
    model: null,
    contestedProjects: 0,
    projectsScored: 0,
    studentsScored: 0,
    projectsFellBack: [],
    error: null,
  }
  if (provider !== 'gemini') return {scores: {}, stats}
  stats.provider = 'gemini'
  stats.model = geminiModel()

  const projectSkills = new Map(projects.map((p) => [p.name, p.skills.trim()]))
  const demand = new Map<string, SkillStudent[]>()
  for (const s of students) {
    if (!s.skills.trim()) continue
    for (const name of s.choices.slice(0, topChoices)) {
      if (!projectSkills.get(name)) continue
      demand.set(name, [...(demand.get(name) ?? []), s])
    }
  }

  const model = geminiModel()

  // One entry per contested project; each student's call is a task in a shared pool.
  const contested = [...demand].filter(([, wanting]) => wanting.length > maxTeamSize)
  stats.contestedProjects = contested.length
  const state = contested.map(([name, wanting]) => ({
    name,
    wanting,
    results: new Map<string, number>(),
    failed: false,
  }))
  const tasks = state.flatMap((proj) =>
    proj.wanting.map((s) => async () => {
      if (proj.failed) return
      const projectText = projectSkills.get(proj.name)!
      const key = fingerprint(model, s.skills, projectText)
      try {
        let score = cache.get(key)
        if (score === undefined) {
          score = await scoreWithGemini(s.skills, projectText)
          cache.set(key, score)
        }
        proj.results.set(s.id, score / 3)
      } catch (err) {
        proj.failed = true
        stats.error ??= (err as Error).message
        console.warn(`[skill-fit] ${proj.name}: LLM scoring failed, using TF-IDF for this project:`, (err as Error).message)
      }
    })
  )

  let next = 0
  await Promise.all(
    Array.from({length: Math.min(CONCURRENCY, tasks.length)}, async () => {
      while (next < tasks.length) await tasks[next++]!()
    })
  )

  // Only keep a project's scores if every student competing for it was scored.
  const out: Record<string, Record<string, number>> = {}
  for (const proj of state) {
    if (proj.failed || proj.results.size !== proj.wanting.length) {
      stats.projectsFellBack.push(proj.name)
      continue
    }
    stats.projectsScored++
    stats.studentsScored += proj.results.size
    for (const [id, score] of proj.results) (out[id] ??= {})[proj.name] = score
  }
  // Nothing contested means nothing needed scoring; that is not a failure.
  if (stats.contestedProjects > 0 && stats.projectsScored === 0) stats.provider = 'tfidf'
  return {scores: out, stats}
}
