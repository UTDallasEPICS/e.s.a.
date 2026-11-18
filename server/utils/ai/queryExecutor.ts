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

const seasonCodes = { SP: 'SPRING', SU: 'SUMMER', FA: 'FALL' } as const

export async function executeQueryPlan(rawPlan: unknown) {
  const plan = validateQueryPlan(rawPlan)

  if ('source' in plan) {
    if (['enrollments', 'memberships', 'choices'].includes(plan.source)) {
      throw new Error('Student analytics are not available through this query path')
    }
    const records = await fetchAnalyticsRecords(plan.source)
    return executeAnalytics(plan, records)
  }

  if (plan.entity === 'projects') {
    let semesterId: string | undefined
    if (plan.filters.semester) {
      const code = plan.filters.semester
      const prefix = code.slice(0, 2) as keyof typeof seasonCodes
      const semester = await prisma.semester.findUnique({
        where: { year_season: { year: 2000 + Number(code.slice(2)), season: seasonCodes[prefix] } },
        select: { id: true },
      })
      if (!semester) return { results: [], count: 0 }
      semesterId = semester.id
    }
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
    if (plan.operation === 'count')
      return { count: await prisma.project.count({ where }), results: [] }
    const projects = await prisma.project.findMany({
      where,
      select: { id: true, name: true, description: true, type: true, status: true },
      orderBy: { name: 'asc' },
    })
    return { results: projects, count: projects.length }
  }

  const code = plan.filters.semester
  const prefix = code.slice(0, 2) as keyof typeof seasonCodes
  const season = seasonCodes[prefix]
  const semester = await prisma.semester.findUnique({
    where: { year_season: { year: 2000 + Number(code.slice(2)), season } },
    select: { id: true },
  })
  if (!semester) return { semester: code, results: [], count: 0 }

  const where = {
    semesterId: semester.id,
    ...(plan.filters.major ? { major: plan.filters.major } : {}),
    ...(plan.filters.year ? { year: plan.filters.year } : {}),
  }
  if (plan.groupBy === 'year') {
    const groups = await prisma.enrollment.groupBy({
      by: ['year'],
      where,
      _count: { _all: true },
      orderBy: { year: 'asc' },
    })
    return {
      semester: code,
      results: protectAggregateResults(
        groups.map((group) => ({ year: group.year, count: group._count._all }))
      ),
    }
  }
  if (plan.groupBy === 'major') {
    const groups = await prisma.enrollment.groupBy({
      by: ['major'],
      where,
      _count: { _all: true },
      orderBy: { major: 'asc' },
    })
    return {
      semester: code,
      results: protectAggregateResults(
        groups.map((group) => ({ major: group.major, count: group._count._all }))
      ),
    }
  }
  return { semester: code, count: protectAggregateCount(await prisma.enrollment.count({ where })) }
}

async function fetchAnalyticsRecords(source: AnalyticsQuery['source']): Promise<Row[]> {
  // These fixed selects form the data-access boundary. Plans can choose only paths
  // validated against queryPlan.ts; they cannot change the Prisma selection.
  switch (source) {
    case 'projects':
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
      return prisma.team.findMany({
        select: {
          id: true,
          meetingDay: true,
          Semester: { select: { year: true, season: true } },
          Project: { select: { type: true, status: true, Partner: { select: { name: true } } } },
        },
      }) as unknown as Promise<Row[]>
    case 'semesters':
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
      throw new Error('Unsupported analytical source')
  }
}

function executeAnalytics(plan: AnalyticsQuery, records: Row[]) {
  const filtered = records.filter((record) => matchesFilters(record, plan.filters))

  if (plan.dimensions.length === 0) {
    const values = plan.metrics.map((metric) => [
      metric.alias,
      metricValue(filtered, metric.function, metric.field),
    ])
    const result = Object.fromEntries(values)
    const primaryMetric =
      plan.metrics.find((metric) => metric.function === 'count') ?? plan.metrics[0]
    return { ...result, count: result[primaryMetric!.alias] as number, results: [] }
  }

  const groups = new Map<
    string,
    { dimensions: Record<string, Scalar>; records: Map<string, Row[]> }
  >()
  for (const record of filtered) {
    const id = String(record.id)
    for (const combination of correlatedDimensionTuples(record, plan.dimensions)) {
      const dimensions = Object.fromEntries(
        plan.dimensions.map((field, index) => [field, combination[index] as Scalar])
      )
      const key = JSON.stringify(dimensions)
      const group = groups.get(key) ?? { dimensions, records: new Map<string, Row[]>() }
      group.records.set(id, [...(group.records.get(id) ?? []), record])
      groups.set(key, group)
    }
  }

  const results = [...groups.values()].map((group) => {
    const members = [...group.records.values()].map((rows) => rows[0]!).filter(Boolean)
    const metrics = Object.fromEntries(
      plan.metrics.map((metric) => [
        metric.alias,
        metricValue(members, metric.function, metric.field),
      ])
    )
    const primaryMetric =
      plan.metrics.find((metric) => metric.function === 'count') ?? plan.metrics[0]
    const count = metrics[primaryMetric!.alias] as number
    return { ...group.dimensions, ...metrics, count }
  })
  results.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
  return { results }
}

function matchesFilters(record: Row, filters: AnalyticsQuery['filters']): boolean {
  type PathFilter = AnalyticsQuery['filters'][number] & { path: string[] }
  const withPaths: PathFilter[] = filters.map((filter) => ({
    ...filter,
    path: filter.field.split('.'),
  }))

  function matches(value: unknown, pending: PathFilter[]): boolean {
    if (pending.length === 0) return true
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false

    const row = value as Record<string, unknown>
    const grouped = new Map<string, PathFilter[]>()
    for (const filter of pending) {
      const segment = filter.path[0]
      if (!segment) return false
      const group = grouped.get(segment) ?? []
      group.push(filter)
      grouped.set(segment, group)
    }

    for (const [segment, group] of grouped) {
      const actualKey = Object.keys(row).find((key) => key.toLowerCase() === segment.toLowerCase())
      if (!actualKey) return false
      const child = row[actualKey]
      const nested = group.map((filter) => ({ ...filter, path: filter.path.slice(1) }))

      if (Array.isArray(child)) {
        if (!child.some((item) => matches(item, nested))) return false
      } else if (typeof child === 'object' && child !== null) {
        if (!matches(child, nested)) return false
      } else {
        if (nested.some((filter) => filter.path.length !== 0 || !matchesFilterValue(child, filter)))
          return false
      }
    }
    return true
  }

  return matches(record, withPaths)
}

function matchesFilterValue(actual: unknown, filter: AnalyticsQuery['filters'][number]): boolean {
  const expected = Array.isArray(filter.value) ? filter.value : [filter.value]
  return expected.some((value) => value === actual)
}

function correlatedDimensionTuples(record: Row, fields: string[]): Scalar[][] {
  type ValueWithContext = { value: Scalar; context: Record<string, number> }

  function dimensionValues(
    value: unknown,
    path: string[],
    context: Record<string, number> = {},
    relationPath: string[] = []
  ): ValueWithContext[] {
    if (Array.isArray(value)) {
      return value.flatMap((item, index) =>
        dimensionValues(item, path, { ...context, [relationPath.join('.')]: index }, relationPath)
      )
    }
    if (typeof value !== 'object' || value === null) return []
    const row = value as Record<string, unknown>
    const [segment, ...tail] = path
    if (!segment) return []
    const key = Object.keys(row).find(
      (candidate) => candidate.toLowerCase() === segment.toLowerCase()
    )
    if (!key) return []
    const next = row[key]
    const nextRelationPath = [...relationPath, segment.toLowerCase()]
    if (tail.length === 0) {
      if (typeof next === 'string' || typeof next === 'number' || typeof next === 'boolean')
        return [{ value: next, context }]
      return Array.isArray(next) ? dimensionValues(next, tail, context, nextRelationPath) : []
    }
    return dimensionValues(next, tail, context, nextRelationPath)
  }

  const options = fields.map((field) => dimensionValues(record, field.split('.')))
  if (options.some((values) => values.length === 0)) return []

  function combine(index: number, picked: ValueWithContext[]): Scalar[][] {
    if (index === options.length) return [picked.map((item) => item.value)]
    const tuples: Scalar[][] = []
    for (const candidate of options[index] ?? []) {
      const compatible = picked.every((item) =>
        Object.entries(item.context).every(
          ([relation, relationIndex]) =>
            candidate.context[relation] === undefined ||
            candidate.context[relation] === relationIndex
        )
      )
      if (compatible) tuples.push(...combine(index + 1, [...picked, candidate]))
    }
    return tuples
  }

  return combine(0, [])
}

function metricValue(records: Row[], fn: 'count' | 'countDistinct', field?: string): number {
  if (fn === 'count') return records.length
  if (!field) throw new Error('countDistinct requires a field')
  const values = records.flatMap((record) => valuesAtPath(record, field))
  return new Set(values.map((value) => JSON.stringify(value))).size
}

function valuesAtPath(value: unknown, path: string): Scalar[] {
  const [head, ...tail] = path.split('.')
  if (Array.isArray(value)) return value.flatMap((item) => valuesAtPath(item, path))
  if (typeof value !== 'object' || value === null || !head) return []
  const next = (value as Record<string, unknown>)[head]
  if (tail.length) return valuesAtPath(next, tail.join('.'))
  return typeof next === 'string' || typeof next === 'number' || typeof next === 'boolean'
    ? [next]
    : []
}

const MAX_SCAN_ROOT_ROWS = 5_000
const MAX_RELATED_ROWS = 100
const MAX_GROUPS = 500
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
    super(message)
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
  const plan = enforceStructuredQueryPrivacy(input)
  const recordQuery = plan.select !== undefined
  const resultLimit = plan.limit ?? MAX_RESULT_ROWS
  const selection = buildSelectionTree(plan)
  const select = compileSelection(plan.model, selection)
  const where = plan.where ? compilePrismaFilter(plan.model, plan.where) : undefined
  const orderBy = recordQuery ? compileRecordOrder(plan.model, plan.orderBy ?? []) : undefined
  if (!recordQuery) validateAggregateOrder(plan)

  const delegate = (client as ReadClient)[delegateNames[plan.model]]
  if (!delegate || typeof delegate.findMany !== 'function') {
    throw new StructuredQueryExecutionError('INVALID_QUERY_RESULT', 'Approved Prisma delegate is unavailable')
  }

  const fetchLimit = recordQuery ? resultLimit + 1 : MAX_SCAN_ROOT_ROWS + 1
  const rawRows = await delegate.findMany({
    select,
    ...(where ? { where } : {}),
    ...(orderBy?.length ? { orderBy } : {}),
    take: fetchLimit,
  })
  if (!Array.isArray(rawRows)) {
    throw new StructuredQueryExecutionError('INVALID_QUERY_RESULT', 'Prisma returned a non-list result')
  }
  if (!recordQuery && rawRows.length > MAX_SCAN_ROOT_ROWS) {
    throw new StructuredQueryExecutionError(
      'RESULT_LIMIT_EXCEEDED',
      `Query scans more than ${MAX_SCAN_ROOT_ROWS} root records; add a selective filter`
    )
  }

  const dataRows = rawRows as Row[]
  for (const row of dataRows) assertRelatedRowsWithinBounds(row, plan.model, selection)
  const contextsByRoot = new Map<string, ValueContext[]>()
  for (const row of dataRows) {
    const id = String(row.id)
    const contexts = plan.where
      ? evaluateFilter(row, plan.model, plan.where, plan.model, {})
      : [{}]
    if (!contexts.length) {
      throw new StructuredQueryExecutionError(
        'INVALID_QUERY_RESULT',
        'Prisma filter results could not be reconciled with correlated relation scopes'
      )
    }
    contextsByRoot.set(id, uniqueContexts(contexts))
  }
  const hasMore = recordQuery && dataRows.length > resultLimit
  const boundedRows = recordQuery ? dataRows.slice(0, resultLimit) : dataRows
  const columns = buildStructuredColumns(plan)

  if (recordQuery) {
    const rows = boundedRows.map((record) => ({
      key: String(record.id),
      values: Object.fromEntries(
        (plan.select ?? []).map((path) => [
          path,
          selectedPathValue(record, plan.model, path, contextsByRoot.get(String(record.id)) ?? [{}]),
        ])
      ),
    }))
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

  const entries = dataRows.map((record) => {
    const id = String(record.id)
    return { id, record, contexts: contextsByRoot.get(id) ?? [{}] }
  })
  const matchingEntries = entries.filter((entry) => entry.contexts.length > 0)
  const groups = buildGroups(plan, matchingEntries)
  if (groups.size > MAX_GROUPS) {
    throw new StructuredQueryExecutionError(
      'GROUP_LIMIT_EXCEEDED',
      `Query produces more than ${MAX_GROUPS} groups; add filters or reduce grouping fields`
    )
  }

  const aggregateRows = [...groups.entries()].map(([key, group]) => ({
    key,
    values: buildAggregateValues(plan, group, matchingEntries),
  }))
  sortAggregateRows(aggregateRows, plan.orderBy ?? [])
  const hasMoreGroups = aggregateRows.length > resultLimit
  const outputRows = aggregateRows.slice(0, resultLimit)
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

function buildSelectionTree(plan: StructuredQueryPlan): SelectTree {
  const root: SelectTree = { fields: new Set(['id']), relations: new Map() }
  const paths = new Set<string>([
    ...(plan.select ?? []),
    ...(plan.groupBy ?? []),
    ...(plan.aggregates ?? []).flatMap((metric) => [
      ...(metric.field ? [metric.field] : []),
      ...structuredFilterPaths(metric.where, plan.model),
    ]),
    ...structuredFilterPaths(plan.where, plan.model),
  ])
  for (const path of paths) addSelectionPath(root, plan.model, path)
  return root
}

function addSelectionPath(tree: SelectTree, model: AIModelName, path: string): void {
  const segments = path.split('.')
  let currentTree = tree
  let currentModel = model
  for (const [index, segment] of segments.entries()) {
    const field = aiSchemaCatalog[currentModel].fields[segment]
    if (field) {
      if (index !== segments.length - 1) {
        throw new StructuredQueryExecutionError('INVALID_QUERY_RESULT', `Invalid field path: ${path}`)
      }
      currentTree.fields.add(segment)
      return
    }
    const relation = resolveAIRelation(currentModel, segment)
    if (!relation || index === segments.length - 1) {
      throw new StructuredQueryExecutionError('INVALID_QUERY_RESULT', `Invalid relationship path: ${path}`)
    }
    let child = currentTree.relations.get(segment)
    if (!child) {
      child = { fields: new Set(['id']), relations: new Map() }
      currentTree.relations.set(segment, child)
    }
    currentTree = child
    currentModel = relation.target
  }
}

function structuredFilterPaths(filter: StructuredFilter | undefined, model: AIModelName): string[] {
  if (!filter) return []
  if ('field' in filter) return [filter.field]
  if ('and' in filter || 'or' in filter) {
    const clauses = 'and' in filter ? filter.and : filter.or
    return clauses.flatMap((clause) => structuredFilterPaths(clause, model))
  }
  if ('not' in filter) return structuredFilterPaths(filter.not, model)
  if ('relation' in filter) {
    const relation = resolveAIRelation(model, filter.relation)
    return relation
      ? structuredFilterPaths(filter.where, relation.target).map((path) => `${filter.relation}.${path}`)
      : []
  }
  return []
}

function compileSelection(model: AIModelName, tree: SelectTree): Record<string, unknown> {
  const selection: Record<string, unknown> = Object.fromEntries([...tree.fields].map((field) => [field, true]))
  for (const [name, child] of tree.relations) {
    const relation = resolveAIRelation(model, name)
    if (!relation) throw new StructuredQueryExecutionError('INVALID_QUERY_RESULT', `Unapproved relation: ${name}`)
    selection[name] = {
      select: compileSelection(relation.target, child),
      ...(relation.cardinality === 'many' ? { take: MAX_RELATED_ROWS + 1 } : {}),
    }
  }
  return selection
}

function compilePrismaFilter(model: AIModelName, filter: StructuredFilter): Record<string, unknown> {
  if ('and' in filter) return { AND: filter.and.map((child) => compilePrismaFilter(model, child)) }
  if ('or' in filter) return { OR: filter.or.map((child) => compilePrismaFilter(model, child)) }
  if ('not' in filter) return { NOT: compilePrismaFilter(model, filter.not) }
  if ('relation' in filter) {
    const relation = resolveAIRelation(model, filter.relation)
    if (!relation) throw new StructuredQueryExecutionError('INVALID_QUERY_RESULT', `Unapproved relation: ${filter.relation}`)
    return { [relation.name]: { [filter.quantifier]: compilePrismaFilter(relation.target, filter.where) } }
  }
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
  return { [filter.field]: { [prismaOperator[filter.operator]!]: filter.value } }
}

function compileRecordOrder(model: AIModelName, orders: StructuredOrder[]): Array<Record<string, unknown>> {
  return orders.map((order) => {
    const path = order.field.split('.')
    let currentModel = model
    const parts: string[] = []
    for (const [index, segment] of path.entries()) {
      const field = aiSchemaCatalog[currentModel].fields[segment]
      if (field) {
        if (index !== path.length - 1) break
        parts.push(segment)
        return nestedOrder(parts, order.direction)
      }
      const relation = resolveAIRelation(currentModel, segment)
      if (!relation || relation.cardinality === 'many') {
        throw new StructuredQueryExecutionError(
          'UNSUPPORTED_SORT',
          `Record sorting through a to-many relationship is unsupported: ${order.field}`
        )
      }
      parts.push(segment)
      currentModel = relation.target
    }
    throw new StructuredQueryExecutionError('UNSUPPORTED_SORT', `Invalid record sort field: ${order.field}`)
  })
}

function nestedOrder(path: string[], direction: 'asc' | 'desc'): Record<string, unknown> {
  return path.reduceRight<Record<string, unknown>>((value, segment) => ({ [segment]: value }), direction)
}

function validateAggregateOrder(plan: StructuredQueryPlan): void {
  const groupFields = new Set(plan.groupBy ?? [])
  const aggregateAliases = new Set([
    ...(plan.aggregates ?? []).map((metric) => metric.alias),
    ...(plan.calculations ?? []).map((calculation) => calculation.alias),
  ])
  for (const order of plan.orderBy ?? []) {
    if (!groupFields.has(order.field) && !aggregateAliases.has(order.field)) {
      throw new StructuredQueryExecutionError(
        'UNSUPPORTED_SORT',
        `Aggregate sorting requires a grouping field or metric alias: ${order.field}`
      )
    }
  }
}

function assertRelatedRowsWithinBounds(row: Row, model: AIModelName, tree: SelectTree): void {
  for (const [name, childTree] of tree.relations) {
    const relation = resolveAIRelation(model, name)
    const value = row[name]
    if (!relation || value === null || value === undefined) continue
    if (relation.cardinality === 'many') {
      if (!Array.isArray(value)) throw new StructuredQueryExecutionError('INVALID_QUERY_RESULT', `Expected list for ${model}.${name}`)
      if (value.length > MAX_RELATED_ROWS) {
        throw new StructuredQueryExecutionError(
          'RELATED_ROW_LIMIT_EXCEEDED',
          `${model}.${name} exceeds the ${MAX_RELATED_ROWS} related-record execution limit`
        )
      }
      for (const child of value) assertRelatedRowsWithinBounds(child as Row, relation.target, childTree)
    } else {
      assertRelatedRowsWithinBounds(value as Row, relation.target, childTree)
    }
  }
}

function extractPathValues(
  value: Row,
  rootModel: AIModelName,
  path: string
): PathValue[] {
  const segments = path.split('.')
  function walk(
    current: unknown,
    model: AIModelName,
    index: number,
    prefix: string,
    context: ValueContext
  ): PathValue[] {
    if (!isRecord(current)) return []
    const segment = segments[index]
    if (!segment) return []
    const field = aiSchemaCatalog[model].fields[segment]
    if (field) {
      if (index !== segments.length - 1) return []
      const scalar = toScalar(current[segment])
      return scalar === undefined ? [] : [{ value: scalar, context }]
    }
    const relation = resolveAIRelation(model, segment)
    if (!relation) return []
    const related = current[segment]
    const relationPath = `${prefix}.${segment}`
    if (Array.isArray(related)) {
      return related.flatMap((child, relationIndex) =>
        walk(child, relation.target, index + 1, relationPath, {
          ...context,
          [relationPath]: relationIndex,
        })
      )
    }
    return related && typeof related === 'object'
      ? walk(related, relation.target, index + 1, relationPath, context)
      : []
  }
  return walk(value, rootModel, 0, rootModel, {})
}

function selectedPathValue(
  record: Row,
  model: AIModelName,
  path: string,
  contexts: ValueContext[]
): unknown {
  const occurrences = extractPathValues(record, model, path)
  const values = occurrences
    .filter((entry) => contexts.some((context) => compatibleContexts(context, entry.context)))
    .map((entry) => entry.value)
  if (pathTraversesMany(model, path)) return values
  return values[0] ?? null
}

function pathTraversesMany(model: AIModelName, path: string): boolean {
  let current = model
  for (const segment of path.split('.').slice(0, -1)) {
    const relation = resolveAIRelation(current, segment)
    if (!relation) return false
    if (relation.cardinality === 'many') return true
    current = relation.target
  }
  return false
}

function toScalar(value: unknown): Scalar | undefined {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  return undefined
}

function evaluateFilter(
  row: Row,
  model: AIModelName,
  filter: StructuredFilter,
  prefix: string,
  context: ValueContext
): ValueContext[] {
  if ('and' in filter) {
    let contexts: ValueContext[] = [context]
    for (const child of filter.and) {
      contexts = contexts.flatMap((existing) =>
        evaluateFilter(row, model, child, prefix, existing)
          .map((candidate) => mergeContexts(existing, candidate))
          .filter((merged): merged is ValueContext => merged !== undefined)
      )
      if (!contexts.length) break
    }
    return uniqueContexts(contexts)
  }
  if ('or' in filter) {
    return uniqueContexts(filter.or.flatMap((child) => evaluateFilter(row, model, child, prefix, context)))
  }
  if ('not' in filter) {
    return evaluateFilter(row, model, filter.not, prefix, context).length ? [] : [context]
  }
  if ('relation' in filter) {
    const relation = resolveAIRelation(model, filter.relation)
    if (!relation) return []
    const relationPath = `${prefix}.${relation.name}`
    const related = row[relation.name]
    if (relation.cardinality === 'many') {
      const list = Array.isArray(related) ? related : []
      const childContexts = list.flatMap((child, index) =>
        evaluateFilter(child as Row, relation.target, filter.where, relationPath, {
          ...context,
          [relationPath]: index,
        })
      )
      if (filter.quantifier === 'some') return uniqueContexts(childContexts)
      if (filter.quantifier === 'none') return childContexts.length ? [] : [context]
      return list.every((child) =>
        evaluateFilter(child as Row, relation.target, filter.where, relationPath, context).length > 0
      )
        ? [context]
        : []
    }
    const hasRelated = isRecord(related)
    const childMatched = hasRelated
      ? evaluateFilter(related, relation.target, filter.where, relationPath, context).length > 0
      : false
    return (filter.quantifier === 'is' ? childMatched : !childMatched) ? [context] : []
  }

  const actual = row[filter.field]
  return matchesScalar(actual, filter.operator, filter.value) ? [context] : []
}

function matchesScalar(actual: unknown, operator: string, expected: unknown): boolean {
  if (operator === 'in') return Array.isArray(expected) && expected.includes(actual)
  if (operator === 'notIn') return Array.isArray(expected) && !expected.includes(actual)
  if (Array.isArray(expected)) return false
  if (operator === 'eq') return actual === expected
  if (operator === 'ne') return actual !== expected
  if (typeof actual === 'string' && typeof expected === 'string') {
    if (operator === 'contains') return actual.toLowerCase().includes(expected.toLowerCase())
    if (operator === 'startsWith') return actual.toLowerCase().startsWith(expected.toLowerCase())
    if (operator === 'endsWith') return actual.toLowerCase().endsWith(expected.toLowerCase())
  }
  const left = actual instanceof Date ? actual.getTime() : actual
  const right = typeof expected === 'string' && actual instanceof Date ? Date.parse(expected) : expected
  if (typeof left === 'number' && typeof right === 'number') {
    if (operator === 'gt') return left > right
    if (operator === 'gte') return left >= right
    if (operator === 'lt') return left < right
    if (operator === 'lte') return left <= right
  }
  if (typeof left === 'string' && typeof right === 'string') {
    if (operator === 'gt') return left > right
    if (operator === 'gte') return left >= right
    if (operator === 'lt') return left < right
    if (operator === 'lte') return left <= right
  }
  return false
}

function mergeContexts(left: ValueContext, right: ValueContext): ValueContext | undefined {
  for (const [relation, index] of Object.entries(left)) {
    if (right[relation] !== undefined && right[relation] !== index) return undefined
  }
  return { ...left, ...right }
}

function compatibleContexts(left: ValueContext, right: ValueContext): boolean {
  return mergeContexts(left, right) !== undefined
}

function uniqueContexts(contexts: ValueContext[]): ValueContext[] {
  const unique = new Map<string, ValueContext>()
  for (const context of contexts) unique.set(JSON.stringify(context), context)
  return [...unique.values()]
}

function buildGroups(plan: StructuredQueryPlan, entries: RootEntry[]): Map<string, GroupEntry> {
  const groups = new Map<string, GroupEntry>()
  if (!plan.groupBy?.length) {
    const members = new Map(entries.map((entry) => [entry.id, entry.contexts]))
    groups.set('{}', { dimensions: {}, members })
    return groups
  }
  for (const entry of entries) {
    const dimensions = plan.groupBy.map((path) => extractPathValues(entry.record, plan.model, path))
    if (dimensions.some((values) => values.length === 0)) continue
    for (const tuple of correlateGroupDimensions(dimensions, entry.contexts)) {
      const values = Object.fromEntries(plan.groupBy.map((path, index) => [path, tuple[index]!.value])) as Record<string, Scalar>
      const key = JSON.stringify(values)
      const group = groups.get(key) ?? { dimensions: values, members: new Map<string, ValueContext[]>() }
      const contexts = group.members.get(entry.id) ?? []
      contexts.push(tuple[0]?.context ?? {})
      group.members.set(entry.id, uniqueContexts(contexts))
      groups.set(key, group)
    }
  }
  return groups
}

type CorrelatedValue = { value: Scalar; context: ValueContext }

function correlateGroupDimensions(
  dimensions: PathValue[][],
  filterContexts: ValueContext[]
): CorrelatedValue[][] {
  function combine(index: number, picked: CorrelatedValue[]): CorrelatedValue[][] {
    if (index === dimensions.length) {
      const mergedContexts = filterContexts
        .map((filterContext) => picked.reduce<ValueContext | undefined>(
          (current, item) => current ? mergeContexts(current, item.context) : undefined,
          filterContext
        ))
        .filter((context): context is ValueContext => context !== undefined)
      return mergedContexts.map((context) => picked.map((item) => ({ value: item.value, context })))
    }
    const combinations: CorrelatedValue[][] = []
    for (const candidate of dimensions[index] ?? []) {
      const compatible = picked.every((item) => compatibleContexts(item.context, candidate.context))
      if (compatible) combinations.push(...combine(index + 1, [...picked, candidate]))
    }
    return combinations
  }
  return combine(0, [])
}

function buildAggregateValues(
  plan: StructuredQueryPlan,
  group: GroupEntry,
  allEntries: RootEntry[]
): Record<string, unknown> {
  const values: Record<string, unknown> = { ...group.dimensions }
  for (const aggregate of plan.aggregates ?? []) {
    values[aggregate.alias] = aggregateForGroup(plan, aggregate, group, allEntries)
  }
  for (const calculation of plan.calculations ?? []) {
    const numerator = values[calculation.numerator]
    const denominator = values[calculation.denominator]
    values[calculation.alias] =
      typeof numerator === 'number' && typeof denominator === 'number' && denominator !== 0
        ? (numerator / denominator) * 100
        : null
  }
  return values
}

function aggregateForGroup(
  plan: StructuredQueryPlan,
  aggregate: StructuredAggregate,
  group: GroupEntry,
  allEntries: RootEntry[]
): number | string | null {
  const overall = aggregate.scope === 'overall'
  const selectedEntries = overall
    ? allEntries
    : allEntries.filter((entry) => group.members.has(entry.id))
  const collected: Scalar[] = []
  let matchingRootCount = 0

  for (const entry of selectedEntries) {
    const groupContexts = overall ? entry.contexts : group.members.get(entry.id) ?? []
    const metricContexts = aggregate.where
      ? evaluateFilter(entry.record, plan.model, aggregate.where, plan.model, {})
      : [{}]
    const validContexts = groupContexts.flatMap((groupContext) =>
      entry.contexts.flatMap((baseContext) => {
        const base = mergeContexts(groupContext, baseContext)
        return base
          ? metricContexts
              .map((metricContext) => mergeContexts(base, metricContext))
              .filter((context): context is ValueContext => context !== undefined)
          : []
      })
    )
    if (!validContexts.length) continue
    matchingRootCount += 1
    if (!aggregate.field) continue
    const occurrences = extractPathValues(entry.record, plan.model, aggregate.field)
    for (const occurrence of occurrences) {
      if (validContexts.some((context) => compatibleContexts(context, occurrence.context))) {
        collected.push(occurrence.value)
      }
    }
  }

  if (aggregate.function === 'count' && !aggregate.field) return matchingRootCount
  if (aggregate.function === 'count' && aggregate.field) return collected.length
  if (aggregate.function === 'countDistinct') {
    return new Set(collected.map((value) => JSON.stringify(value))).size
  }
  if (['sum', 'avg', 'min', 'max'].includes(aggregate.function)) {
    const field = aggregate.field ? resolveAIFieldPath(plan.model, aggregate.field) : undefined
    if (
      !field ||
      (['sum', 'avg'].includes(aggregate.function) &&
        !['Int', 'Float', 'BigInt', 'Decimal'].includes(field.type))
    ) {
      throw new StructuredQueryExecutionError(
        'INVALID_AGGREGATE',
        `${aggregate.function} requires a compatible numeric field`
      )
    }
    if (!collected.length) return null
    if (field.type === 'DateTime' && ['min', 'max'].includes(aggregate.function)) {
      const timestamps = collected.map((value) => Date.parse(String(value)))
      const result = aggregate.function === 'min' ? Math.min(...timestamps) : Math.max(...timestamps)
      return new Date(result).toISOString()
    }
    const numbers = collected.filter((value): value is number => typeof value === 'number')
    if (numbers.length !== collected.length) {
      throw new StructuredQueryExecutionError('INVALID_AGGREGATE', 'Numeric aggregate received a non-numeric value')
    }
    if (aggregate.function === 'sum') return numbers.reduce((sum, value) => sum + value, 0)
    if (aggregate.function === 'avg') return numbers.reduce((sum, value) => sum + value, 0) / numbers.length
    if (aggregate.function === 'min') return Math.min(...numbers)
    if (aggregate.function === 'max') return Math.max(...numbers)
  }
  return null
}

function buildStructuredColumns(plan: StructuredQueryPlan): StructuredQueryColumn[] {
  if (plan.select) {
    return plan.select.map((path) => ({
      key: path,
      label: path.split('.').join(' · '),
      type: resolveAIFieldPath(plan.model, path)?.type ?? 'unknown',
      role: 'field',
    }))
  }
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

function sortAggregateRows(
  rows: Array<{ key: string; values: Record<string, unknown> }>,
  orders: StructuredOrder[]
): void {
  if (!orders.length) return
  rows.sort((left, right) => {
    for (const order of orders) {
      const comparison = compareResultValues(left.values[order.field], right.values[order.field])
      if (comparison) return order.direction === 'asc' ? comparison : -comparison
    }
    return left.key.localeCompare(right.key)
  })
}

function compareResultValues(left: unknown, right: unknown): number {
  if (left === right) return 0
  if (left === null || left === undefined) return 1
  if (right === null || right === undefined) return -1
  if (typeof left === 'number' && typeof right === 'number') return left - right
  return String(left).localeCompare(String(right))
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
