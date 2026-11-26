/**
 * Purpose
 * Speed up frequent report requests.
 *
 * Inputs
 * - The current question, any previous plan, and model request details.
 *
 * Outputs
 * - A reusable plan or the result of a fresh planner call.
 *
 * Pseudocode
 * Check for a direct lookup or follow-up → reuse a matching plan if available → ask the model when interpretation is needed.
 */
import { createHash } from 'node:crypto'
import {
  validateAcademicPlan,
  requestedAcademicChart,
  academicRows,
  type AcademicPlan,
} from './academicReport'
// Define plans for the steps below.
const plans = new Map<string, { expires: number; value: unknown }>()
// Define the helper that will cached report plan.
export async function cachedReportPlan(
  userId: string,
  model: string,
  messages: unknown,
  request: () => Promise<unknown>
) {
  // Use createHash('sha256') .update(JSON.stringify([userId, model, messages])) .digest to initialize key.
  const key = createHash('sha256')
    .update(JSON.stringify([userId, model, messages]))
    .digest('hex')
  // Use Date.now to initialize now.
  const now = Date.now()
  // Use plans.get to initialize saved.
  const saved = plans.get(key)
  // Check whether saved && saved.expires > now before running this branch.
  if (saved && saved.expires > now) return saved.value
  // Repeat the following steps for each item in plans.
  for (const [id, item] of plans) if (item.expires < now) plans.delete(id)
  // Define result for the steps below.
  const result = await request()
  // Call plans.set to run this step.
  plans.set(key, { value: result, expires: now + 10 * 60 * 1000 })
  // Check whether plans.size > 250 before running this branch.
  if (plans.size > 250) plans.delete(plans.keys().next().value!)
  // Pass result back to the caller.
  return result
}
// Define the helper that will local refinement.
export function localRefinement(previous: unknown, question: string): AcademicPlan | undefined {
  // Check whether !previous before running this branch.
  if (!previous) return
  // Define plan for the steps below.
  let plan: AcademicPlan
  try {
    // Update plan with the value on the right.
    plan = validateAcademicPlan(previous)
  } catch {
    return
  }
  // Update plan with the value on the right.
  plan = structuredClone(plan)
  // Use question .trim() .toLowerCase() .replace to initialize q.
  const q = question
    .trim()
    .toLowerCase()
    .replace(/[?!.]+$/, '')
  // Check whether /^(?:show (?:the )?)?(?:next page|more|next results)$/.test(q) && ['list', 'summary'].includes(plan. before running this branch.
  if (
    /^(?:show (?:the )?)?(?:next page|more|next results)$/.test(q) &&
    ['list', 'summary'].includes(plan.view)
  ) {
    plan.offset += plan.limit
    // Pass plan back to the caller.
    return plan
  }
  // Check whether /^(?:show )?all(?: (?:results|rows|students|projects))?$/.test(q) before running this branch.
  if (/^(?:show )?all(?: (?:results|rows|students|projects))?$/.test(q)) {
    // Update plan.limit with the value on the right.
    plan.limit = 1000
    // Update plan.offset with the value on the right.
    plan.offset = 0
    // Pass plan back to the caller.
    return plan
  }
  // Check whether /^(?:and )?(?:spring|summer|fall)(?:\s+(?:20)?\d{2})?(?: instead)?$/.test(q) && !plan.calculations?. before running this branch.
  if (
    /^(?:and )?(?:spring|summer|fall)(?:\s+(?:20)?\d{2})?(?: instead)?$/.test(q) &&
    !plan.calculations?.length
  ) {
    // Update plan.filters with the value on the right.
    plan.filters = plan.filters.filter((f) => !['semester', 'academicYear'].includes(f.field))
    // Update plan.offset with the value on the right.
    plan.offset = 0
    // Pass plan back to the caller.
    return plan
  }
  // Use requestedAcademicChart to initialize style.
  const style = requestedAcademicChart(q)
  // Check whether style && /^(?:(?:make (?:it|that|this)|use|change (?:it|that|this) to) (?:a |an )?)?(?:horizontal ba before running this branch.
  if (
    style &&
    /^(?:(?:make (?:it|that|this)|use|change (?:it|that|this) to) (?:a |an )?)?(?:horizontal bar|stacked bar|polar area|pie|bar|line|area|sankey|donut|doughnut|radar|scatter|bubble)(?: (?:chart|graph))?(?: instead)?$/.test(
      q
    )
  ) {
    // Update plan.chartType with the value on the right.
    plan.chartType = style as AcademicPlan['chartType']
    // Update plan.view with the value on the right.
    plan.view = 'chart'
    // Update plan.offset with the value on the right.
    plan.offset = 0
    // Check whether ['pie', 'doughnut', 'radar', 'polarArea'].includes(style) before running this branch.
    if (['pie', 'doughnut', 'radar', 'polarArea'].includes(style)) delete plan.axes
    try {
      // Pass validateAcademicPlan(plan) back to the caller.
      return validateAcademicPlan(plan)
    } catch {
      return
    }
  }
  // Define standing for the steps below.
  const standing = q.match(
    /^only (?:the )?(first[- ]years?|freshmen|freshman|second[- ]years?|sophomores?|third[- ]years?|juniors?|fourth[- ]years?|seniors?)$/
  )?.[1]
  // Check whether standing && ['students', 'assignments', 'preferences'].includes(plan.source) before running this branch.
  if (standing && ['students', 'assignments', 'preferences'].includes(plan.source)) {
    // Define year for the steps below.
    const year = /first|fresh/.test(standing)
      ? '1st Year'
      : /second|soph/.test(standing)
        ? '2nd Year'
        : /third|junior/.test(standing)
          ? '3rd Year'
          : '4th Year'
    // Update plan.filters with the value on the right.
    plan.filters = [
      ...plan.filters.filter((f) => f.field !== 'classYear'),
      { field: 'classYear', operator: 'eq', value: year },
    ]
    // Update plan.offset with the value on the right.
    plan.offset = 0
    // Pass plan back to the caller.
    return plan
  }
  // Check whether /^(?:exclude|remove|hide) (?:the )?unknowns?(?: values)?$/.test(q) && plan.groupBy.length before running this branch.
  if (/^(?:exclude|remove|hide) (?:the )?unknowns?(?: values)?$/.test(q) && plan.groupBy.length) {
    // Update plan.filters with the value on the right.
    plan.filters = [
      ...plan.filters,
      ...plan.groupBy.map((field) => ({ field, operator: 'isNotEmpty' as const })),
    ]
    // Update plan.offset with the value on the right.
    plan.offset = 0
    // Pass plan back to the caller.
    return plan
  }
  // Use q.match to initialize top.
  const top = q.match(/^(?:show )?(top|bottom) (\d{1,3})$/)
  // Use plan.metrics.filter to initialize visible.
  const visible = plan.metrics.filter((m) => !m.hidden)
  // Check whether top && (plan.orderBy || visible.length === 1) before running this branch.
  if (top && (plan.orderBy || visible.length === 1)) {
    // Update plan.limit with the value on the right.
    plan.limit = Math.min(1000, Math.max(1, Number(top[2])))
    // Update plan.offset with the value on the right.
    plan.offset = 0
    // Update plan.orderBy with the value on the right.
    plan.orderBy = {
      field: plan.orderBy?.field ?? visible[0]!.alias,
      direction: top[1] === 'top' ? 'desc' : 'asc',
    }
    // Pass plan back to the caller.
    return plan
  }
  return
}
// Define the helper that will local lookup.
export function localLookup(question: string): unknown | undefined {
  // Use question .toLowerCase() .replace(/[?!.,]/g, ' ') .replace(/\s+/g, ' ') .trim to initialize q.
  const q = question
    .toLowerCase()
    .replace(/[?!.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  // Check whether /^(?:show (?:me )?(?:a )?)?stacked bar (?:chart|graph) of students by (?:semester and course|course  before running this branch.
  if (
    /^(?:show (?:me )?(?:a )?)?stacked bar (?:chart|graph) of students by (?:semester and course|course and semester)(?: across (?:all )?semesters)?$/.test(
      q
    )
  ) {
    // Pass { source: 'students', view: 'chart', chartType: 'stackedBar', groupBy: ['semester', 'course'], metri back to the caller.
    return {
      source: 'students',
      view: 'chart',
      chartType: 'stackedBar',
      groupBy: ['semester', 'course'],
      metrics: [{ function: 'countDistinct', field: 'studentId', alias: 'students' }],
    }
  }
  // Check whether /\b(compare|versus|vs|except|exclude|only|not|major|gender|course|class|first choice|skills|percenta before running this branch.
  if (
    /\b(compare|versus|vs|except|exclude|only|not|major|gender|course|class|first choice|skills|percentage|percent|average|sum|total team|graph|chart)\b/.test(
      q
    )
  )
    return
  // Use [...new Set(academicRows('projects').map((row) => String(row.project)))].filter to initialize names.
  const names = [...new Set(academicRows('projects').map((row) => String(row.project)))].filter(
    (name) =>
      q.includes(
        name
          .toLowerCase()
          .replace(/[?!.,]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      )
  )
  // Check whether names.length === 1 before running this branch.
  if (names.length === 1) {
    // Check whether /^(?:who|which|what)\b/.test(q) && /\bpartner\b/.test(q) && /\b(?:for|of)\b/.test(q) before running this branch.
    if (/^(?:who|which|what)\b/.test(q) && /\bpartner\b/.test(q) && /\b(?:for|of)\b/.test(q))
      // Pass { source: 'projects', view: 'list', select: ['project', 'projectNumber', 'partner', 'semester'], fil back to the caller.
      return {
        source: 'projects',
        view: 'list',
        select: ['project', 'projectNumber', 'partner', 'semester'],
        filters: [{ field: 'project', operator: 'eq', value: names[0] }],
      }
    // Check whether /\b(?:who (?:is|was|are|were) working|who worked|team for|people (?:on|assigned to)|students (?:on|a before running this branch.
    if (
      /\b(?:who (?:is|was|are|were) working|who worked|team for|people (?:on|assigned to)|students (?:on|assigned to))\b/.test(
        q
      )
    )
      // Pass { source: 'assignments', view: 'list', select: ['studentName', 'project', 'partner', 'semester', 'co back to the caller.
      return {
        source: 'assignments',
        view: 'list',
        select: ['studentName', 'project', 'partner', 'semester', 'course', 'classYear'],
        filters: [{ field: 'project', operator: 'eq', value: names[0] }],
      }
  }
  // Use q .replace( /\b(?:spring|summer|fall)\s*(?:20)?\d{2}\b|\b20\d{2}\s*(?:spring|summer|fall)\b|\b(?:sp| to initialize clean.
  const clean = q
    .replace(
      /\b(?:spring|summer|fall)\s*(?:20)?\d{2}\b|\b20\d{2}\s*(?:spring|summer|fall)\b|\b(?:sp|su|fa)\d{2}\b|\b(?:spring|summer|fall)\b|\b20\d{2}\b/g,
      ''
    )
    .replace(
      /\b(?:please|are|is|there|enrolled|in|for|the|this|selected|semester|semesters|currently|recorded|all)\b/g,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim()
  // Use clean.match to initialize count.
  const count = clean.match(
    /^(?:how many|count|number of|total) (students|enrollments|projects|partners|preferences|mentors|contacts)$/
  )
  // Check whether count before running this branch.
  if (count) {
    // Define source for the steps below.
    const source = count[1] === 'enrollments' ? 'students' : count[1]
    // Pass { source, view: 'count', ...(count[1] === 'enrollments' ? { metrics: [{ function: 'count', alias: 'e back to the caller.
    return {
      source,
      view: 'count',
      ...(count[1] === 'enrollments'
        ? { metrics: [{ function: 'count', alias: 'enrollments' }] }
        : {}),
    }
  }
}
