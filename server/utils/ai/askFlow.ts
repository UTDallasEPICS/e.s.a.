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
  requestPlan: (messages: Array<{ role: 'system' | 'user'; content: string }>) => Promise<unknown>
  executeV1?: (plan: StructuredQueryPlan) => Promise<StructuredQueryResult>
  executeLegacy?: (plan: unknown) => Promise<unknown>
}

const MAX_PLAN_ATTEMPTS = 2

export async function runAIQuestion(
  question: string,
  selectedSemester: string | undefined,
  options: AskFlowOptions
): Promise<AskFlowResult | StructuredAIResponse> {
  if (!options.authorized) {
    return { status: 'execution_error', explanation: 'You are not authorized to run this database search.' }
  }

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    { role: 'system', content: plannerInstructions },
    {
      role: 'user',
      content: `Dashboard semester: ${selectedSemester ?? 'all semesters'}\nQuestion: ${question.trim()}`,
    },
  ]
  let repairFeedback = ''

  for (let attempt = 0; attempt < MAX_PLAN_ATTEMPTS; attempt++) {
    let rawPlan: unknown
    try {
      rawPlan = await options.requestPlan(messages)
    } catch {
      return { status: 'execution_error', explanation: 'The AI planner could not be reached. Please try again.' }
    }
    try {
      rawPlan = parsePlannerResponse(rawPlan)
    } catch {
      repairFeedback = 'The response was not valid JSON. Return one valid JSON object only.'
      if (attempt + 1 < MAX_PLAN_ATTEMPTS) messages.push(...repairMessages(repairFeedback))
      continue
    }

    if (isRecord(rawPlan) && rawPlan.operation === 'unsupported') {
      return { status: 'unsupported_capability', explanation: 'This request needs data or an operation that is not available to the academic search.' }
    }
    if (isRecord(rawPlan) && rawPlan.operation === 'clarification_needed') {
      return {
        status: 'clarification_needed',
        explanation: 'Please clarify which records, time period, or grouping you mean.',
      }
    }

    if (isRecord(rawPlan) && rawPlan.version === 1) {
      try {
        const contextual = applySelectedSemesterV1(rawPlan, selectedSemester, question)
        assertRequestedSemesterRepresented(contextual, question)
        const plan = enforceStructuredQueryPrivacy(contextual)
        const response = await executeStructuredQueryRequest(plan, {
          authorized: true,
          ...(options.executeV1 ? { execute: options.executeV1 } : {}),
        })
        return { kind: 'v1', apiVersion: 1, plan, ...response }
      } catch (error) {
        if (error instanceof PrivacyPolicyError) {
          return { status: 'privacy_restricted', explanation: 'This request involves restricted personal or student information.' }
        }
        repairFeedback = structuredPlanRepairFeedback(error)
      }
    } else {
      let legacyPlan: ReturnType<typeof validateAIPlan>
      try {
        legacyPlan = validateAIPlan(applySelectedSemesterLegacy(rawPlan, selectedSemester, question))
        assertRequestedSemesterRepresented(legacyPlan, question)
      } catch {
        repairFeedback = legacyPlanRepairFeedback()
        if (attempt + 1 < MAX_PLAN_ATTEMPTS) messages.push(...repairMessages(repairFeedback))
        continue
      }
      try {
        const data = await (options.executeLegacy ?? executeQueryPlan)(legacyPlan)
        return { kind: 'legacy', plan: legacyPlan as unknown as Record<string, unknown>, data }
      } catch {
        return { status: 'execution_error', explanation: 'The database search could not be completed. Please try again.' }
      }
    }

    if (attempt + 1 < MAX_PLAN_ATTEMPTS) messages.push(...repairMessages(repairFeedback))
  }

  return {
    status: 'unsupported_capability',
    explanation: 'The request could not be represented as a valid supported database query.',
  }
}

function structuredPlanRepairFeedback(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (/field|relation|model|approved|schema/.test(message)) {
    return 'Use only exact model, field, and relationship names from the supplied allowlisted catalog. Preserve all requested conditions.'
  }
  if (/filter|operator|enum|value|integer/.test(message)) {
    return 'Correct the filter structure and value types using approved fields and operators. Do not remove or weaken requested filters.'
  }
  if (/aggregate|numeric|percentage|scope|calculation|count/.test(message)) {
    return 'Correct the aggregate or calculation structure, using compatible approved metrics and explicit percentage scopes. Preserve requested calculations.'
  }
  if (/chart|group|sort|limit/.test(message)) {
    return 'Correct the grouping, chart, sorting, or limit structure to a supported combination while preserving the requested output.'
  }
  return 'Correct the structured plan to match the documented v1 representation without changing requested fields, filters, calculations, or time period.'
}

function legacyPlanRepairFeedback(): string {
  return 'Choose the exact legacy project search/count form or protected enrollment aggregate form shown above. Keep the requested semester, grouping, and chart type; use the v1 catalog for other supported project, partner, team, or semester questions.'
}

function repairMessages(feedback: string): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    { role: 'system', content: 'Repair the previous query plan. Return exactly one JSON object and no prose. Do not remove requested conditions. Never return SQL or Prisma arguments.' },
    { role: 'user', content: `Validation feedback: ${feedback}` },
  ]
}

function parsePlannerResponse(value: unknown): unknown {
  if (typeof value === 'string') return JSON.parse(value)
  if (isRecord(value)) return value
  throw new Error('Invalid planner response')
}

function applySelectedSemesterV1(
  input: Record<string, unknown>,
  code: string | undefined,
  question: string
): Record<string, unknown> {
  if (!code || questionRequestsSemesterScope(question)) return input
  const year = 2000 + Number(code.slice(2))
  const prefix = code.slice(0, 2)
  const season = prefix === 'SP' ? 'SPRING' : prefix === 'SU' ? 'SUMMER' : 'FALL'
  const model = input.model
  const where = input.where
  let semesterFilter: Record<string, unknown>
  if (model === 'Semester') {
    semesterFilter = { and: [
      { field: 'year', operator: 'eq', value: year },
      { field: 'season', operator: 'eq', value: season },
    ] }
  } else {
    const teamSemester = {
      relation: 'Semester',
      quantifier: 'is',
      where: { and: [
        { field: 'year', operator: 'eq', value: year },
        { field: 'season', operator: 'eq', value: season },
      ] },
    }
    if (model === 'Project') {
      semesterFilter = { relation: 'Teams', quantifier: 'some', where: teamSemester }
    } else if (model === 'Team') {
      semesterFilter = teamSemester
    } else if (model === 'Partner') {
      semesterFilter = {
        relation: 'Projects', quantifier: 'some',
        where: { relation: 'Teams', quantifier: 'some', where: teamSemester },
      }
    } else {
      return input
    }
  }
  return { ...input, where: where === undefined ? semesterFilter : { and: [where, semesterFilter] } }
}

function applySelectedSemesterLegacy(input: unknown, code: string | undefined, question: string): unknown {
  if (!code || questionRequestsSemesterScope(question) || !isRecord(input)) return input
  if (input.source === 'projects' || input.source === 'partners' || input.source === 'teams') {
    const filters = Array.isArray(input.filters) ? input.filters : []
    const paths = legacySemesterFields[input.source]
    if (filters.some((filter) => isRecord(filter) && paths.includes(filter.field as never))) return input
    const year = 2000 + Number(code.slice(2))
    const prefix = code.slice(0, 2)
    const season = prefix === 'SP' ? 'SPRING' : prefix === 'SU' ? 'SUMMER' : 'FALL'
    return { ...input, filters: [...filters,
      { field: paths[0], operator: 'eq', value: year },
      { field: paths[1], operator: 'eq', value: season },
    ] }
  }
  if ((input.entity === 'projects' || input.entity === 'enrollments') && isRecord(input.filters) && input.filters.semester === undefined) {
    return { ...input, filters: { ...input.filters, semester: code } }
  }
  return input
}

const legacySemesterFields = {
  projects: ['teams.semester.year', 'teams.semester.season'],
  partners: ['projects.teams.semester.year', 'projects.teams.semester.season'],
  teams: ['semester.year', 'semester.season'],
} as const

function questionRequestsSemesterScope(question: string): boolean {
  return /\b(?:spring|summer|fall)(?:\s+(?:semester|term))?(?:\s+(?:20)?\d{2})?\b|\b20\d{2}\b|\b(?:across|between|compare|comparison|trend|over time|each|by semester|previous semester|last semester|next semester)\b/i.test(question)
}

function assertRequestedSemesterRepresented(plan: unknown, question: string): void {
  if (!questionRequestsSemesterScope(question)) return
  if (!isRecord(plan)) throw new Error('Semester scope is missing')
  const comparison = /\b(?:across|between|compare|comparison|trend|over time|each|by semester)\b/i.test(question)
  if ('version' in plan && plan.version === 1) {
    const paths = Array.isArray(plan.groupBy) ? plan.groupBy : []
    const filters = JSON.stringify(plan.where ?? {})
    const hasYearOrSeason = paths.some((path) => typeof path === 'string' && /(?:^|\.)year$|(?:^|\.)season$/i.test(path)) || /"field":"(?:[^"\\]*\.)?(?:year|season)"/.test(filters)
    const hasComparisonGrouping = paths.some((path) => typeof path === 'string' && /(?:^|\.)(?:year|season)$/i.test(path))
    if (!hasYearOrSeason || (comparison && !hasComparisonGrouping)) throw new Error('Requested semester scope is not represented')
    return
  }
  if ('source' in plan) {
    const filters = Array.isArray(plan.filters) ? plan.filters : []
    const hasDate = filters.some((filter) => isRecord(filter) && /(?:^|\.)(?:year|season)$/.test(String(filter.field)))
    const dimensions = Array.isArray(plan.dimensions) ? plan.dimensions : []
    const grouped = dimensions.some((path) => typeof path === 'string' && /(?:^|\.)(?:year|season)$/.test(path))
    if (!hasDate || (comparison && !grouped)) throw new Error('Requested semester scope is not represented')
    return
  }
  const filters = isRecord(plan.filters) ? plan.filters : {}
  if (typeof filters.semester !== 'string' || comparison) throw new Error('Requested semester scope is not represented')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const catalogDescription = Object.values(aiSchemaCatalog).map((model) => ({
  model: model.name,
  fields: Object.values(model.fields).map((field) => ({ name: field.name, type: field.type, ...(field.enumValues ? { enumValues: field.enumValues } : {}) })),
  relationships: Object.values(model.relations).map((relation) => ({ name: relation.name, target: relation.target, cardinality: relation.cardinality })),
}))

export const plannerInstructions = `You are the ESA AI database query planner. Return exactly one JSON object. You generate structured plans only; never return database results, SQL, code, Prisma arguments, markdown, or prose.

Preferred plan: v1 structured query for supported non-sensitive academic questions:
{"version":1,"model":"Project|Partner|Team|Semester","select":["approved.path"],"where":{"field":"approved.path","operator":"eq|ne|in|notIn|contains|startsWith|endsWith|gt|gte|lt|lte","value":"typed value"},"groupBy":["approved.path"],"aggregates":[{"function":"count|countDistinct|sum|avg|min|max","field":"approved.path","alias":"metric","scope":"group|overall"}],"calculations":[{"function":"percentage","numerator":"metricAlias","denominator":"metricAlias","alias":"percent"}],"orderBy":[{"field":"approved.path or metric alias","direction":"asc|desc"}],"limit":50,"chartType":"bar|line|area|pie|doughnut|polarArea|radar|scatter|bubble|horizontalBar|stackedBar|sankey|table"}

Only use this exact allowlisted Prisma catalog (relationship names are case-sensitive): ${JSON.stringify(catalogDescription)}
Use one or more structured filters. Put conditions for one related record inside the same relation quantifier so they stay correlated. count counts root records; countDistinct counts unique field values. Sum/average require numeric fields. Percentages require two explicit metrics with matching function and field, and explicit group/overall scope. Do not invent fields or relationships. V1 is strictly limited to the four models in its catalog and must never access student, enrollment, membership, choice, contact, or authentication records. Generalized student analytics are disabled.

For a requested Sankey diagram, use v1 only for approved non-student data, with exactly two categorical groupBy fields and exactly one numeric aggregate. The first dimension is the source and the second is the target; the aggregate is the flow weight. Do not request a Sankey for student/enrollment data, and never invent flow values.

For supported project questions, prefer v1 instead of returning unsupported. For example, projects by type as a chart:
{"version":1,"model":"Project","groupBy":["type"],"aggregates":[{"function":"count","alias":"projects"}],"chartType":"bar"}
Project detail selections use v1 fields such as select ["name","description","type","status","Partner.name"]. Use exact case-sensitive relationship names from the catalog. Omit chartType when no chart is requested; the dashboard can choose a suitable default for one categorical dimension and one numeric metric. Set chartType to the requested style when the user names one. Use table only when a table is explicitly requested.

Compatibility plans (use only when necessary):
- Project search/count: {"entity":"projects","operation":"search|count","filters":{"keyword":"optional partial text","type":"SOFTWARE|HARDWARE|BOTH","status":"NEW|RETURNING|COMPLETE|WITHDRAWN|HOLD","semester":"SP26"},"groupBy":"none"}. Use this when the user requests partial keyword search.
- Protected enrollment aggregate (the only permitted student-related exception): {"entity":"enrollments","operation":"count","filters":{"semester":"SP26","major":"optional major","year":"FRESHMAN|SOPHOMORE|JUNIOR|SENIOR"},"groupBy":"none|major|year","chartType":"optional chart type"}. This path returns privacy-protected aggregate counts only; it never returns student/enrollment records. Use at most one demographic filter, and use no demographic filters when grouping by major or year. Groups below the privacy threshold are suppressed. For example, a requested majors pie chart for Spring 2026 is:
{"entity":"enrollments","operation":"count","filters":{"semester":"SP26"},"groupBy":"major","chartType":"pie"}
- Existing legacy analytics: {"source":"projects|partners|teams|semesters","filters":[{"field":"approved legacy path","operator":"eq|in","value":"typed value"}],"dimensions":["approved legacy path"],"metrics":[{"function":"count|countDistinct","field":"only for countDistinct","alias":"count"}],"chartType":"optional chart type"}. Use only if the question cannot be represented accurately with v1.
Otherwise prefer v1. If the request is ambiguous, return {"operation":"clarification_needed","question":"short question"}. If unsupported or sensitive, return {"operation":"unsupported"}.
Do not omit requested fields, filters, semesters, grouping, sorting, or calculations. If the user explicitly requests a semester or comparison across semesters, represent that scope in the plan. The dashboard semester is context only and will be applied by the server only when the question does not specify a semester or comparison.`
