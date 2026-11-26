/**
 * Purpose
 * Provide the ask flow logic used by other parts of ESA.
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
import { normalizeQuestionText } from './questionText'
import { validateAIPlan } from './harness'
import { executeQueryPlan } from './queryExecutor'
import type { StructuredQueryResult } from './queryExecutor'
import { aiSchemaCatalog } from './schemaCatalog'
import {
  enforceStructuredQueryPrivacy,
  PrivacyPolicyError,
} from './privacyPolicy'
import {
  executeStructuredQueryRequest,
  type StructuredAIResponse,
} from './structuredResponse'
import type { StructuredQueryPlan } from './queryPlan'

export type AskFlowResult =
  | { kind: 'legacy'; plan: Record<string, unknown>; data: unknown }
  | ({ kind: 'v1'; apiVersion: 1; plan: StructuredQueryPlan } & StructuredAIResponse)

export type AskFlowOptions = {
  authorized: boolean
  previousQuestion?: string
  requestPlan: (messages: Array<{ role: 'system' | 'user'; content: string }>) => Promise<unknown>
  executeV1?: (plan: StructuredQueryPlan) => Promise<StructuredQueryResult>
  executeLegacy?: (plan: unknown) => Promise<unknown>
}

// Define MAX_PLAN_ATTEMPTS for the steps below.
const MAX_PLAN_ATTEMPTS = 2

// Define the helper that will run aiquestion.
export async function runAIQuestion(
  question: string,
  selectedSemester: string | undefined,
  options: AskFlowOptions
): Promise<AskFlowResult | StructuredAIResponse> {
  // Check whether !options.authorized before running this branch.
  if (!options.authorized) {
    // Pass { status: 'execution_error', explanation: 'You are not authorized to run this database search.' } back to the caller.
    return { status: 'execution_error', explanation: 'You are not authorized to run this database search.' }
  }

  // Use question.trim to initialize originalQuestion.
  const originalQuestion = question.trim()
  // Update question with the value on the right.
  question = normalizeQuestionText(question)
  // Use options.previousQuestion?.trim to initialize previous.
  const previous = options.previousQuestion?.trim()
  // Define scopeQuestion for the steps below.
  const scopeQuestion = previous ? `${previous} Follow-up: ${question}` : question
  // Define messages for the steps below.
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    { role: 'system', content: plannerInstructions },
    {
      role: 'user',
      content: `Dashboard semester: ${selectedSemester ?? 'all semesters'}\nOriginal wording: ${originalQuestion}\n${previous ? `Previous question (context only): ${previous}\n` : ""}Question: ${question}`,
    },
  ]
  // Define repairFeedback for the steps below.
  let repairFeedback = ''

  for (let attempt = 0; attempt < MAX_PLAN_ATTEMPTS; attempt++) {
    // Define rawPlan for the steps below.
    let rawPlan: unknown
    try {
      // Update rawPlan with the value on the right.
      rawPlan = await options.requestPlan(messages)
    } catch {
      // Pass { status: 'execution_error', explanation: 'The AI planner could not be reached. Please try again.' } back to the caller.
      return { status: 'execution_error', explanation: 'The AI planner could not be reached. Please try again.' }
    }
    try {
      // Update rawPlan with the value on the right.
      rawPlan = parsePlannerResponse(rawPlan)
    } catch {
      // Update repairFeedback with the value on the right.
      repairFeedback = 'The response was not valid JSON. Return one valid JSON object only.'
      // Check whether attempt + 1 < MAX_PLAN_ATTEMPTS before running this branch.
      if (attempt + 1 < MAX_PLAN_ATTEMPTS) messages.push(...repairMessages(repairFeedback))
      continue
    }

    // Check whether isRecord(rawPlan) && rawPlan.operation === 'unsupported' before running this branch.
    if (isRecord(rawPlan) && rawPlan.operation === 'unsupported') {
      // Pass { status: 'unsupported_capability', explanation: 'This request needs data or an operation that is no back to the caller.
      return { status: 'unsupported_capability', explanation: 'This request needs data or an operation that is not available to the academic search.' }
    }
    // Check whether isRecord(rawPlan) && rawPlan.operation === 'clarification_needed' before running this branch.
    if (isRecord(rawPlan) && rawPlan.operation === 'clarification_needed') {
      // Pass { status: 'clarification_needed', explanation: typeof rawPlan.question === 'string' && rawPlan.quest back to the caller.
      return {
        status: 'clarification_needed',
        explanation: typeof rawPlan.question === 'string' && rawPlan.question.trim() ? rawPlan.question.trim().slice(0, 300) : 'Which records, time period, or grouping would you like?',
      }
    }

    // Check whether isRecord(rawPlan) && rawPlan.version === 1 before running this branch.
    if (isRecord(rawPlan) && rawPlan.version === 1) {
      try {
        // Use applySelectedSemesterV1 to initialize contextual.
        const contextual = applySelectedSemesterV1(rawPlan, selectedSemester, scopeQuestion)
        // Call assertRequestedSemesterRepresented to run this step.
        assertRequestedSemesterRepresented(contextual, scopeQuestion)
        // Use enforceStructuredQueryPrivacy to initialize plan.
        const plan = enforceStructuredQueryPrivacy(contextual)
        // Define response for the steps below.
        const response = await executeStructuredQueryRequest(plan, {
          authorized: true,
          ...(options.executeV1 ? { execute: options.executeV1 } : {}),
        })
        // Pass { kind: 'v1', apiVersion: 1, plan, ...response } back to the caller.
        return { kind: 'v1', apiVersion: 1, plan, ...response }
      } catch (error) {
        // Check whether error instanceof PrivacyPolicyError before running this branch.
        if (error instanceof PrivacyPolicyError) {
          // Pass { status: 'privacy_restricted', explanation: 'This request involves restricted personal or student i back to the caller.
          return { status: 'privacy_restricted', explanation: 'This request involves restricted personal or student information.' }
        }
        // Update repairFeedback with the value on the right.
        repairFeedback = structuredPlanRepairFeedback(error)
      }
    } else {
      // Define legacyPlan for the steps below.
      let legacyPlan: ReturnType<typeof validateAIPlan>
      try {
        // Update legacyPlan with the value on the right.
        legacyPlan = validateAIPlan(applySelectedSemesterLegacy(rawPlan, selectedSemester, scopeQuestion))
        // Call assertRequestedSemesterRepresented to run this step.
        assertRequestedSemesterRepresented(legacyPlan, scopeQuestion)
      } catch {
        // Update repairFeedback with the value on the right.
        repairFeedback = legacyPlanRepairFeedback()
        // Check whether attempt + 1 < MAX_PLAN_ATTEMPTS before running this branch.
        if (attempt + 1 < MAX_PLAN_ATTEMPTS) messages.push(...repairMessages(repairFeedback))
        continue
      }
      try {
        // Define data for the steps below.
        const data = await (options.executeLegacy ?? executeQueryPlan)(legacyPlan)
        // Pass { kind: 'legacy', plan: legacyPlan as unknown as Record<string, unknown>, data } back to the caller.
        return { kind: 'legacy', plan: legacyPlan as unknown as Record<string, unknown>, data }
      } catch {
        // Pass { status: 'execution_error', explanation: 'The database search could not be completed. Please try ag back to the caller.
        return { status: 'execution_error', explanation: 'The database search could not be completed. Please try again.' }
      }
    }

    // Check whether attempt + 1 < MAX_PLAN_ATTEMPTS before running this branch.
    if (attempt + 1 < MAX_PLAN_ATTEMPTS) messages.push(...repairMessages(repairFeedback))
  }

  // Pass { status: 'unsupported_capability', explanation: 'The request could not be represented as a valid su back to the caller.
  return {
    status: 'unsupported_capability',
    explanation: 'The request could not be represented as a valid supported database query.',
  }
}

// Define the helper that will structured plan repair feedback.
function structuredPlanRepairFeedback(error: unknown): string {
  // Define message for the steps below.
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  // Check whether /semester/.test(message) before running this branch.
  if (/semester/.test(message)) {
    // Pass 'The requested semester is missing. Include the requested year AND season in where, using correlated back to the caller.
    return 'The requested semester is missing. Include the requested year AND season in where, using correlated Teams -> Semester relations for Project, Semester for Team, or Projects -> Teams -> Semester for Partner. For comparisons group by semester year and season. Do not change the requested grouping or chart.'
  }
  // Check whether /field|relation|model|approved|schema/.test(message) before running this branch.
  if (/field|relation|model|approved|schema/.test(message)) {
    // Pass 'Use only exact model, field, and relationship names from the supplied allowlisted catalog. Preserve back to the caller.
    return 'Use only exact model, field, and relationship names from the supplied allowlisted catalog. Preserve all requested conditions.'
  }
  // Check whether /filter|operator|enum|value|integer/.test(message) before running this branch.
  if (/filter|operator|enum|value|integer/.test(message)) {
    // Pass 'Correct the filter structure and value types using approved fields and operators. Do not remove or  back to the caller.
    return 'Correct the filter structure and value types using approved fields and operators. Do not remove or weaken requested filters.'
  }
  // Check whether /aggregate|numeric|percentage|scope|calculation|count/.test(message) before running this branch.
  if (/aggregate|numeric|percentage|scope|calculation|count/.test(message)) {
    // Pass 'Correct the aggregate or calculation structure, using compatible approved metrics and explicit perc back to the caller.
    return 'Correct the aggregate or calculation structure, using compatible approved metrics and explicit percentage scopes. Preserve requested calculations.'
  }
  // Check whether /chart|group|sort|limit/.test(message) before running this branch.
  if (/chart|group|sort|limit/.test(message)) {
    // Pass 'Correct the grouping, chart, sorting, or limit structure to a supported combination while preservin back to the caller.
    return 'Correct the grouping, chart, sorting, or limit structure to a supported combination while preserving the requested output.'
  }
  // Pass 'Correct the structured plan to match the documented v1 representation without changing requested fi back to the caller.
  return 'Correct the structured plan to match the documented v1 representation without changing requested fields, filters, calculations, or time period.'
}

// Define the helper that will legacy plan repair feedback.
function legacyPlanRepairFeedback(): string {
  // Pass 'Choose the exact legacy project search/count form or protected enrollment aggregate form shown abov back to the caller.
  return 'Choose the exact legacy project search/count form or protected enrollment aggregate form shown above. Keep the requested semester, grouping, and chart type; use the v1 catalog for other supported project, partner, team, or semester questions.'
}

// Define the helper that will repair messages.
function repairMessages(feedback: string): Array<{ role: 'system' | 'user'; content: string }> {
  // Pass [ { role: 'system', content: 'Repair the previous query plan. Return exactly one JSON object and no  back to the caller.
  return [
    { role: 'system', content: 'Repair the previous query plan. Return exactly one JSON object and no prose. Do not remove requested conditions. Never return SQL or Prisma arguments.' },
    { role: 'user', content: `Validation feedback: ${feedback}` },
  ]
}

// Define the helper that will parse planner response.
function parsePlannerResponse(value: unknown): unknown {
  // Check whether typeof value === 'string' before running this branch.
  if (typeof value === 'string') return JSON.parse(value)
  // Check whether isRecord(value) before running this branch.
  if (isRecord(value)) return value
  // Stop this operation and tell the caller why it cannot continue.
  throw new Error('Invalid planner response')
}

// Define the helper that will apply selected semester v1.
function applySelectedSemesterV1(
  input: Record<string, unknown>,
  code: string | undefined,
  question: string
): Record<string, unknown> {
  // Check whether !code || questionRequestsSemesterScope(question) before running this branch.
  if (!code || questionRequestsSemesterScope(question)) return input
  // Define year for the steps below.
  const year = 2000 + Number(code.slice(2))
  // Use code.slice to initialize prefix.
  const prefix = code.slice(0, 2)
  // Define season for the steps below.
  const season = prefix === 'SP' ? 'SPRING' : prefix === 'SU' ? 'SUMMER' : 'FALL'
  // Define model for the steps below.
  const model = input.model
  // Define where for the steps below.
  const where = input.where
  // Define semesterFilter for the steps below.
  let semesterFilter: Record<string, unknown>
  // Check whether model === 'Semester' before running this branch.
  if (model === 'Semester') {
    // Update semesterFilter with the value on the right.
    semesterFilter = { and: [
      { field: 'year', operator: 'eq', value: year },
      { field: 'season', operator: 'eq', value: season },
    ] }
  } else {
    // Define teamSemester for the steps below.
    const teamSemester = {
      relation: 'Semester',
      quantifier: 'is',
      where: { and: [
        { field: 'year', operator: 'eq', value: year },
        { field: 'season', operator: 'eq', value: season },
      ] },
    }
    // Check whether model === 'Project' before running this branch.
    if (model === 'Project') {
      // Update semesterFilter with the value on the right.
      semesterFilter = { relation: 'Teams', quantifier: 'some', where: teamSemester }
    } else if (model === 'Team') {
      // Update semesterFilter with the value on the right.
      semesterFilter = teamSemester
    } else if (model === 'Partner') {
      // Update semesterFilter with the value on the right.
      semesterFilter = {
        relation: 'Projects', quantifier: 'some',
        where: { relation: 'Teams', quantifier: 'some', where: teamSemester },
      }
    } else {
      // Pass input back to the caller.
      return input
    }
  }
  // Pass { ...input, where: where === undefined ? semesterFilter : { and: [where, semesterFilter] } } back to the caller.
  return { ...input, where: where === undefined ? semesterFilter : { and: [where, semesterFilter] } }
}

// Define the helper that will apply selected semester legacy.
function applySelectedSemesterLegacy(input: unknown, code: string | undefined, question: string): unknown {
  // Check whether !code || questionRequestsSemesterScope(question) || !isRecord(input) before running this branch.
  if (!code || questionRequestsSemesterScope(question) || !isRecord(input)) return input
  // Check whether input.source === 'projects' || input.source === 'partners' || input.source === 'teams' before running this branch.
  if (input.source === 'projects' || input.source === 'partners' || input.source === 'teams') {
    // Define filters for the steps below.
    const filters = Array.isArray(input.filters) ? input.filters : []
    // Define paths for the steps below.
    const paths = legacySemesterFields[input.source]
    // Check whether filters.some((filter) => isRecord(filter) && paths.includes(filter.field as never)) before running this branch.
    if (filters.some((filter) => isRecord(filter) && paths.includes(filter.field as never))) return input
    // Define year for the steps below.
    const year = 2000 + Number(code.slice(2))
    // Use code.slice to initialize prefix.
    const prefix = code.slice(0, 2)
    // Define season for the steps below.
    const season = prefix === 'SP' ? 'SPRING' : prefix === 'SU' ? 'SUMMER' : 'FALL'
    // Pass { ...input, filters: [...filters, { field: paths[0], operator: 'eq', value: year }, { field: paths[1 back to the caller.
    return { ...input, filters: [...filters,
      { field: paths[0], operator: 'eq', value: year },
      { field: paths[1], operator: 'eq', value: season },
    ] }
  }
  // Check whether (input.entity === 'projects' || input.entity === 'enrollments') && isRecord(input.filters) && input. before running this branch.
  if ((input.entity === 'projects' || input.entity === 'enrollments') && isRecord(input.filters) && input.filters.semester === undefined) {
    // Pass { ...input, filters: { ...input.filters, semester: code } } back to the caller.
    return { ...input, filters: { ...input.filters, semester: code } }
  }
  // Pass input back to the caller.
  return input
}

// Define legacySemesterFields for the steps below.
const legacySemesterFields = {
  projects: ['teams.semester.year', 'teams.semester.season'],
  partners: ['projects.teams.semester.year', 'projects.teams.semester.season'],
  teams: ['semester.year', 'semester.season'],
} as const

// Define the helper that will question requests semester scope.
function questionRequestsSemesterScope(question: string): boolean {
  // Pass /\b(?:spring|summer|fall)(?:\s+(?:semester|term))?(?:\s+(?:20)?\d{2})?\b|\b20\d{2}\b|\b(?:across|bet back to the caller.
  return /\b(?:spring|summer|fall)(?:\s+(?:semester|term))?(?:\s+(?:20)?\d{2})?\b|\b20\d{2}\b|\b(?:across|between|compare|comparison|trend|over time|each|by semester|previous semester|last semester|next semester)\b/i.test(question)
}

// Define the helper that will assert requested semester represented.
function assertRequestedSemesterRepresented(plan: unknown, question: string): void {
  // Check whether !questionRequestsSemesterScope(question) before running this branch.
  if (!questionRequestsSemesterScope(question)) return
  // Check whether !isRecord(plan) before running this branch.
  if (!isRecord(plan)) throw new Error('Semester scope is missing')
  // Use /\b(?:across|between|compare|comparison|trend|over time|each|by semester)\b/i.test to initialize comparison.
  const comparison = /\b(?:across|between|compare|comparison|trend|over time|each|by semester)\b/i.test(question)
  // Check whether 'version' in plan && plan.version === 1 before running this branch.
  if ('version' in plan && plan.version === 1) {
    // Define paths for the steps below.
    const paths = Array.isArray(plan.groupBy) ? plan.groupBy : []
    // Use JSON.stringify to initialize filters.
    const filters = JSON.stringify(plan.where ?? {})
    // Define hasYearOrSeason for the steps below.
    const hasYearOrSeason = paths.some((path) => typeof path === 'string' && /(?:^|\.)year$|(?:^|\.)season$/i.test(path)) || /"field":"(?:[^"\\]*\.)?(?:year|season)"/.test(filters)
    // Use paths.some to initialize hasComparisonGrouping.
    const hasComparisonGrouping = paths.some((path) => typeof path === 'string' && /(?:^|\.)(?:year|season)$/i.test(path))
    // Check whether !hasYearOrSeason || (comparison && !hasComparisonGrouping) before running this branch.
    if (!hasYearOrSeason || (comparison && !hasComparisonGrouping)) throw new Error('Requested semester scope is not represented')
    return
  }
  // Check whether 'source' in plan before running this branch.
  if ('source' in plan) {
    // Define filters for the steps below.
    const filters = Array.isArray(plan.filters) ? plan.filters : []
    // Use filters.some to initialize hasDate.
    const hasDate = filters.some((filter) => isRecord(filter) && /(?:^|\.)(?:year|season)$/.test(String(filter.field)))
    // Define dimensions for the steps below.
    const dimensions = Array.isArray(plan.dimensions) ? plan.dimensions : []
    // Use dimensions.some to initialize grouped.
    const grouped = dimensions.some((path) => typeof path === 'string' && /(?:^|\.)(?:year|season)$/.test(path))
    // Check whether !hasDate || (comparison && !grouped) before running this branch.
    if (!hasDate || (comparison && !grouped)) throw new Error('Requested semester scope is not represented')
    return
  }
  // Define filters for the steps below.
  const filters = isRecord(plan.filters) ? plan.filters : {}
  // Check whether typeof filters.semester !== 'string' || comparison before running this branch.
  if (typeof filters.semester !== 'string' || comparison) throw new Error('Requested semester scope is not represented')
}

// Define the helper that will is record.
function isRecord(value: unknown): value is Record<string, unknown> {
  // Pass typeof value === 'object' && value !== null && !Array.isArray(value) back to the caller.
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Use Object.values(aiSchemaCatalog).map to initialize catalogDescription.
const catalogDescription = Object.values(aiSchemaCatalog).map((model) => ({
  model: model.name,
  fields: Object.values(model.fields).map((field) => ({ name: field.name, type: field.type, ...(field.enumValues ? { enumValues: field.enumValues } : {}) })),
  relationships: Object.values(model.relations).map((relation) => ({ name: relation.name, target: relation.target, cardinality: relation.cardinality })),
}))

// Define plannerInstructions for the steps below.
export const plannerInstructions = `You are the ESA AI database query planner. Return exactly one JSON object. You generate structured plans only; never return database results, SQL, code, Prisma arguments, markdown, or prose.

Understand everyday natural language, fragments, abbreviations, missing punctuation, repeated letters, and misspellings. Do not demand exact keywords or word order. "2026 fall year", "fall 26", "FA26", and "fall 2026" mean Fall 2026, not student class standing. Infer obvious intent conservatively; never invent data or silently change a name to another person. Interpret chart names even when misspelled. The latest follow-up can change the requested chart or grouping while preserving the previous question's other conditions. "make it pie" means the same query in a pie chart. If the meaning genuinely cannot be determined, ask one specific short clarification using the clarification_needed form.
For a bare request such as "sankey graph 2026 fall year", show Fall 2026 projects flowing from project type to project status using actual project counts, with source and target labels displayed. If the user specifies different dimensions, use those where supported. Never manufacture student-level flows or coordinates. Use written summaries for simple counts and tables for lists; do not force a graph on every question.

Preferred plan: v1 structured query for supported non-sensitive academic questions:
{"version":1,"model":"Project|Partner|Team|Semester","select":["approved.path"],"where":{"field":"approved.path","operator":"eq|ne|in|notIn|contains|startsWith|endsWith|gt|gte|lt|lte","value":"typed value"},"groupBy":["approved.path"],"aggregates":[{"function":"count|countDistinct|sum|avg|min|max","field":"approved.path","alias":"metric","scope":"group|overall"}],"calculations":[{"function":"percentage","numerator":"metricAlias","denominator":"metricAlias","alias":"percent"}],"orderBy":[{"field":"approved.path or metric alias","direction":"asc|desc"}],"limit":50,"chartType":"bar|line|area|pie|doughnut|polarArea|radar|scatter|bubble|horizontalBar|stackedBar|sankey|table"}

Only use this exact allowlisted Prisma catalog (relationship names are case-sensitive): ${JSON.stringify(catalogDescription)}
Use one or more structured filters. Put conditions for one related record inside the same relation quantifier so they stay correlated. count counts root records; countDistinct counts unique field values. Sum/average require numeric fields. Percentages require two explicit metrics with matching function and field, and explicit group/overall scope. Do not invent fields or relationships. V1 is strictly limited to the four models in its catalog and must never access student, enrollment, membership, choice, contact, or authentication records. Generalized student analytics are disabled.

For a requested Sankey diagram, use v1 only for approved non-student data, with exactly two categorical groupBy fields and exactly one numeric aggregate. The first dimension is the source and the second is the target; the aggregate is the flow weight. Do not request a Sankey for student/enrollment data, and never invent flow values.

For supported project questions, prefer v1 instead of returning unsupported. For example, projects by type as a chart:
{"version":1,"model":"Project","groupBy":["type"],"aggregates":[{"function":"count","alias":"projects"}],"chartType":"bar"}
For example, projects by type in Fall 2026 must include the semester filter:
{"version":1,"model":"Project","where":{"relation":"Teams","quantifier":"some","where":{"relation":"Semester","quantifier":"is","where":{"and":[{"field":"year","operator":"eq","value":2026},{"field":"season","operator":"eq","value":"FALL"}]}}},"groupBy":["type"],"aggregates":[{"function":"count","alias":"projects"}],"chartType":"bar"}
Project detail selections use v1 fields such as select ["name","description","type","status","Partner.name"]. Use exact case-sensitive relationship names from the catalog. Omit chartType when no chart is requested; the dashboard can choose a suitable default for one categorical dimension and one numeric metric. Set chartType to the requested style when the user names one. Use table only when a table is explicitly requested.

Compatibility plans (use only when necessary):
- Project search/count: {"entity":"projects","operation":"search|count","filters":{"keyword":"optional partial text","type":"SOFTWARE|HARDWARE|BOTH","status":"NEW|RETURNING|COMPLETE|WITHDRAWN|HOLD","semester":"SP26"},"groupBy":"none"}. Use this when the user requests partial keyword search.
- Protected enrollment aggregate (the only permitted student-related exception): {"entity":"enrollments","operation":"count","filters":{"semester":"SP26","major":"optional major","year":"FRESHMAN|SOPHOMORE|JUNIOR|SENIOR"},"groupBy":"none|major|year","chartType":"optional chart type"}. This path returns privacy-protected aggregate counts only; it never returns student/enrollment records. Use at most one demographic filter, and use no demographic filters when grouping by major or year. Groups below the privacy threshold are suppressed. For example, a requested majors pie chart for Spring 2026 is:
{"entity":"enrollments","operation":"count","filters":{"semester":"SP26"},"groupBy":"major","chartType":"pie"}
- Existing legacy analytics: {"source":"projects|partners|teams|semesters","filters":[{"field":"approved legacy path","operator":"eq|in","value":"typed value"}],"dimensions":["approved legacy path"],"metrics":[{"function":"count|countDistinct","field":"only for countDistinct","alias":"count"}],"chartType":"optional chart type"}. Use only if the question cannot be represented accurately with v1.
Otherwise prefer v1. If the request is ambiguous, return {"operation":"clarification_needed","question":"short question"}. If unsupported or sensitive, return {"operation":"unsupported"}.
Do not omit requested fields, filters, semesters, grouping, sorting, or calculations. If the user explicitly requests a semester or comparison across semesters, represent that scope in the plan. The dashboard semester is context only and will be applied by the server only when the question does not specify a semester or comparison.`
