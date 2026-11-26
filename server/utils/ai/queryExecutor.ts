/**
 * Purpose
 * Provide the query executor logic used by other parts of ESA.
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
import { prisma } from '../prisma'
import {
  validateQueryPlan,
  type AIModelName,
  type StructuredAggregate,
  type StructuredFilter,
  type StructuredOrder,
  type StructuredQueryPlan,
  type AnalyticsQuery,
} from './queryPlan'
import {
  aiSchemaCatalog,
  resolveAIFieldPath,
  resolveAIRelation,
  type AIScalarField,
} from './schemaCatalog'
import { protectAggregateCount, protectAggregateResults } from './harness'
import { enforceStructuredQueryPrivacy } from './privacyPolicy'

type Row = Record<string, unknown>
type Scalar = string | number | boolean

// Define seasonCodes for the steps below.
const seasonCodes = { SP: 'SPRING', SU: 'SUMMER', FA: 'FALL' } as const

// Define the helper that will execute query plan.
export async function executeQueryPlan(rawPlan: unknown) {
  // Use validateQueryPlan to initialize plan.
  const plan = validateQueryPlan(rawPlan)

  // Check whether 'source' in plan before running this branch.
  if ('source' in plan) {
    // Check whether ['enrollments', 'memberships', 'choices'].includes(plan.source) before running this branch.
    if (['enrollments', 'memberships', 'choices'].includes(plan.source)) {
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('Student analytics are not available through this query path')
    }
    // Define records for the steps below.
    const records = await fetchAnalyticsRecords(plan.source)
    // Pass executeAnalytics(plan, records) back to the caller.
    return executeAnalytics(plan, records)
  }

  // Check whether plan.entity === 'projects' before running this branch.
  if (plan.entity === 'projects') {
    // Define semesterId for the steps below.
    let semesterId: string | undefined
    // Check whether plan.filters.semester before running this branch.
    if (plan.filters.semester) {
      // Define code for the steps below.
      const code = plan.filters.semester
      // Define prefix for the steps below.
      const prefix = code.slice(0, 2) as keyof typeof seasonCodes
      // Define semester for the steps below.
      const semester = await prisma.semester.findUnique({
        where: { year_season: { year: 2000 + Number(code.slice(2)), season: seasonCodes[prefix] } },
        select: { id: true },
      })
      // Check whether !semester before running this branch.
      if (!semester) return { results: [], count: 0 }
      // Update semesterId with the value on the right.
      semesterId = semester.id
    }
    // Define where for the steps below.
    const where = {
      ...(plan.filters.keyword
        ? {
            OR: [
              { name: { contains: plan.filters.keyword } },
              { description: { contains: plan.filters.keyword } },
            ],
          }
        : {}),
      ...(plan.filters.type ? { type: plan.filters.type } : {}),
      ...(plan.filters.status ? { status: plan.filters.status } : {}),
      ...(semesterId ? { Teams: { some: { semesterId } } } : {}),
    }
    // Check whether plan.operation === 'count' before running this branch.
    if (plan.operation === 'count')
      // Pass { count: await prisma.project.count({ where }), results: [] } back to the caller.
      return { count: await prisma.project.count({ where }), results: [] }
    // Define projects for the steps below.
    const projects = await prisma.project.findMany({
      where,
      select: { id: true, name: true, description: true, type: true, status: true },
      orderBy: { name: 'asc' },
    })
    // Pass { results: projects, count: projects.length } back to the caller.
    return { results: projects, count: projects.length }
  }

  // Define code for the steps below.
  const code = plan.filters.semester
  // Define prefix for the steps below.
  const prefix = code.slice(0, 2) as keyof typeof seasonCodes
  // Define season for the steps below.
  const season = seasonCodes[prefix]
  // Define semester for the steps below.
  const semester = await prisma.semester.findUnique({
    where: { year_season: { year: 2000 + Number(code.slice(2)), season } },
    select: { id: true },
  })
  // Check whether !semester before running this branch.
  if (!semester) return { semester: code, results: [], count: 0 }

  // Define where for the steps below.
  const where = {
    semesterId: semester.id,
    ...(plan.filters.major ? { major: plan.filters.major } : {}),
    ...(plan.filters.year ? { year: plan.filters.year } : {}),
  }
  // Check whether plan.groupBy === 'year' before running this branch.
  if (plan.groupBy === 'year') {
    // Define groups for the steps below.
    const groups = await prisma.enrollment.groupBy({
      by: ['year'],
      where,
      _count: { _all: true },
      orderBy: { year: 'asc' },
    })
    // Pass { semester: code, results: protectAggregateResults( groups.map((group) => ({ year: group.year, count back to the caller.
    return {
      semester: code,
      results: protectAggregateResults(
        groups.map((group) => ({ year: group.year, count: group._count._all }))
      ),
    }
  }
  // Check whether plan.groupBy === 'major' before running this branch.
  if (plan.groupBy === 'major') {
    // Define groups for the steps below.
    const groups = await prisma.enrollment.groupBy({
      by: ['major'],
      where,
      _count: { _all: true },
      orderBy: { major: 'asc' },
    })
    // Pass { semester: code, results: protectAggregateResults( groups.map((group) => ({ major: group.major, cou back to the caller.
    return {
      semester: code,
      results: protectAggregateResults(
        groups.map((group) => ({ major: group.major, count: group._count._all }))
      ),
    }
  }
  // Pass { semester: code, count: protectAggregateCount(await prisma.enrollment.count({ where })) } back to the caller.
  return { semester: code, count: protectAggregateCount(await prisma.enrollment.count({ where })) }
}

// Define the helper that will fetch analytics records.
async function fetchAnalyticsRecords(source: AnalyticsQuery['source']): Promise<Row[]> {
  // These fixed selects form the data-access boundary. Plans can choose only paths
  // validated against queryPlan.ts; they cannot change the Prisma selection.
  switch (source) {
    case 'projects':
      // Pass prisma.project.findMany({ select: { id: true, name: true, type: true, status: true, Partner: { selec back to the caller.
      return prisma.project.findMany({
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          Partner: { select: { name: true } },
          Teams: {
            select: { meetingDay: true, Semester: { select: { year: true, season: true } } },
          },
        },
      }) as unknown as Promise<Row[]>
    case 'partners':
      // Pass prisma.partner.findMany({ select: { id: true, name: true, Projects: { select: { type: true, status:  back to the caller.
      return prisma.partner.findMany({
        select: {
          id: true,
          name: true,
          Projects: {
            select: {
              type: true,
              status: true,
              Teams: {
                select: { meetingDay: true, Semester: { select: { year: true, season: true } } },
              },
            },
          },
        },
      }) as unknown as Promise<Row[]>
    case 'teams':
      // Pass prisma.team.findMany({ select: { id: true, meetingDay: true, Semester: { select: { year: true, seaso back to the caller.
      return prisma.team.findMany({
        select: {
          id: true,
          meetingDay: true,
          Semester: { select: { year: true, season: true } },
          Project: { select: { type: true, status: true, Partner: { select: { name: true } } } },
        },
      }) as unknown as Promise<Row[]>
    case 'semesters':
      // Pass prisma.semester.findMany({ select: { id: true, year: true, season: true, Teams: { select: { meetingD back to the caller.
      return prisma.semester.findMany({
        select: {
          id: true,
          year: true,
          season: true,
          Teams: {
            select: {
              meetingDay: true,
              Project: {
                select: { type: true, status: true, Partner: { select: { name: true } } },
              },
            },
          },
        },
      }) as unknown as Promise<Row[]>
    default:
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('Unsupported analytical source')
  }
}

// Define the helper that will execute analytics.
function executeAnalytics(plan: AnalyticsQuery, records: Row[]) {
  // Use records.filter to initialize filtered.
  const filtered = records.filter((record) => matchesFilters(record, plan.filters))

  // Check whether plan.dimensions.length === 0 before running this branch.
  if (plan.dimensions.length === 0) {
    // Use plan.metrics.map to initialize values.
    const values = plan.metrics.map((metric) => [
      metric.alias,
      metricValue(filtered, metric.function, metric.field),
    ])
    // Use Object.fromEntries to initialize result.
    const result = Object.fromEntries(values)
    // Define primaryMetric for the steps below.
    const primaryMetric =
      plan.metrics.find((metric) => metric.function === 'count') ?? plan.metrics[0]
    // Pass { ...result, count: result[primaryMetric!.alias] as number, results: [] } back to the caller.
    return { ...result, count: result[primaryMetric!.alias] as number, results: [] }
  }

  // Define groups for the steps below.
  const groups = new Map<
    string,
    { dimensions: Record<string, Scalar>; records: Map<string, Row[]> }
  >()
  // Repeat the following steps for each item in filtered.
  for (const record of filtered) {
    // Use String to initialize id.
    const id = String(record.id)
    // Repeat the following steps for each item in correlatedDimensionTuples(record, plan.dimensions).
    for (const combination of correlatedDimensionTuples(record, plan.dimensions)) {
      // Use Object.fromEntries to initialize dimensions.
      const dimensions = Object.fromEntries(
        plan.dimensions.map((field, index) => [field, combination[index] as Scalar])
      )
      // Use JSON.stringify to initialize key.
      const key = JSON.stringify(dimensions)
      // Define group for the steps below.
      const group = groups.get(key) ?? { dimensions, records: new Map<string, Row[]>() }
      // Call group.records.set to run this step.
      group.records.set(id, [...(group.records.get(id) ?? []), record])
      // Call groups.set to run this step.
      groups.set(key, group)
    }
  }

  // Use [...groups.values()].map to initialize results.
  const results = [...groups.values()].map((group) => {
    // Use [...group.records.values()].map((rows) => rows[0]!).filter to initialize members.
    const members = [...group.records.values()].map((rows) => rows[0]!).filter(Boolean)
    // Use Object.fromEntries to initialize metrics.
    const metrics = Object.fromEntries(
      plan.metrics.map((metric) => [
        metric.alias,
        metricValue(members, metric.function, metric.field),
      ])
    )
    // Define primaryMetric for the steps below.
    const primaryMetric =
      plan.metrics.find((metric) => metric.function === 'count') ?? plan.metrics[0]
    // Define count for the steps below.
    const count = metrics[primaryMetric!.alias] as number
    // Pass { ...group.dimensions, ...metrics, count } back to the caller.
    return { ...group.dimensions, ...metrics, count }
  })
  // Call results.sort to run this step.
  results.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
  // Pass { results } back to the caller.
  return { results }
}

// Define the helper that will matches filters.
function matchesFilters(record: Row, filters: AnalyticsQuery['filters']): boolean {
  type PathFilter = AnalyticsQuery['filters'][number] & { path: string[] }
  // Use filters.map to initialize withPaths.
  const withPaths: PathFilter[] = filters.map((filter) => ({
    ...filter,
    path: filter.field.split('.'),
  }))

  // Define the helper that will matches.
  function matches(value: unknown, pending: PathFilter[]): boolean {
    // Check whether pending.length === 0 before running this branch.
    if (pending.length === 0) return true
    // Check whether typeof value !== 'object' || value === null || Array.isArray(value) before running this branch.
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false

    // Define row for the steps below.
    const row = value as Record<string, unknown>
    // Define grouped for the steps below.
    const grouped = new Map<string, PathFilter[]>()
    // Repeat the following steps for each item in pending.
    for (const filter of pending) {
      // Define segment for the steps below.
      const segment = filter.path[0]
      // Check whether !segment before running this branch.
      if (!segment) return false
      // Define group for the steps below.
      const group = grouped.get(segment) ?? []
      // Call group.push to run this step.
      group.push(filter)
      // Call grouped.set to run this step.
      grouped.set(segment, group)
    }

    // Repeat the following steps for each item in grouped.
    for (const [segment, group] of grouped) {
      // Use Object.keys(row).find to initialize actualKey.
      const actualKey = Object.keys(row).find((key) => key.toLowerCase() === segment.toLowerCase())
      // Check whether !actualKey before running this branch.
      if (!actualKey) return false
      // Define child for the steps below.
      const child = row[actualKey]
      // Use group.map to initialize nested.
      const nested = group.map((filter) => ({ ...filter, path: filter.path.slice(1) }))

      // Check whether Array.isArray(child) before running this branch.
      if (Array.isArray(child)) {
        // Check whether !child.some((item) => matches(item, nested)) before running this branch.
        if (!child.some((item) => matches(item, nested))) return false
      } else if (typeof child === 'object' && child !== null) {
        // Check whether !matches(child, nested) before running this branch.
        if (!matches(child, nested)) return false
      } else {
        // Check whether nested.some((filter) => filter.path.length !== 0 || !matchesFilterValue(child, filter)) before running this branch.
        if (nested.some((filter) => filter.path.length !== 0 || !matchesFilterValue(child, filter)))
          // Pass false back to the caller.
          return false
      }
    }
    // Pass true back to the caller.
    return true
  }

  // Pass matches(record, withPaths) back to the caller.
  return matches(record, withPaths)
}

// Define the helper that will matches filter value.
function matchesFilterValue(actual: unknown, filter: AnalyticsQuery['filters'][number]): boolean {
  // Define expected for the steps below.
  const expected = Array.isArray(filter.value) ? filter.value : [filter.value]
  // Pass expected.some((value) => value === actual) back to the caller.
  return expected.some((value) => value === actual)
}

// Define the helper that will correlated dimension tuples.
function correlatedDimensionTuples(record: Row, fields: string[]): Scalar[][] {
  type ValueWithContext = { value: Scalar; context: Record<string, number> }

  // Define the helper that will dimension values.
  function dimensionValues(
    value: unknown,
    path: string[],
    context: Record<string, number> = {},
    relationPath: string[] = []
  ): ValueWithContext[] {
    // Check whether Array.isArray(value) before running this branch.
    if (Array.isArray(value)) {
      // Pass value.flatMap((item, index) => dimensionValues(item, path, { ...context, [relationPath.join('.')]: i back to the caller.
      return value.flatMap((item, index) =>
        dimensionValues(item, path, { ...context, [relationPath.join('.')]: index }, relationPath)
      )
    }
    // Check whether typeof value !== 'object' || value === null before running this branch.
    if (typeof value !== 'object' || value === null) return []
    // Define row for the steps below.
    const row = value as Record<string, unknown>
    // Define [segment, ...tail] for the steps below.
    const [segment, ...tail] = path
    // Check whether !segment before running this branch.
    if (!segment) return []
    // Use Object.keys(row).find to initialize key.
    const key = Object.keys(row).find(
      (candidate) => candidate.toLowerCase() === segment.toLowerCase()
    )
    // Check whether !key before running this branch.
    if (!key) return []
    // Define next for the steps below.
    const next = row[key]
    // Define nextRelationPath for the steps below.
    const nextRelationPath = [...relationPath, segment.toLowerCase()]
    // Check whether tail.length === 0 before running this branch.
    if (tail.length === 0) {
      // Check whether typeof next === 'string' || typeof next === 'number' || typeof next === 'boolean' before running this branch.
      if (typeof next === 'string' || typeof next === 'number' || typeof next === 'boolean')
        // Pass [{ value: next, context }] back to the caller.
        return [{ value: next, context }]
      // Pass Array.isArray(next) ? dimensionValues(next, tail, context, nextRelationPath) : [] back to the caller.
      return Array.isArray(next) ? dimensionValues(next, tail, context, nextRelationPath) : []
    }
    // Pass dimensionValues(next, tail, context, nextRelationPath) back to the caller.
    return dimensionValues(next, tail, context, nextRelationPath)
  }

  // Use fields.map to initialize options.
  const options = fields.map((field) => dimensionValues(record, field.split('.')))
  // Check whether options.some((values) => values.length === 0) before running this branch.
  if (options.some((values) => values.length === 0)) return []

  // Define the helper that will combine.
  function combine(index: number, picked: ValueWithContext[]): Scalar[][] {
    // Check whether index === options.length before running this branch.
    if (index === options.length) return [picked.map((item) => item.value)]
    // Define tuples for the steps below.
    const tuples: Scalar[][] = []
    // Repeat the following steps for each item in options[index] ?? [].
    for (const candidate of options[index] ?? []) {
      // Use picked.every to initialize compatible.
      const compatible = picked.every((item) =>
        Object.entries(item.context).every(
          ([relation, relationIndex]) =>
            candidate.context[relation] === undefined ||
            candidate.context[relation] === relationIndex
        )
      )
      // Check whether compatible before running this branch.
      if (compatible) tuples.push(...combine(index + 1, [...picked, candidate]))
    }
    // Pass tuples back to the caller.
    return tuples
  }

  // Pass combine(0, []) back to the caller.
  return combine(0, [])
}

// Define the helper that will metric value.
function metricValue(records: Row[], fn: 'count' | 'countDistinct', field?: string): number {
  // Check whether fn === 'count' before running this branch.
  if (fn === 'count') return records.length
  // Check whether !field before running this branch.
  if (!field) throw new Error('countDistinct requires a field')
  // Use records.flatMap to initialize values.
  const values = records.flatMap((record) => valuesAtPath(record, field))
  // Pass new Set(values.map((value) => JSON.stringify(value))).size back to the caller.
  return new Set(values.map((value) => JSON.stringify(value))).size
}

// Define the helper that will values at path.
function valuesAtPath(value: unknown, path: string): Scalar[] {
  // Use path.split to initialize [head, ...tail].
  const [head, ...tail] = path.split('.')
  // Check whether Array.isArray(value) before running this branch.
  if (Array.isArray(value)) return value.flatMap((item) => valuesAtPath(item, path))
  // Check whether typeof value !== 'object' || value === null || !head before running this branch.
  if (typeof value !== 'object' || value === null || !head) return []
  // Define next for the steps below.
  const next = (value as Record<string, unknown>)[head]
  // Check whether tail.length before running this branch.
  if (tail.length) return valuesAtPath(next, tail.join('.'))
  // Pass typeof next === 'string' || typeof next === 'number' || typeof next === 'boolean' ? [next] : [] back to the caller.
  return typeof next === 'string' || typeof next === 'number' || typeof next === 'boolean'
    ? [next]
    : []
}

// Define MAX_SCAN_ROOT_ROWS for the steps below.
const MAX_SCAN_ROOT_ROWS = 5_000
// Define MAX_RELATED_ROWS for the steps below.
const MAX_RELATED_ROWS = 100
// Define MAX_GROUPS for the steps below.
const MAX_GROUPS = 500
// Define MAX_RESULT_ROWS for the steps below.
const MAX_RESULT_ROWS = 100

type StructuredQueryColumn = {
  key: string
  label: string
  type: string
  role: 'field' | 'dimension' | 'metric' | 'calculation'
}

export type StructuredQueryResult = {
  version: 1
  model: AIModelName
  kind: 'records' | 'aggregate'
  columns: StructuredQueryColumn[]
  rows: Array<{ key: string; values: Record<string, unknown> }>
  scannedRootRows: number
  complete: boolean
  hasMore: boolean
  limit: number
  empty: boolean
}

export type StructuredQueryErrorCode =
  | 'RESULT_LIMIT_EXCEEDED'
  | 'RELATED_ROW_LIMIT_EXCEEDED'
  | 'GROUP_LIMIT_EXCEEDED'
  | 'UNSUPPORTED_SORT'
  | 'INVALID_AGGREGATE'
  | 'INVALID_QUERY_RESULT'

export class StructuredQueryExecutionError extends Error {
  constructor(
    readonly code: StructuredQueryErrorCode,
    message: string
  ) {
    // Call super to run this step.
    super(message)
    // Update this.name with the value on the right.
    this.name = 'StructuredQueryExecutionError'
  }
}

type ReadDelegate = { findMany(args: Record<string, unknown>): Promise<unknown[]> }
type ReadClient = Record<string, ReadDelegate>
type SelectTree = { fields: Set<string>; relations: Map<string, SelectTree> }
type ValueContext = Record<string, number>
type PathValue = { value: Scalar; context: ValueContext }
type RootEntry = { id: string; record: Row; contexts: ValueContext[] }
type GroupEntry = { dimensions: Record<string, Scalar>; members: Map<string, ValueContext[]> }

// Define delegateNames for the steps below.
const delegateNames: Record<AIModelName, string> = {
  Project: 'project',
  Partner: 'partner',
  Team: 'team',
  Semester: 'semester',
}

/**
 * Phase 2 executor for the validated v1 query IR. The live API continues to use
 * executeQueryPlan until authorization and privacy policy are approved in Phase 3.
 */
export async function executeStructuredQueryPlan(
  input: unknown,
  client: unknown = prisma
): Promise<StructuredQueryResult> {
  // Use enforceStructuredQueryPrivacy to initialize plan.
  const plan = enforceStructuredQueryPrivacy(input)
  // Define recordQuery for the steps below.
  const recordQuery = plan.select !== undefined
  // Define resultLimit for the steps below.
  const resultLimit = plan.limit ?? MAX_RESULT_ROWS
  // Use buildSelectionTree to initialize selection.
  const selection = buildSelectionTree(plan)
  // Use compileSelection to initialize select.
  const select = compileSelection(plan.model, selection)
  // Define where for the steps below.
  const where = plan.where ? compilePrismaFilter(plan.model, plan.where) : undefined
  // Define orderBy for the steps below.
  const orderBy = recordQuery ? compileRecordOrder(plan.model, plan.orderBy ?? []) : undefined
  // Check whether !recordQuery before running this branch.
  if (!recordQuery) validateAggregateOrder(plan)

  // Define delegate for the steps below.
  const delegate = (client as ReadClient)[delegateNames[plan.model]]
  // Check whether !delegate || typeof delegate.findMany !== 'function' before running this branch.
  if (!delegate || typeof delegate.findMany !== 'function') {
    // Stop this operation and tell the caller why it cannot continue.
    throw new StructuredQueryExecutionError('INVALID_QUERY_RESULT', 'Approved Prisma delegate is unavailable')
  }

  // Define fetchLimit for the steps below.
  const fetchLimit = recordQuery ? resultLimit + 1 : MAX_SCAN_ROOT_ROWS + 1
  // Define rawRows for the steps below.
  const rawRows = await delegate.findMany({
    select,
    ...(where ? { where } : {}),
    ...(orderBy?.length ? { orderBy } : {}),
    take: fetchLimit,
  })
  // Check whether !Array.isArray(rawRows) before running this branch.
  if (!Array.isArray(rawRows)) {
    // Stop this operation and tell the caller why it cannot continue.
    throw new StructuredQueryExecutionError('INVALID_QUERY_RESULT', 'Prisma returned a non-list result')
  }
  // Check whether !recordQuery && rawRows.length > MAX_SCAN_ROOT_ROWS before running this branch.
  if (!recordQuery && rawRows.length > MAX_SCAN_ROOT_ROWS) {
    // Stop this operation and tell the caller why it cannot continue.
    throw new StructuredQueryExecutionError(
      'RESULT_LIMIT_EXCEEDED',
      `Query scans more than ${MAX_SCAN_ROOT_ROWS} root records; add a selective filter`
    )
  }

  // Define dataRows for the steps below.
  const dataRows = rawRows as Row[]
  // Repeat the following steps for each item in dataRows.
  for (const row of dataRows) assertRelatedRowsWithinBounds(row, plan.model, selection)
  // Define contextsByRoot for the steps below.
  const contextsByRoot = new Map<string, ValueContext[]>()
  // Repeat the following steps for each item in dataRows.
  for (const row of dataRows) {
    // Use String to initialize id.
    const id = String(row.id)
    // Define contexts for the steps below.
    const contexts = plan.where
      ? evaluateFilter(row, plan.model, plan.where, plan.model, {})
      : [{}]
    // Check whether !contexts.length before running this branch.
    if (!contexts.length) {
      // Stop this operation and tell the caller why it cannot continue.
      throw new StructuredQueryExecutionError(
        'INVALID_QUERY_RESULT',
        'Prisma filter results could not be reconciled with correlated relation scopes'
      )
    }
    // Call contextsByRoot.set to run this step.
    contextsByRoot.set(id, uniqueContexts(contexts))
  }
  // Define hasMore for the steps below.
  const hasMore = recordQuery && dataRows.length > resultLimit
  // Define boundedRows for the steps below.
  const boundedRows = recordQuery ? dataRows.slice(0, resultLimit) : dataRows
  // Use buildStructuredColumns to initialize columns.
  const columns = buildStructuredColumns(plan)

  // Check whether recordQuery before running this branch.
  if (recordQuery) {
    // Use boundedRows.map to initialize rows.
    const rows = boundedRows.map((record) => ({
      key: String(record.id),
      values: Object.fromEntries(
        (plan.select ?? []).map((path) => [
          path,
          selectedPathValue(record, plan.model, path, contextsByRoot.get(String(record.id)) ?? [{}]),
        ])
      ),
    }))
    // Pass { version: 1, model: plan.model, kind: 'records', columns, rows, scannedRootRows: boundedRows.length back to the caller.
    return {
      version: 1,
      model: plan.model,
      kind: 'records',
      columns,
      rows,
      scannedRootRows: boundedRows.length,
      complete: !hasMore,
      hasMore,
      limit: resultLimit,
      empty: rows.length === 0,
    }
  }

  // Use dataRows.map to initialize entries.
  const entries = dataRows.map((record) => {
    // Use String to initialize id.
    const id = String(record.id)
    // Pass { id, record, contexts: contextsByRoot.get(id) ?? [{}] } back to the caller.
    return { id, record, contexts: contextsByRoot.get(id) ?? [{}] }
  })
  // Use entries.filter to initialize matchingEntries.
  const matchingEntries = entries.filter((entry) => entry.contexts.length > 0)
  // Use buildGroups to initialize groups.
  const groups = buildGroups(plan, matchingEntries)
  // Check whether groups.size > MAX_GROUPS before running this branch.
  if (groups.size > MAX_GROUPS) {
    // Stop this operation and tell the caller why it cannot continue.
    throw new StructuredQueryExecutionError(
      'GROUP_LIMIT_EXCEEDED',
      `Query produces more than ${MAX_GROUPS} groups; add filters or reduce grouping fields`
    )
  }

  // Use [...groups.entries()].map to initialize aggregateRows.
  const aggregateRows = [...groups.entries()].map(([key, group]) => ({
    key,
    values: buildAggregateValues(plan, group, matchingEntries),
  }))
  // Call sortAggregateRows to run this step.
  sortAggregateRows(aggregateRows, plan.orderBy ?? [])
  // Define hasMoreGroups for the steps below.
  const hasMoreGroups = aggregateRows.length > resultLimit
  // Use aggregateRows.slice to initialize outputRows.
  const outputRows = aggregateRows.slice(0, resultLimit)
  // Pass { version: 1, model: plan.model, kind: 'aggregate', columns, rows: outputRows, scannedRootRows: matc back to the caller.
  return {
    version: 1,
    model: plan.model,
    kind: 'aggregate',
    columns,
    rows: outputRows,
    scannedRootRows: matchingEntries.length,
    complete: !hasMoreGroups,
    hasMore: hasMoreGroups,
    limit: resultLimit,
    empty: matchingEntries.length === 0,
  }
}

// Define the helper that will build selection tree.
function buildSelectionTree(plan: StructuredQueryPlan): SelectTree {
  // Define root for the steps below.
  const root: SelectTree = { fields: new Set(['id']), relations: new Map() }
  // Define paths for the steps below.
  const paths = new Set<string>([
    ...(plan.select ?? []),
    ...(plan.groupBy ?? []),
    ...(plan.aggregates ?? []).flatMap((metric) => [
      ...(metric.field ? [metric.field] : []),
      ...structuredFilterPaths(metric.where, plan.model),
    ]),
    ...structuredFilterPaths(plan.where, plan.model),
  ])
  // Repeat the following steps for each item in paths.
  for (const path of paths) addSelectionPath(root, plan.model, path)
  // Pass root back to the caller.
  return root
}

// Define the helper that will add selection path.
function addSelectionPath(tree: SelectTree, model: AIModelName, path: string): void {
  // Use path.split to initialize segments.
  const segments = path.split('.')
  // Define currentTree for the steps below.
  let currentTree = tree
  // Define currentModel for the steps below.
  let currentModel = model
  // Repeat the following steps for each item in segments.entries().
  for (const [index, segment] of segments.entries()) {
    // Define field for the steps below.
    const field = aiSchemaCatalog[currentModel].fields[segment]
    // Check whether field before running this branch.
    if (field) {
      // Check whether index !== segments.length - 1 before running this branch.
      if (index !== segments.length - 1) {
        // Stop this operation and tell the caller why it cannot continue.
        throw new StructuredQueryExecutionError('INVALID_QUERY_RESULT', `Invalid field path: ${path}`)
      }
      // Call currentTree.fields.add to run this step.
      currentTree.fields.add(segment)
      return
    }
    // Use resolveAIRelation to initialize relation.
    const relation = resolveAIRelation(currentModel, segment)
    // Check whether !relation || index === segments.length - 1 before running this branch.
    if (!relation || index === segments.length - 1) {
      // Stop this operation and tell the caller why it cannot continue.
      throw new StructuredQueryExecutionError('INVALID_QUERY_RESULT', `Invalid relationship path: ${path}`)
    }
    // Use currentTree.relations.get to initialize child.
    let child = currentTree.relations.get(segment)
    // Check whether !child before running this branch.
    if (!child) {
      // Update child with the value on the right.
      child = { fields: new Set(['id']), relations: new Map() }
      // Call currentTree.relations.set to run this step.
      currentTree.relations.set(segment, child)
    }
    // Update currentTree with the value on the right.
    currentTree = child
    // Update currentModel with the value on the right.
    currentModel = relation.target
  }
}

// Define the helper that will structured filter paths.
function structuredFilterPaths(filter: StructuredFilter | undefined, model: AIModelName): string[] {
  // Check whether !filter before running this branch.
  if (!filter) return []
  // Check whether 'field' in filter before running this branch.
  if ('field' in filter) return [filter.field]
  // Check whether 'and' in filter || 'or' in filter before running this branch.
  if ('and' in filter || 'or' in filter) {
    // Define clauses for the steps below.
    const clauses = 'and' in filter ? filter.and : filter.or
    // Pass clauses.flatMap((clause) => structuredFilterPaths(clause, model)) back to the caller.
    return clauses.flatMap((clause) => structuredFilterPaths(clause, model))
  }
  // Check whether 'not' in filter before running this branch.
  if ('not' in filter) return structuredFilterPaths(filter.not, model)
  // Check whether 'relation' in filter before running this branch.
  if ('relation' in filter) {
    // Use resolveAIRelation to initialize relation.
    const relation = resolveAIRelation(model, filter.relation)
    // Pass relation ? structuredFilterPaths(filter.where, relation.target).map((path) => `${filter.relation}.${ back to the caller.
    return relation
      ? structuredFilterPaths(filter.where, relation.target).map((path) => `${filter.relation}.${path}`)
      : []
  }
  // Pass [] back to the caller.
  return []
}

// Define the helper that will compile selection.
function compileSelection(model: AIModelName, tree: SelectTree): Record<string, unknown> {
  // Use Object.fromEntries to initialize selection.
  const selection: Record<string, unknown> = Object.fromEntries([...tree.fields].map((field) => [field, true]))
  // Repeat the following steps for each item in tree.relations.
  for (const [name, child] of tree.relations) {
    // Use resolveAIRelation to initialize relation.
    const relation = resolveAIRelation(model, name)
    // Check whether !relation before running this branch.
    if (!relation) throw new StructuredQueryExecutionError('INVALID_QUERY_RESULT', `Unapproved relation: ${name}`)
    // Update selection[name] with the value on the right.
    selection[name] = {
      select: compileSelection(relation.target, child),
      ...(relation.cardinality === 'many' ? { take: MAX_RELATED_ROWS + 1 } : {}),
    }
  }
  // Pass selection back to the caller.
  return selection
}

// Define the helper that will compile prisma filter.
function compilePrismaFilter(model: AIModelName, filter: StructuredFilter): Record<string, unknown> {
  // Check whether 'and' in filter before running this branch.
  if ('and' in filter) return { AND: filter.and.map((child) => compilePrismaFilter(model, child)) }
  // Check whether 'or' in filter before running this branch.
  if ('or' in filter) return { OR: filter.or.map((child) => compilePrismaFilter(model, child)) }
  // Check whether 'not' in filter before running this branch.
  if ('not' in filter) return { NOT: compilePrismaFilter(model, filter.not) }
  // Check whether 'relation' in filter before running this branch.
  if ('relation' in filter) {
    // Use resolveAIRelation to initialize relation.
    const relation = resolveAIRelation(model, filter.relation)
    // Check whether !relation before running this branch.
    if (!relation) throw new StructuredQueryExecutionError('INVALID_QUERY_RESULT', `Unapproved relation: ${filter.relation}`)
    // Pass { [relation.name]: { [filter.quantifier]: compilePrismaFilter(relation.target, filter.where) } } back to the caller.
    return { [relation.name]: { [filter.quantifier]: compilePrismaFilter(relation.target, filter.where) } }
  }
  // Define prismaOperator for the steps below.
  const prismaOperator: Record<string, string> = {
    eq: 'equals',
    ne: 'not',
    in: 'in',
    notIn: 'notIn',
    contains: 'contains',
    startsWith: 'startsWith',
    endsWith: 'endsWith',
    gt: 'gt',
    gte: 'gte',
    lt: 'lt',
    lte: 'lte',
  }
  // Pass { [filter.field]: { [prismaOperator[filter.operator]!]: filter.value } } back to the caller.
  return { [filter.field]: { [prismaOperator[filter.operator]!]: filter.value } }
}

// Define the helper that will compile record order.
function compileRecordOrder(model: AIModelName, orders: StructuredOrder[]): Array<Record<string, unknown>> {
  // Pass orders.map((order) => { const path = order.field.split('.') let currentModel = model const parts: st back to the caller.
  return orders.map((order) => {
    // Use order.field.split to initialize path.
    const path = order.field.split('.')
    // Define currentModel for the steps below.
    let currentModel = model
    // Define parts for the steps below.
    const parts: string[] = []
    // Repeat the following steps for each item in path.entries().
    for (const [index, segment] of path.entries()) {
      // Define field for the steps below.
      const field = aiSchemaCatalog[currentModel].fields[segment]
      // Check whether field before running this branch.
      if (field) {
        // Check whether index !== path.length - 1 before running this branch.
        if (index !== path.length - 1) break
        // Call parts.push to run this step.
        parts.push(segment)
        // Pass nestedOrder(parts, order.direction) back to the caller.
        return nestedOrder(parts, order.direction)
      }
      // Use resolveAIRelation to initialize relation.
      const relation = resolveAIRelation(currentModel, segment)
      // Check whether !relation || relation.cardinality === 'many' before running this branch.
      if (!relation || relation.cardinality === 'many') {
        // Stop this operation and tell the caller why it cannot continue.
        throw new StructuredQueryExecutionError(
          'UNSUPPORTED_SORT',
          `Record sorting through a to-many relationship is unsupported: ${order.field}`
        )
      }
      // Call parts.push to run this step.
      parts.push(segment)
      // Update currentModel with the value on the right.
      currentModel = relation.target
    }
    // Stop this operation and tell the caller why it cannot continue.
    throw new StructuredQueryExecutionError('UNSUPPORTED_SORT', `Invalid record sort field: ${order.field}`)
  })
}

// Define the helper that will nested order.
function nestedOrder(path: string[], direction: 'asc' | 'desc'): Record<string, unknown> {
  // Pass path.reduceRight<Record<string, unknown>>((value, segment) => ({ [segment]: value }), direction) back to the caller.
  return path.reduceRight<Record<string, unknown>>((value, segment) => ({ [segment]: value }), direction)
}

// Define the helper that will validate aggregate order.
function validateAggregateOrder(plan: StructuredQueryPlan): void {
  // Define groupFields for the steps below.
  const groupFields = new Set(plan.groupBy ?? [])
  // Define aggregateAliases for the steps below.
  const aggregateAliases = new Set([
    ...(plan.aggregates ?? []).map((metric) => metric.alias),
    ...(plan.calculations ?? []).map((calculation) => calculation.alias),
  ])
  // Repeat the following steps for each item in plan.orderBy ?? [].
  for (const order of plan.orderBy ?? []) {
    // Check whether !groupFields.has(order.field) && !aggregateAliases.has(order.field) before running this branch.
    if (!groupFields.has(order.field) && !aggregateAliases.has(order.field)) {
      // Stop this operation and tell the caller why it cannot continue.
      throw new StructuredQueryExecutionError(
        'UNSUPPORTED_SORT',
        `Aggregate sorting requires a grouping field or metric alias: ${order.field}`
      )
    }
  }
}

// Define the helper that will assert related rows within bounds.
function assertRelatedRowsWithinBounds(row: Row, model: AIModelName, tree: SelectTree): void {
  // Repeat the following steps for each item in tree.relations.
  for (const [name, childTree] of tree.relations) {
    // Use resolveAIRelation to initialize relation.
    const relation = resolveAIRelation(model, name)
    // Define value for the steps below.
    const value = row[name]
    // Check whether !relation || value === null || value === undefined before running this branch.
    if (!relation || value === null || value === undefined) continue
    // Check whether relation.cardinality === 'many' before running this branch.
    if (relation.cardinality === 'many') {
      // Check whether !Array.isArray(value) before running this branch.
      if (!Array.isArray(value)) throw new StructuredQueryExecutionError('INVALID_QUERY_RESULT', `Expected list for ${model}.${name}`)
      // Check whether value.length > MAX_RELATED_ROWS before running this branch.
      if (value.length > MAX_RELATED_ROWS) {
        // Stop this operation and tell the caller why it cannot continue.
        throw new StructuredQueryExecutionError(
          'RELATED_ROW_LIMIT_EXCEEDED',
          `${model}.${name} exceeds the ${MAX_RELATED_ROWS} related-record execution limit`
        )
      }
      // Repeat the following steps for each item in value.
      for (const child of value) assertRelatedRowsWithinBounds(child as Row, relation.target, childTree)
    } else {
      // Call assertRelatedRowsWithinBounds to run this step.
      assertRelatedRowsWithinBounds(value as Row, relation.target, childTree)
    }
  }
}

// Define the helper that will extract path values.
function extractPathValues(
  value: Row,
  rootModel: AIModelName,
  path: string
): PathValue[] {
  // Use path.split to initialize segments.
  const segments = path.split('.')
  // Define the helper that will walk.
  function walk(
    current: unknown,
    model: AIModelName,
    index: number,
    prefix: string,
    context: ValueContext
  ): PathValue[] {
    // Check whether !isRecord(current) before running this branch.
    if (!isRecord(current)) return []
    // Define segment for the steps below.
    const segment = segments[index]
    // Check whether !segment before running this branch.
    if (!segment) return []
    // Define field for the steps below.
    const field = aiSchemaCatalog[model].fields[segment]
    // Check whether field before running this branch.
    if (field) {
      // Check whether index !== segments.length - 1 before running this branch.
      if (index !== segments.length - 1) return []
      // Use toScalar to initialize scalar.
      const scalar = toScalar(current[segment])
      // Pass scalar === undefined ? [] : [{ value: scalar, context }] back to the caller.
      return scalar === undefined ? [] : [{ value: scalar, context }]
    }
    // Use resolveAIRelation to initialize relation.
    const relation = resolveAIRelation(model, segment)
    // Check whether !relation before running this branch.
    if (!relation) return []
    // Define related for the steps below.
    const related = current[segment]
    // Define relationPath for the steps below.
    const relationPath = `${prefix}.${segment}`
    // Check whether Array.isArray(related) before running this branch.
    if (Array.isArray(related)) {
      // Pass related.flatMap((child, relationIndex) => walk(child, relation.target, index + 1, relationPath, { .. back to the caller.
      return related.flatMap((child, relationIndex) =>
        walk(child, relation.target, index + 1, relationPath, {
          ...context,
          [relationPath]: relationIndex,
        })
      )
    }
    // Pass related && typeof related === 'object' ? walk(related, relation.target, index + 1, relationPath, con back to the caller.
    return related && typeof related === 'object'
      ? walk(related, relation.target, index + 1, relationPath, context)
      : []
  }
  // Pass walk(value, rootModel, 0, rootModel, {}) back to the caller.
  return walk(value, rootModel, 0, rootModel, {})
}

// Define the helper that will selected path value.
function selectedPathValue(
  record: Row,
  model: AIModelName,
  path: string,
  contexts: ValueContext[]
): unknown {
  // Use extractPathValues to initialize occurrences.
  const occurrences = extractPathValues(record, model, path)
  // Use occurrences .filter((entry) => contexts.some((context) => compatibleContexts(context, entry.context) to initialize values.
  const values = occurrences
    .filter((entry) => contexts.some((context) => compatibleContexts(context, entry.context)))
    .map((entry) => entry.value)
  // Check whether pathTraversesMany(model, path) before running this branch.
  if (pathTraversesMany(model, path)) return values
  // Pass values[0] ?? null back to the caller.
  return values[0] ?? null
}

// Define the helper that will path traverses many.
function pathTraversesMany(model: AIModelName, path: string): boolean {
  // Define current for the steps below.
  let current = model
  // Repeat the following steps for each item in path.split('.').slice(0, -1).
  for (const segment of path.split('.').slice(0, -1)) {
    // Use resolveAIRelation to initialize relation.
    const relation = resolveAIRelation(current, segment)
    // Check whether !relation before running this branch.
    if (!relation) return false
    // Check whether relation.cardinality === 'many' before running this branch.
    if (relation.cardinality === 'many') return true
    // Update current with the value on the right.
    current = relation.target
  }
  // Pass false back to the caller.
  return false
}

// Define the helper that will to scalar.
function toScalar(value: unknown): Scalar | undefined {
  // Check whether value instanceof Date before running this branch.
  if (value instanceof Date) return value.toISOString()
  // Check whether typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' before running this branch.
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  // Pass undefined back to the caller.
  return undefined
}

// Define the helper that will evaluate filter.
function evaluateFilter(
  row: Row,
  model: AIModelName,
  filter: StructuredFilter,
  prefix: string,
  context: ValueContext
): ValueContext[] {
  // Check whether 'and' in filter before running this branch.
  if ('and' in filter) {
    // Define contexts for the steps below.
    let contexts: ValueContext[] = [context]
    // Repeat the following steps for each item in filter.and.
    for (const child of filter.and) {
      // Update contexts with the value on the right.
      contexts = contexts.flatMap((existing) =>
        evaluateFilter(row, model, child, prefix, existing)
          .map((candidate) => mergeContexts(existing, candidate))
          .filter((merged): merged is ValueContext => merged !== undefined)
      )
      // Check whether !contexts.length before running this branch.
      if (!contexts.length) break
    }
    // Pass uniqueContexts(contexts) back to the caller.
    return uniqueContexts(contexts)
  }
  // Check whether 'or' in filter before running this branch.
  if ('or' in filter) {
    // Pass uniqueContexts(filter.or.flatMap((child) => evaluateFilter(row, model, child, prefix, context))) back to the caller.
    return uniqueContexts(filter.or.flatMap((child) => evaluateFilter(row, model, child, prefix, context)))
  }
  // Check whether 'not' in filter before running this branch.
  if ('not' in filter) {
    // Pass evaluateFilter(row, model, filter.not, prefix, context).length ? [] : [context] back to the caller.
    return evaluateFilter(row, model, filter.not, prefix, context).length ? [] : [context]
  }
  // Check whether 'relation' in filter before running this branch.
  if ('relation' in filter) {
    // Use resolveAIRelation to initialize relation.
    const relation = resolveAIRelation(model, filter.relation)
    // Check whether !relation before running this branch.
    if (!relation) return []
    // Define relationPath for the steps below.
    const relationPath = `${prefix}.${relation.name}`
    // Define related for the steps below.
    const related = row[relation.name]
    // Check whether relation.cardinality === 'many' before running this branch.
    if (relation.cardinality === 'many') {
      // Define list for the steps below.
      const list = Array.isArray(related) ? related : []
      // Use list.flatMap to initialize childContexts.
      const childContexts = list.flatMap((child, index) =>
        evaluateFilter(child as Row, relation.target, filter.where, relationPath, {
          ...context,
          [relationPath]: index,
        })
      )
      // Check whether filter.quantifier === 'some' before running this branch.
      if (filter.quantifier === 'some') return uniqueContexts(childContexts)
      // Check whether filter.quantifier === 'none' before running this branch.
      if (filter.quantifier === 'none') return childContexts.length ? [] : [context]
      // Pass list.every((child) => evaluateFilter(child as Row, relation.target, filter.where, relationPath, cont back to the caller.
      return list.every((child) =>
        evaluateFilter(child as Row, relation.target, filter.where, relationPath, context).length > 0
      )
        ? [context]
        : []
    }
    // Use isRecord to initialize hasRelated.
    const hasRelated = isRecord(related)
    // Define childMatched for the steps below.
    const childMatched = hasRelated
      ? evaluateFilter(related, relation.target, filter.where, relationPath, context).length > 0
      : false
    // Pass (filter.quantifier === 'is' ? childMatched : !childMatched) ? [context] : [] back to the caller.
    return (filter.quantifier === 'is' ? childMatched : !childMatched) ? [context] : []
  }

  // Define actual for the steps below.
  const actual = row[filter.field]
  // Pass matchesScalar(actual, filter.operator, filter.value) ? [context] : [] back to the caller.
  return matchesScalar(actual, filter.operator, filter.value) ? [context] : []
}

// Define the helper that will matches scalar.
function matchesScalar(actual: unknown, operator: string, expected: unknown): boolean {
  // Check whether operator === 'in' before running this branch.
  if (operator === 'in') return Array.isArray(expected) && expected.includes(actual)
  // Check whether operator === 'notIn' before running this branch.
  if (operator === 'notIn') return Array.isArray(expected) && !expected.includes(actual)
  // Check whether Array.isArray(expected) before running this branch.
  if (Array.isArray(expected)) return false
  // Check whether operator === 'eq' before running this branch.
  if (operator === 'eq') return actual === expected
  // Check whether operator === 'ne' before running this branch.
  if (operator === 'ne') return actual !== expected
  // Check whether typeof actual === 'string' && typeof expected === 'string' before running this branch.
  if (typeof actual === 'string' && typeof expected === 'string') {
    // Check whether operator === 'contains' before running this branch.
    if (operator === 'contains') return actual.toLowerCase().includes(expected.toLowerCase())
    // Check whether operator === 'startsWith' before running this branch.
    if (operator === 'startsWith') return actual.toLowerCase().startsWith(expected.toLowerCase())
    // Check whether operator === 'endsWith' before running this branch.
    if (operator === 'endsWith') return actual.toLowerCase().endsWith(expected.toLowerCase())
  }
  // Define left for the steps below.
  const left = actual instanceof Date ? actual.getTime() : actual
  // Define right for the steps below.
  const right = typeof expected === 'string' && actual instanceof Date ? Date.parse(expected) : expected
  // Check whether typeof left === 'number' && typeof right === 'number' before running this branch.
  if (typeof left === 'number' && typeof right === 'number') {
    // Check whether operator === 'gt' before running this branch.
    if (operator === 'gt') return left > right
    // Check whether operator === 'gte' before running this branch.
    if (operator === 'gte') return left >= right
    // Check whether operator === 'lt' before running this branch.
    if (operator === 'lt') return left < right
    // Check whether operator === 'lte' before running this branch.
    if (operator === 'lte') return left <= right
  }
  // Check whether typeof left === 'string' && typeof right === 'string' before running this branch.
  if (typeof left === 'string' && typeof right === 'string') {
    // Check whether operator === 'gt' before running this branch.
    if (operator === 'gt') return left > right
    // Check whether operator === 'gte' before running this branch.
    if (operator === 'gte') return left >= right
    // Check whether operator === 'lt' before running this branch.
    if (operator === 'lt') return left < right
    // Check whether operator === 'lte' before running this branch.
    if (operator === 'lte') return left <= right
  }
  // Pass false back to the caller.
  return false
}

// Define the helper that will merge contexts.
function mergeContexts(left: ValueContext, right: ValueContext): ValueContext | undefined {
  // Repeat the following steps for each item in Object.entries(left).
  for (const [relation, index] of Object.entries(left)) {
    // Check whether right[relation] !== undefined && right[relation] !== index before running this branch.
    if (right[relation] !== undefined && right[relation] !== index) return undefined
  }
  // Pass { ...left, ...right } back to the caller.
  return { ...left, ...right }
}

// Define the helper that will compatible contexts.
function compatibleContexts(left: ValueContext, right: ValueContext): boolean {
  // Pass mergeContexts(left, right) !== undefined back to the caller.
  return mergeContexts(left, right) !== undefined
}

// Define the helper that will unique contexts.
function uniqueContexts(contexts: ValueContext[]): ValueContext[] {
  // Define unique for the steps below.
  const unique = new Map<string, ValueContext>()
  // Repeat the following steps for each item in contexts.
  for (const context of contexts) unique.set(JSON.stringify(context), context)
  // Pass [...unique.values()] back to the caller.
  return [...unique.values()]
}

// Define the helper that will build groups.
function buildGroups(plan: StructuredQueryPlan, entries: RootEntry[]): Map<string, GroupEntry> {
  // Define groups for the steps below.
  const groups = new Map<string, GroupEntry>()
  // Check whether !plan.groupBy?.length before running this branch.
  if (!plan.groupBy?.length) {
    // Define members for the steps below.
    const members = new Map(entries.map((entry) => [entry.id, entry.contexts]))
    // Call groups.set to run this step.
    groups.set('{}', { dimensions: {}, members })
    // Pass groups back to the caller.
    return groups
  }
  // Repeat the following steps for each item in entries.
  for (const entry of entries) {
    // Use plan.groupBy.map to initialize dimensions.
    const dimensions = plan.groupBy.map((path) => extractPathValues(entry.record, plan.model, path))
    // Check whether dimensions.some((values) => values.length === 0) before running this branch.
    if (dimensions.some((values) => values.length === 0)) continue
    // Repeat the following steps for each item in correlateGroupDimensions(dimensions, entry.contexts).
    for (const tuple of correlateGroupDimensions(dimensions, entry.contexts)) {
      // Define values for the steps below.
      const values = Object.fromEntries(plan.groupBy.map((path, index) => [path, tuple[index]!.value])) as Record<string, Scalar>
      // Use JSON.stringify to initialize key.
      const key = JSON.stringify(values)
      // Define group for the steps below.
      const group = groups.get(key) ?? { dimensions: values, members: new Map<string, ValueContext[]>() }
      // Define contexts for the steps below.
      const contexts = group.members.get(entry.id) ?? []
      // Call contexts.push to run this step.
      contexts.push(tuple[0]?.context ?? {})
      // Call group.members.set to run this step.
      group.members.set(entry.id, uniqueContexts(contexts))
      // Call groups.set to run this step.
      groups.set(key, group)
    }
  }
  // Pass groups back to the caller.
  return groups
}

type CorrelatedValue = { value: Scalar; context: ValueContext }

// Define the helper that will correlate group dimensions.
function correlateGroupDimensions(
  dimensions: PathValue[][],
  filterContexts: ValueContext[]
): CorrelatedValue[][] {
  // Define the helper that will combine.
  function combine(index: number, picked: CorrelatedValue[]): CorrelatedValue[][] {
    // Check whether index === dimensions.length before running this branch.
    if (index === dimensions.length) {
      // Use filterContexts .map((filterContext) => picked.reduce<ValueContext | undefined>( (current, item) => c to initialize mergedContexts.
      const mergedContexts = filterContexts
        .map((filterContext) => picked.reduce<ValueContext | undefined>(
          (current, item) => current ? mergeContexts(current, item.context) : undefined,
          filterContext
        ))
        .filter((context): context is ValueContext => context !== undefined)
      // Pass mergedContexts.map((context) => picked.map((item) => ({ value: item.value, context }))) back to the caller.
      return mergedContexts.map((context) => picked.map((item) => ({ value: item.value, context })))
    }
    // Define combinations for the steps below.
    const combinations: CorrelatedValue[][] = []
    // Repeat the following steps for each item in dimensions[index] ?? [].
    for (const candidate of dimensions[index] ?? []) {
      // Use picked.every to initialize compatible.
      const compatible = picked.every((item) => compatibleContexts(item.context, candidate.context))
      // Check whether compatible before running this branch.
      if (compatible) combinations.push(...combine(index + 1, [...picked, candidate]))
    }
    // Pass combinations back to the caller.
    return combinations
  }
  // Pass combine(0, []) back to the caller.
  return combine(0, [])
}

// Define the helper that will build aggregate values.
function buildAggregateValues(
  plan: StructuredQueryPlan,
  group: GroupEntry,
  allEntries: RootEntry[]
): Record<string, unknown> {
  // Define values for the steps below.
  const values: Record<string, unknown> = { ...group.dimensions }
  // Repeat the following steps for each item in plan.aggregates ?? [].
  for (const aggregate of plan.aggregates ?? []) {
    // Update values[aggregate.alias] with the value on the right.
    values[aggregate.alias] = aggregateForGroup(plan, aggregate, group, allEntries)
  }
  // Repeat the following steps for each item in plan.calculations ?? [].
  for (const calculation of plan.calculations ?? []) {
    // Define numerator for the steps below.
    const numerator = values[calculation.numerator]
    // Define denominator for the steps below.
    const denominator = values[calculation.denominator]
    // Update values[calculation.alias] with the value on the right.
    values[calculation.alias] =
      typeof numerator === 'number' && typeof denominator === 'number' && denominator !== 0
        ? (numerator / denominator) * 100
        : null
  }
  // Pass values back to the caller.
  return values
}

// Define the helper that will aggregate for group.
function aggregateForGroup(
  plan: StructuredQueryPlan,
  aggregate: StructuredAggregate,
  group: GroupEntry,
  allEntries: RootEntry[]
): number | string | null {
  // Define overall for the steps below.
  const overall = aggregate.scope === 'overall'
  // Define selectedEntries for the steps below.
  const selectedEntries = overall
    ? allEntries
    : allEntries.filter((entry) => group.members.has(entry.id))
  // Define collected for the steps below.
  const collected: Scalar[] = []
  // Define matchingRootCount for the steps below.
  let matchingRootCount = 0

  // Repeat the following steps for each item in selectedEntries.
  for (const entry of selectedEntries) {
    // Define groupContexts for the steps below.
    const groupContexts = overall ? entry.contexts : group.members.get(entry.id) ?? []
    // Define metricContexts for the steps below.
    const metricContexts = aggregate.where
      ? evaluateFilter(entry.record, plan.model, aggregate.where, plan.model, {})
      : [{}]
    // Use groupContexts.flatMap to initialize validContexts.
    const validContexts = groupContexts.flatMap((groupContext) =>
      entry.contexts.flatMap((baseContext) => {
        // Use mergeContexts to initialize base.
        const base = mergeContexts(groupContext, baseContext)
        // Pass base ? metricContexts .map((metricContext) => mergeContexts(base, metricContext)) .filter((context): back to the caller.
        return base
          ? metricContexts
              .map((metricContext) => mergeContexts(base, metricContext))
              .filter((context): context is ValueContext => context !== undefined)
          : []
      })
    )
    // Check whether !validContexts.length before running this branch.
    if (!validContexts.length) continue
    matchingRootCount += 1
    // Check whether !aggregate.field before running this branch.
    if (!aggregate.field) continue
    // Use extractPathValues to initialize occurrences.
    const occurrences = extractPathValues(entry.record, plan.model, aggregate.field)
    // Repeat the following steps for each item in occurrences.
    for (const occurrence of occurrences) {
      // Check whether validContexts.some((context) => compatibleContexts(context, occurrence.context)) before running this branch.
      if (validContexts.some((context) => compatibleContexts(context, occurrence.context))) {
        // Call collected.push to run this step.
        collected.push(occurrence.value)
      }
    }
  }

  // Check whether aggregate.function === 'count' && !aggregate.field before running this branch.
  if (aggregate.function === 'count' && !aggregate.field) return matchingRootCount
  // Check whether aggregate.function === 'count' && aggregate.field before running this branch.
  if (aggregate.function === 'count' && aggregate.field) return collected.length
  // Check whether aggregate.function === 'countDistinct' before running this branch.
  if (aggregate.function === 'countDistinct') {
    // Pass new Set(collected.map((value) => JSON.stringify(value))).size back to the caller.
    return new Set(collected.map((value) => JSON.stringify(value))).size
  }
  // Check whether ['sum', 'avg', 'min', 'max'].includes(aggregate.function) before running this branch.
  if (['sum', 'avg', 'min', 'max'].includes(aggregate.function)) {
    // Define field for the steps below.
    const field = aggregate.field ? resolveAIFieldPath(plan.model, aggregate.field) : undefined
    // Check whether !field || (['sum', 'avg'].includes(aggregate.function) && !['Int', 'Float', 'BigInt', 'Decimal'].inc before running this branch.
    if (
      !field ||
      (['sum', 'avg'].includes(aggregate.function) &&
        !['Int', 'Float', 'BigInt', 'Decimal'].includes(field.type))
    ) {
      // Stop this operation and tell the caller why it cannot continue.
      throw new StructuredQueryExecutionError(
        'INVALID_AGGREGATE',
        `${aggregate.function} requires a compatible numeric field`
      )
    }
    // Check whether !collected.length before running this branch.
    if (!collected.length) return null
    // Check whether field.type === 'DateTime' && ['min', 'max'].includes(aggregate.function) before running this branch.
    if (field.type === 'DateTime' && ['min', 'max'].includes(aggregate.function)) {
      // Use collected.map to initialize timestamps.
      const timestamps = collected.map((value) => Date.parse(String(value)))
      // Define result for the steps below.
      const result = aggregate.function === 'min' ? Math.min(...timestamps) : Math.max(...timestamps)
      // Pass new Date(result).toISOString() back to the caller.
      return new Date(result).toISOString()
    }
    // Use collected.filter to initialize numbers.
    const numbers = collected.filter((value): value is number => typeof value === 'number')
    // Check whether numbers.length !== collected.length before running this branch.
    if (numbers.length !== collected.length) {
      // Stop this operation and tell the caller why it cannot continue.
      throw new StructuredQueryExecutionError('INVALID_AGGREGATE', 'Numeric aggregate received a non-numeric value')
    }
    // Check whether aggregate.function === 'sum' before running this branch.
    if (aggregate.function === 'sum') return numbers.reduce((sum, value) => sum + value, 0)
    // Check whether aggregate.function === 'avg' before running this branch.
    if (aggregate.function === 'avg') return numbers.reduce((sum, value) => sum + value, 0) / numbers.length
    // Check whether aggregate.function === 'min' before running this branch.
    if (aggregate.function === 'min') return Math.min(...numbers)
    // Check whether aggregate.function === 'max' before running this branch.
    if (aggregate.function === 'max') return Math.max(...numbers)
  }
  // Pass null back to the caller.
  return null
}

// Define the helper that will build structured columns.
function buildStructuredColumns(plan: StructuredQueryPlan): StructuredQueryColumn[] {
  // Check whether plan.select before running this branch.
  if (plan.select) {
    // Pass plan.select.map((path) => ({ key: path, label: path.split('.').join(' · '), type: resolveAIFieldPath back to the caller.
    return plan.select.map((path) => ({
      key: path,
      label: path.split('.').join(' · '),
      type: resolveAIFieldPath(plan.model, path)?.type ?? 'unknown',
      role: 'field',
    }))
  }
  // Pass [ ...(plan.groupBy ?? []).map((path) => ({ key: path, label: path.split('.').join(' · '), type: reso back to the caller.
  return [
    ...(plan.groupBy ?? []).map((path) => ({
      key: path,
      label: path.split('.').join(' · '),
      type: resolveAIFieldPath(plan.model, path)?.type ?? 'unknown',
      role: 'dimension' as const,
    })),
    ...(plan.aggregates ?? []).map((metric) => ({
      key: metric.alias,
      label: metric.alias,
      type: metric.function === 'min' || metric.function === 'max'
        ? resolveAIFieldPath(plan.model, metric.field ?? '')?.type ?? 'unknown'
        : metric.function === 'avg'
          ? 'Float'
          : 'Int',
      role: 'metric' as const,
    })),
    ...(plan.calculations ?? []).map((calculation) => ({
      key: calculation.alias,
      label: calculation.alias,
      type: 'Float',
      role: 'calculation' as const,
    })),
  ]
}

// Define the helper that will sort aggregate rows.
function sortAggregateRows(
  rows: Array<{ key: string; values: Record<string, unknown> }>,
  orders: StructuredOrder[]
): void {
  // Check whether !orders.length before running this branch.
  if (!orders.length) return
  // Call rows.sort to run this step.
  rows.sort((left, right) => {
    // Repeat the following steps for each item in orders.
    for (const order of orders) {
      // Use compareResultValues to initialize comparison.
      const comparison = compareResultValues(left.values[order.field], right.values[order.field])
      // Check whether comparison before running this branch.
      if (comparison) return order.direction === 'asc' ? comparison : -comparison
    }
    // Pass left.key.localeCompare(right.key) back to the caller.
    return left.key.localeCompare(right.key)
  })
}

// Define the helper that will compare result values.
function compareResultValues(left: unknown, right: unknown): number {
  // Check whether left === right before running this branch.
  if (left === right) return 0
  // Check whether left === null || left === undefined before running this branch.
  if (left === null || left === undefined) return 1
  // Check whether right === null || right === undefined before running this branch.
  if (right === null || right === undefined) return -1
  // Check whether typeof left === 'number' && typeof right === 'number' before running this branch.
  if (typeof left === 'number' && typeof right === 'number') return left - right
  // Pass String(left).localeCompare(String(right)) back to the caller.
  return String(left).localeCompare(String(right))
}

// Define the helper that will is record.
function isRecord(value: unknown): value is Record<string, any> {
  // Pass typeof value === 'object' && value !== null && !Array.isArray(value) back to the caller.
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
