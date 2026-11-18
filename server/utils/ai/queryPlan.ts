import {
  aiSchemaCatalog,
  resolveAIFieldPath,
  resolveAIRelation,
  type AIAggregateFunction,
  type AIModelName,
} from './schemaCatalog'

const projectTypes = ['SOFTWARE', 'HARDWARE', 'BOTH'] as const
const projectStatuses = ['NEW', 'RETURNING', 'COMPLETE', 'WITHDRAWN', 'HOLD'] as const
const studentYears = ['FRESHMAN', 'SOPHOMORE', 'JUNIOR', 'SENIOR'] as const
const semesterPattern = /^(SP|SU|FA)\d{2}$/

/** Paths here are deliberately a small, explicit projection of the Prisma schema. */
const analyticsSchema = {
  semesters: {
    year: 'number',
    season: ['SPRING', 'SUMMER', 'FALL'],
    'teams.meetingDay': ['WEDNESDAY', 'THURSDAY'],
    'teams.project.type': projectTypes,
    'teams.project.status': projectStatuses,
    'teams.project.partner.name': 'string',
  },
  projects: {
    type: projectTypes,
    status: projectStatuses,
    name: 'string',
    'partner.name': 'string',
    'teams.meetingDay': ['WEDNESDAY', 'THURSDAY'],
    'teams.semester.year': 'number',
    'teams.semester.season': ['SPRING', 'SUMMER', 'FALL'],
  },
  partners: {
    name: 'string',
    'projects.type': projectTypes,
    'projects.status': projectStatuses,
    'projects.teams.meetingDay': ['WEDNESDAY', 'THURSDAY'],
    'projects.teams.semester.year': 'number',
    'projects.teams.semester.season': ['SPRING', 'SUMMER', 'FALL'],
  },
  teams: {
    meetingDay: ['WEDNESDAY', 'THURSDAY'],
    'semester.year': 'number',
    'semester.season': ['SPRING', 'SUMMER', 'FALL'],
    'project.type': projectTypes,
    'project.status': projectStatuses,
    'project.partner.name': 'string',
  },
  // These sources remain reserved for the protected student-query path.
  enrollments: {
    major: 'string',
    year: studentYears,
    class: ['EPCS_2200', 'EPCS_3200'],
    gender: ['MALE', 'FEMALE', 'OTHER'],
    meetingDay: ['WEDNESDAY', 'THURSDAY'],
  },
  memberships: { isMentor: 'boolean' },
  choices: { rank: 'number' },
} as const

export type AnalyticsSource = keyof typeof analyticsSchema
export type AnalyticsFilter = {
  field: string
  operator: 'eq' | 'in'
  value: string | number | boolean | Array<string | number | boolean>
}
export type AnalyticsMetric = {
  function: 'count' | 'countDistinct'
  field?: string
  alias: string
}
export type AnalyticsQuery = {
  source: AnalyticsSource
  filters: AnalyticsFilter[]
  dimensions: string[]
  metrics: AnalyticsMetric[]
  chartType?: AIChartType
}

export type AIChartType =
  | 'bar'
  | 'line'
  | 'area'
  | 'pie'
  | 'doughnut'
  | 'polarArea'
  | 'radar'
  | 'scatter'
  | 'bubble'
  | 'horizontalBar'
  | 'stackedBar'
  | 'sankey'
  | 'table'

export type StructuredFilterOperator =
  | 'eq'
  | 'ne'
  | 'in'
  | 'notIn'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'

export type AIRelationQuantifier = 'some' | 'none' | 'every' | 'is' | 'isNot'

export type StructuredFilter =
  | { and: StructuredFilter[] }
  | { or: StructuredFilter[] }
  | { not: StructuredFilter }
  | {
      relation: string
      quantifier: AIRelationQuantifier
      where: StructuredFilter
    }
  | { field: string; operator: StructuredFilterOperator; value: unknown }

export type StructuredAggregate = {
  function: AIAggregateFunction
  field?: string
  alias: string
  where?: StructuredFilter
  scope?: 'group' | 'overall'
}

export type StructuredCalculation = {
  function: 'percentage'
  numerator: string
  denominator: string
  alias: string
}

export type StructuredOrder = { field: string; direction: 'asc' | 'desc' }

/** Validated query IR for the future plan compiler. It is not executed in Phase 1. */
export type StructuredQueryPlan = {
  version: 1
  model: AIModelName
  select?: string[]
  where?: StructuredFilter
  groupBy?: string[]
  aggregates?: StructuredAggregate[]
  calculations?: StructuredCalculation[]
  orderBy?: StructuredOrder[]
  limit?: number
  chartType?: AIChartType
}

const structuredAggregates: readonly AIAggregateFunction[] = [
  'count',
  'countDistinct',
  'sum',
  'avg',
  'min',
  'max',
]
const structuredFilterOperators: readonly StructuredFilterOperator[] = [
  'eq',
  'ne',
  'in',
  'notIn',
  'contains',
  'startsWith',
  'endsWith',
  'gt',
  'gte',
  'lt',
  'lte',
]

/**
 * Validates the v1 IR against live generated Prisma metadata plus the explicit
 * AI allowlist. The existing executable v0 plans remain handled below.
 */
export function validateStructuredQueryPlan(input: unknown): StructuredQueryPlan {
  if (!isRecord(input)) throw new Error('Query plan must be an object')
  assertOnlyKeys(input, [
    'version',
    'model',
    'select',
    'where',
    'groupBy',
    'aggregates',
    'calculations',
    'orderBy',
    'limit',
    'chartType',
  ])
  if (input.version !== 1) throw new Error('Unsupported structured query version')
  if (typeof input.model !== 'string' || !Object.hasOwn(aiSchemaCatalog, input.model)) {
    throw new Error('Model is not approved for AI queries')
  }
  const model = input.model as AIModelName
  const select = validateFieldList(input.select, model, 'select', 30)
  const groupBy = validateFieldList(input.groupBy, model, 'groupBy', 3)
  const aggregates = validateStructuredAggregates(input.aggregates, model)
  const calculations = validateStructuredCalculations(input.calculations, aggregates)
  const orderBy = validateStructuredOrder(input.orderBy, model, aggregates, calculations)
  const where = input.where === undefined ? undefined : validateStructuredFilter(input.where, model, 0)

  if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100)) {
    throw new Error('Query limit must be an integer between 1 and 100')
  }
  const chartType = input.chartType === undefined ? undefined : validateChartType(input.chartType)
  const isAggregate = aggregates.length > 0 || groupBy.length > 0 || calculations.length > 0
  if (!select.length && !aggregates.length && !groupBy.length) {
    throw new Error('Query must select records or define an aggregate')
  }
  if (select.length && isAggregate) {
    throw new Error('Record selection cannot be combined with aggregate output')
  }
  if (groupBy.length && !aggregates.length) {
    throw new Error('Grouped queries require at least one aggregate')
  }
  if (calculations.length && !aggregates.length) {
    throw new Error('Calculations require aggregate metrics')
  }
  if (chartType && chartType !== 'table' && groupBy.length !== 1) {
    if (chartType !== 'sankey' || groupBy.length !== 2) {
      throw new Error('Charts require one grouping field, or two for a Sankey chart')
    }
  }
  if (chartType === 'sankey' && (groupBy.length !== 2 || aggregates.length !== 1 || calculations.length > 0)) {
    throw new Error('Sankey charts require two grouping fields and one aggregate metric')
  }
  if (
    chartType &&
    ['pie', 'doughnut', 'polarArea', 'scatter', 'bubble'].includes(chartType) &&
    aggregates.length !== 1
  ) {
    throw new Error(`${chartType} charts require exactly one aggregate metric`)
  }

  return {
    version: 1,
    model,
    ...(select.length ? { select } : {}),
    ...(where ? { where } : {}),
    ...(groupBy.length ? { groupBy } : {}),
    ...(aggregates.length ? { aggregates } : {}),
    ...(calculations.length ? { calculations } : {}),
    ...(orderBy.length ? { orderBy } : {}),
    ...(input.limit !== undefined ? { limit: input.limit as number } : {}),
    ...(chartType ? { chartType } : {}),
  }
}

function validateFieldList(
  value: unknown,
  model: AIModelName,
  label: 'select' | 'groupBy',
  max: number
): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > max) throw new Error(`Invalid ${label} fields`)
  const fields: string[] = []
  for (const field of value) {
    if (
      typeof field !== 'string' ||
      !resolveAIFieldPath(model, field)?.capabilities[label === 'groupBy' ? 'group' : 'select'] ||
      fields.includes(field)
    ) {
      throw new Error(`Field is not approved for ${label}: ${String(field)}`)
    }
    fields.push(field)
  }
  return fields
}

function validateStructuredAggregates(value: unknown, model: AIModelName): StructuredAggregate[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) {
    throw new Error('Aggregate list must contain between one and eight metrics')
  }
  const aliases = new Set<string>()
  return value.map((metric) => {
    if (!isRecord(metric)) throw new Error('Aggregate metric must be an object')
    assertOnlyKeys(metric, ['function', 'field', 'alias', 'where', 'scope'])
    if (
      typeof metric.function !== 'string' ||
      !structuredAggregates.includes(metric.function as AIAggregateFunction) ||
      typeof metric.alias !== 'string' ||
      !/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(metric.alias) ||
      aliases.has(metric.alias)
    ) {
      throw new Error('Invalid aggregate metric or alias')
    }
    if (metric.scope !== undefined && metric.scope !== 'group' && metric.scope !== 'overall') {
      throw new Error('Aggregate scope must be group or overall')
    }
    const fn = metric.function as AIAggregateFunction
    const where = metric.where === undefined ? undefined : validateStructuredFilter(metric.where, model, 0)
    if (fn === 'count' && metric.field === undefined) {
      aliases.add(metric.alias)
      return {
        function: fn,
        alias: metric.alias,
        ...(where ? { where } : {}),
        ...(metric.scope ? { scope: metric.scope } : {}),
      }
    }
    if (typeof metric.field !== 'string') throw new Error(`${fn} requires an approved field`)
    const field = resolveAIFieldPath(model, metric.field)
    if (!field || !field.capabilities.aggregate.includes(fn)) {
      throw new Error(`Field is not approved for ${fn}: ${metric.field}`)
    }
    if (fn === 'sum' || fn === 'avg') {
      if (!['Int', 'Float', 'BigInt', 'Decimal'].includes(field.type)) {
        throw new Error(`${fn} requires a numeric field`)
      }
    }
    aliases.add(metric.alias)
    return {
      function: fn,
      field: metric.field,
      alias: metric.alias,
      ...(where ? { where } : {}),
      ...(metric.scope ? { scope: metric.scope } : {}),
    }
  })
}

function validateStructuredCalculations(
  value: unknown,
  aggregates: StructuredAggregate[]
): StructuredCalculation[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 3) throw new Error('Invalid calculations')
  const knownAliases = new Set(aggregates.map((metric) => metric.alias))
  const aggregateByAlias = new Map(aggregates.map((metric) => [metric.alias, metric]))
  return value.map((calculation) => {
    if (!isRecord(calculation)) throw new Error('Calculation must be an object')
    assertOnlyKeys(calculation, ['function', 'numerator', 'denominator', 'alias'])
    if (
      calculation.function !== 'percentage' ||
      typeof calculation.numerator !== 'string' ||
      !knownAliases.has(calculation.numerator) ||
      typeof calculation.denominator !== 'string' ||
      !knownAliases.has(calculation.denominator) ||
      typeof calculation.alias !== 'string' ||
      !/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(calculation.alias) ||
      knownAliases.has(calculation.alias)
    ) {
      throw new Error('Invalid percentage calculation')
    }
    const numerator = aggregateByAlias.get(calculation.numerator)
    const denominator = aggregateByAlias.get(calculation.denominator)
    if (
      !numerator?.scope ||
      !denominator?.scope ||
      numerator.function !== denominator.function ||
      numerator.field !== denominator.field
    ) {
      throw new Error('Percentage metrics require explicit scopes and matching aggregate units')
    }
    knownAliases.add(calculation.alias)
    return {
      function: 'percentage',
      numerator: calculation.numerator,
      denominator: calculation.denominator,
      alias: calculation.alias,
    }
  })
}

function validateStructuredOrder(
  value: unknown,
  model: AIModelName,
  aggregates: StructuredAggregate[],
  calculations: StructuredCalculation[]
): StructuredOrder[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 3) throw new Error('Invalid sort order')
  const metricAliases = new Set([
    ...aggregates.map((metric) => metric.alias),
    ...calculations.map((calculation) => calculation.alias),
  ])
  return value.map((order) => {
    if (!isRecord(order)) throw new Error('Sort order must be an object')
    assertOnlyKeys(order, ['field', 'direction'])
    if (
      typeof order.field !== 'string' ||
      (order.direction !== 'asc' && order.direction !== 'desc') ||
      (!metricAliases.has(order.field) && !resolveAIFieldPath(model, order.field)?.capabilities.sort)
    ) {
      throw new Error('Sort field or direction is not approved')
    }
    return { field: order.field, direction: order.direction }
  })
}

function validateStructuredFilter(
  input: unknown,
  model: AIModelName,
  depth: number
): StructuredFilter {
  if (depth > 4 || !isRecord(input)) throw new Error('Invalid or excessively nested filter')
  if (Object.hasOwn(input, 'and') || Object.hasOwn(input, 'or')) {
    const key = Object.hasOwn(input, 'and') ? 'and' : 'or'
    assertOnlyKeys(input, [key])
    const children = input[key]
    if (!Array.isArray(children) || children.length < 1 || children.length > 20) {
      throw new Error(`${key} filter requires one to twenty clauses`)
    }
    return { [key]: children.map((child) => validateStructuredFilter(child, model, depth + 1)) } as
      | { and: StructuredFilter[] }
      | { or: StructuredFilter[] }
  }
  if (Object.hasOwn(input, 'not')) {
    assertOnlyKeys(input, ['not'])
    return { not: validateStructuredFilter(input.not, model, depth + 1) }
  }
  if (Object.hasOwn(input, 'relation')) {
    assertOnlyKeys(input, ['relation', 'quantifier', 'where'])
    if (typeof input.relation !== 'string' || typeof input.quantifier !== 'string') {
      throw new Error('Invalid relation filter')
    }
    const relation = resolveAIRelation(model, input.relation)
    const allowedQuantifiers = relation?.cardinality === 'many'
      ? ['some', 'none', 'every']
      : ['is', 'isNot']
    if (!relation || !allowedQuantifiers.includes(input.quantifier)) {
      throw new Error(`Relation or quantifier is not approved: ${input.relation}`)
    }
    return {
      relation: relation.name,
      quantifier: input.quantifier as AIRelationQuantifier,
      where: validateStructuredFilter(input.where, relation.target, depth + 1),
    } as StructuredFilter
  }

  assertOnlyKeys(input, ['field', 'operator', 'value'])
  if (
    typeof input.field !== 'string' ||
    input.field.includes('.') ||
    typeof input.operator !== 'string' ||
    !structuredFilterOperators.includes(input.operator as StructuredFilterOperator)
  ) {
    throw new Error('Invalid filter field or operator')
  }
  const field = resolveAIFieldPath(model, input.field)
  if (!field?.capabilities.filter || !isValidFilterValue(field.type, field.enumValues, input.operator, input.value)) {
    throw new Error(`Filter value or operator is not valid for ${model}.${input.field}`)
  }
  return {
    field: input.field,
    operator: input.operator as StructuredFilterOperator,
    value: input.value,
  }
}

function isValidFilterValue(
  type: string,
  enumValues: string[] | undefined,
  operator: string,
  value: unknown
): boolean {
  const values = operator === 'in' || operator === 'notIn' ? value : [value]
  if (!Array.isArray(values) || values.length < 1 || values.length > 50) return false
  if (['contains', 'startsWith', 'endsWith'].includes(operator) && type !== 'String') return false
  if (['gt', 'gte', 'lt', 'lte'].includes(operator) && !['Int', 'Float', 'BigInt', 'Decimal', 'DateTime', 'String'].includes(type)) return false
  if (enumValues) return values.every((item) => typeof item === 'string' && enumValues.includes(item))
  if (type === 'String') return values.every((item) => typeof item === 'string' && item.length <= 1000)
  if (type === 'DateTime') {
    return values.every((item) => typeof item === 'string' && !Number.isNaN(Date.parse(item)))
  }
  if (type === 'Boolean') return ['eq', 'ne', 'in', 'notIn'].includes(operator) && values.every((item) => typeof item === 'boolean')
  if (['Int', 'Float', 'BigInt', 'Decimal'].includes(type)) {
    return values.every(
      (item) =>
        typeof item === 'number' &&
        Number.isFinite(item) &&
        (!['Int', 'BigInt'].includes(type) || Number.isInteger(item))
    )
  }
  return false
}

function assertOnlyKeys(record: Record<string, unknown>, allowed: string[]): void {
  if (Object.keys(record).some((key) => !allowed.includes(key))) {
    throw new Error('Query plan contains an unsupported property')
  }
}

const studentSources: readonly AnalyticsSource[] = ['enrollments', 'memberships', 'choices']

export function validateQueryPlan(plan: unknown) {
  if (isRecord(plan) && Object.hasOwn(plan, 'source')) return validateAnalyticsQuery(plan)
  if (!isRecord(plan)) throw new Error('Invalid query plan')
  const filters = plan.filters
  if (!isRecord(filters)) throw new Error('Invalid filters')

  if (plan.entity === 'enrollments' && plan.operation === 'count') {
    if (!['major', 'year', 'none'].includes(plan.groupBy as string))
      throw new Error('Unsupported grouping')
    if (Object.keys(filters).some((key) => !['semester', 'major', 'year'].includes(key)))
      throw new Error('Unsupported enrollment filter')
    if (typeof filters.semester !== 'string' || !semesterPattern.test(filters.semester))
      throw new Error('Invalid semester')
    if (
      filters.major !== undefined &&
      (typeof filters.major !== 'string' || !filters.major.trim() || filters.major.length > 100)
    )
      throw new Error('Invalid major')
    if (
      filters.year !== undefined &&
      !studentYears.includes(filters.year as (typeof studentYears)[number])
    )
      throw new Error('Invalid student year')
    const chartType = plan.chartType === undefined ? undefined : validateChartType(plan.chartType)
    if (chartType && (plan.groupBy === 'none' || chartType === 'table')) {
      throw new Error('Enrollment charts require a grouping and a chart type')
    }
    return {
      entity: 'enrollments' as const,
      operation: 'count' as const,
      groupBy: plan.groupBy as 'major' | 'year' | 'none',
      filters: {
        semester: filters.semester,
        ...(typeof filters.major === 'string' ? { major: filters.major.trim() } : {}),
        ...(filters.year !== undefined
          ? { year: filters.year as (typeof studentYears)[number] }
          : {}),
      },
      ...(chartType ? { chartType } : {}),
    }
  }

  if (plan.entity === 'projects' && (plan.operation === 'search' || plan.operation === 'count')) {
    if (
      Object.keys(filters).some((key) => !['semester', 'keyword', 'type', 'status'].includes(key))
    )
      throw new Error('Unsupported project filter')
    if (
      filters.semester !== undefined &&
      (typeof filters.semester !== 'string' || !semesterPattern.test(filters.semester))
    )
      throw new Error('Invalid semester')
    if (
      filters.keyword !== undefined &&
      (typeof filters.keyword !== 'string' ||
        !filters.keyword.trim() ||
        filters.keyword.length > 100)
    )
      throw new Error('Invalid keyword')
    if (
      filters.type !== undefined &&
      !projectTypes.includes(filters.type as (typeof projectTypes)[number])
    )
      throw new Error('Invalid project type')
    if (
      filters.status !== undefined &&
      !projectStatuses.includes(filters.status as (typeof projectStatuses)[number])
    )
      throw new Error('Invalid project status')
    if (plan.groupBy !== 'none' && plan.groupBy !== undefined)
      throw new Error('Unsupported project grouping')
    if (plan.chartType !== undefined) throw new Error('Charts are not supported for project lists')
    return {
      entity: 'projects' as const,
      operation: plan.operation as 'search' | 'count',
      groupBy: 'none' as const,
      filters: {
        ...(typeof filters.semester === 'string' ? { semester: filters.semester } : {}),
        ...(typeof filters.keyword === 'string' ? { keyword: filters.keyword.trim() } : {}),
        ...(filters.type !== undefined
          ? { type: filters.type as (typeof projectTypes)[number] }
          : {}),
        ...(filters.status !== undefined
          ? { status: filters.status as (typeof projectStatuses)[number] }
          : {}),
      },
    }
  }
  throw new Error('Unsupported query')
}

export function validateAnalyticsQuery(input: unknown): AnalyticsQuery {
  if (!isRecord(input)) throw new Error('Invalid analytical query')
  if (typeof input.source !== 'string' || !Object.hasOwn(analyticsSchema, input.source))
    throw new Error('Unsupported analytical source')
  const source = input.source as AnalyticsSource
  if (studentSources.includes(source))
    throw new Error('Student analytics require the protected enrollment query path')
  const schema = analyticsSchema[source] as Record<string, string | readonly string[]>
  if (
    !Array.isArray(input.filters) ||
    !Array.isArray(input.dimensions) ||
    !Array.isArray(input.metrics)
  )
    throw new Error('Invalid analytical query structure')
  if (
    input.filters.length > 10 ||
    input.dimensions.length > 3 ||
    input.metrics.length < 1 ||
    input.metrics.length > 3
  )
    throw new Error('Analytical query exceeds limits')
  if (
    Object.keys(input).some(
      (key) => !['source', 'filters', 'dimensions', 'metrics', 'chartType'].includes(key)
    )
  )
    throw new Error('Unsupported analytical query property')

  const chartType = input.chartType === undefined ? undefined : validateChartType(input.chartType)

  const filters: AnalyticsFilter[] = []
  const seenFilters = new Set<string>()
  for (const value of input.filters) {
    if (
      !isRecord(value) ||
      typeof value.field !== 'string' ||
      !(value.field in schema) ||
      !['eq', 'in'].includes(value.operator as string)
    )
      throw new Error('Unsupported analytical filter')
    if (seenFilters.has(value.field)) throw new Error('Duplicate analytical filter field')
    seenFilters.add(value.field)
    const values = Array.isArray(value.value) ? value.value : [value.value]
    if (
      (value.operator === 'eq' && Array.isArray(value.value)) ||
      (value.operator === 'in' &&
        (!Array.isArray(value.value) || value.value.length < 1 || value.value.length > 20))
    )
      throw new Error('Invalid analytical filter value')
    const expected = schema[value.field]
    for (const item of values) {
      if (Array.isArray(expected)) {
        if (typeof item !== 'string' || !expected.includes(item))
          throw new Error('Invalid enum filter value')
      } else if (expected === 'number') {
        if (typeof item !== 'number' || !Number.isInteger(item))
          throw new Error('Expected an integer filter value')
      } else if (expected === 'boolean') {
        if (typeof item !== 'boolean') throw new Error('Expected a boolean filter value')
      } else if (typeof item !== 'string' || !item.trim() || item.length > 100)
        throw new Error('Invalid string filter value')
    }
    if (
      (source === 'projects' && value.field === 'teams.semester.year') ||
      (source === 'partners' && value.field === 'projects.teams.semester.year') ||
      (source === 'teams' && value.field === 'semester.year') ||
      (source === 'semesters' && value.field === 'year')
    ) {
      if (values.some((item) => typeof item !== 'number' || item < 2000 || item > 2099))
        throw new Error('Invalid academic year')
    }
    filters.push({
      field: value.field,
      operator: value.operator as 'eq' | 'in',
      value: value.value as AnalyticsFilter['value'],
    })
  }

  const dimensions: string[] = []
  for (const dimension of input.dimensions) {
    if (typeof dimension !== 'string' || !(dimension in schema) || dimensions.includes(dimension))
      throw new Error('Unsupported analytical dimension')
    dimensions.push(dimension)
  }

  const metrics: AnalyticsMetric[] = []
  const aliases = new Set<string>()
  for (const value of input.metrics) {
    if (
      !isRecord(value) ||
      !['count', 'countDistinct'].includes(value.function as string) ||
      typeof value.alias !== 'string' ||
      !/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(value.alias) ||
      aliases.has(value.alias)
    )
      throw new Error('Unsupported analytical metric')
    if (value.field !== undefined && (typeof value.field !== 'string' || !(value.field in schema)))
      throw new Error('Unsupported metric field')
    if (value.function === 'countDistinct' && value.field === undefined)
      throw new Error('countDistinct requires an approved field')
    if (value.function === 'count' && value.field !== undefined)
      throw new Error('count does not accept a field')
    aliases.add(value.alias)
    metrics.push({
      function: value.function as 'count' | 'countDistinct',
      ...(typeof value.field === 'string' ? { field: value.field } : {}),
      alias: value.alias,
    })
  }

  const supportsMultipleMetrics = ['line', 'area', 'radar', 'stackedBar'].includes(chartType ?? '')
  const validSankeyShape = chartType === 'sankey' && dimensions.length === 2 && metrics.length === 1
  if (
    chartType !== undefined &&
    chartType !== 'table' &&
    (!validSankeyShape && (dimensions.length !== 1 || (!supportsMultipleMetrics && metrics.length !== 1)))
  ) {
    throw new Error('Chart plans require one dimension and a compatible metric count')
  }

  if (studentSources.includes(source)) {
    if (metrics.some((metric) => metric.function !== 'count' || metric.field !== undefined))
      throw new Error('Student-related queries must use aggregate row counts')
    if (
      dimensions.length > 1 ||
      filters.length > 1 ||
      (dimensions.length && filters.length && dimensions[0] === filters[0]?.field)
    )
      throw new Error('Student-related query risks overlapping-filter inference')
  }
  return { source, filters, dimensions, metrics, ...(chartType ? { chartType } : {}) }
}

export function validateChartType(value: unknown): AIChartType {
  if (typeof value !== 'string') {
    throw new Error('Unsupported chart type')
  }
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, '')
  const chartTypes: Record<string, AIChartType> = {
    bar: 'bar',
    column: 'bar',
    line: 'line',
    area: 'area',
    pie: 'pie',
    doughnut: 'doughnut',
    donut: 'doughnut',
    polararea: 'polarArea',
    radar: 'radar',
    scatter: 'scatter',
    bubble: 'bubble',
    horizontalbar: 'horizontalBar',
    stackedbar: 'stackedBar',
    sankey: 'sankey',
    table: 'table',
  }
  const chartType = chartTypes[normalized]
  if (!chartType) throw new Error('Unsupported chart type')
  return chartType
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

