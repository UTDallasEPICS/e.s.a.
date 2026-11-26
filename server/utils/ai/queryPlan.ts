/**
 * Purpose
 * Provide the query plan logic used by other parts of ESA.
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
import {
  aiSchemaCatalog,
  resolveAIFieldPath,
  resolveAIRelation,
  type AIAggregateFunction,
  type AIModelName,
} from './schemaCatalog'

// Define projectTypes for the steps below.
const projectTypes = ['SOFTWARE', 'HARDWARE', 'BOTH', 'UNKNOWN'] as const
// Define projectStatuses for the steps below.
const projectStatuses = ['NEW', 'RETURNING', 'COMPLETE', 'WITHDRAWN', 'HOLD'] as const
// Define studentYears for the steps below.
const studentYears = ['FRESHMAN', 'SOPHOMORE', 'JUNIOR', 'SENIOR', 'UNKNOWN'] as const
// Define semesterPattern for the steps below.
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

// Define structuredAggregates for the steps below.
const structuredAggregates: readonly AIAggregateFunction[] = [
  'count',
  'countDistinct',
  'sum',
  'avg',
  'min',
  'max',
]
// Define structuredFilterOperators for the steps below.
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
  // Check whether !isRecord(input) before running this branch.
  if (!isRecord(input)) throw new Error('Query plan must be an object')
  // Call assertOnlyKeys to run this step.
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
  // Check whether input.version !== 1 before running this branch.
  if (input.version !== 1) throw new Error('Unsupported structured query version')
  // Check whether typeof input.model !== 'string' || !Object.hasOwn(aiSchemaCatalog, input.model) before running this branch.
  if (typeof input.model !== 'string' || !Object.hasOwn(aiSchemaCatalog, input.model)) {
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error('Model is not approved for AI queries')
  }
  // Define model for the steps below.
  const model = input.model as AIModelName
  // Use validateFieldList to initialize select.
  const select = validateFieldList(input.select, model, 'select', 30)
  // Use validateFieldList to initialize groupBy.
  const groupBy = validateFieldList(input.groupBy, model, 'groupBy', 3)
  // Use validateStructuredAggregates to initialize aggregates.
  const aggregates = validateStructuredAggregates(input.aggregates, model)
  // Use validateStructuredCalculations to initialize calculations.
  const calculations = validateStructuredCalculations(input.calculations, aggregates)
  // Use validateStructuredOrder to initialize orderBy.
  const orderBy = validateStructuredOrder(input.orderBy, model, aggregates, calculations)
  // Define where for the steps below.
  const where = input.where === undefined ? undefined : validateStructuredFilter(input.where, model, 0)

  // Check whether input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100 before running this branch.
  if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100)) {
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error('Query limit must be an integer between 1 and 100')
  }
  // Define chartType for the steps below.
  const chartType = input.chartType === undefined ? undefined : validateChartType(input.chartType)
  // Define isAggregate for the steps below.
  const isAggregate = aggregates.length > 0 || groupBy.length > 0 || calculations.length > 0
  // Check whether !select.length && !aggregates.length && !groupBy.length before running this branch.
  if (!select.length && !aggregates.length && !groupBy.length) {
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error('Query must select records or define an aggregate')
  }
  // Check whether select.length && isAggregate before running this branch.
  if (select.length && isAggregate) {
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error('Record selection cannot be combined with aggregate output')
  }
  // Check whether groupBy.length && !aggregates.length before running this branch.
  if (groupBy.length && !aggregates.length) {
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error('Grouped queries require at least one aggregate')
  }
  // Check whether calculations.length && !aggregates.length before running this branch.
  if (calculations.length && !aggregates.length) {
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error('Calculations require aggregate metrics')
  }
  // Check whether chartType && chartType !== 'table' && groupBy.length !== 1 before running this branch.
  if (chartType && chartType !== 'table' && groupBy.length !== 1) {
    // Check whether chartType !== 'sankey' || groupBy.length !== 2 before running this branch.
    if (chartType !== 'sankey' || groupBy.length !== 2) {
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('Charts require one grouping field, or two for a Sankey chart')
    }
  }
  // Check whether chartType === 'sankey' && (groupBy.length !== 2 || aggregates.length !== 1 || calculations.length >  before running this branch.
  if (chartType === 'sankey' && (groupBy.length !== 2 || aggregates.length !== 1 || calculations.length > 0)) {
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error('Sankey charts require two grouping fields and one aggregate metric')
  }
  // Check whether chartType && ['pie', 'doughnut', 'polarArea', 'scatter', 'bubble'].includes(chartType) && aggregates before running this branch.
  if (
    chartType &&
    ['pie', 'doughnut', 'polarArea', 'scatter', 'bubble'].includes(chartType) &&
    aggregates.length !== 1
  ) {
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error(`${chartType} charts require exactly one aggregate metric`)
  }

  // Pass { version: 1, model, ...(select.length ? { select } : {}), ...(where ? { where } : {}), ...(groupBy. back to the caller.
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

// Define the helper that will validate field list.
function validateFieldList(
  value: unknown,
  model: AIModelName,
  label: 'select' | 'groupBy',
  max: number
): string[] {
  // Check whether value === undefined before running this branch.
  if (value === undefined) return []
  // Check whether !Array.isArray(value) || value.length > max before running this branch.
  if (!Array.isArray(value) || value.length > max) throw new Error(`Invalid ${label} fields`)
  // Define fields for the steps below.
  const fields: string[] = []
  // Repeat the following steps for each item in value.
  for (const field of value) {
    // Check whether typeof field !== 'string' || !resolveAIFieldPath(model, field)?.capabilities[label === 'groupBy' ? ' before running this branch.
    if (
      typeof field !== 'string' ||
      !resolveAIFieldPath(model, field)?.capabilities[label === 'groupBy' ? 'group' : 'select'] ||
      fields.includes(field)
    ) {
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error(`Field is not approved for ${label}: ${String(field)}`)
    }
    // Call fields.push to run this step.
    fields.push(field)
  }
  // Pass fields back to the caller.
  return fields
}

// Define the helper that will validate structured aggregates.
function validateStructuredAggregates(value: unknown, model: AIModelName): StructuredAggregate[] {
  // Check whether value === undefined before running this branch.
  if (value === undefined) return []
  // Check whether !Array.isArray(value) || value.length < 1 || value.length > 8 before running this branch.
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) {
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error('Aggregate list must contain between one and eight metrics')
  }
  // Define aliases for the steps below.
  const aliases = new Set<string>()
  // Pass value.map((metric) => { if (!isRecord(metric)) throw new Error('Aggregate metric must be an object') back to the caller.
  return value.map((metric) => {
    // Check whether !isRecord(metric) before running this branch.
    if (!isRecord(metric)) throw new Error('Aggregate metric must be an object')
    // Call assertOnlyKeys to run this step.
    assertOnlyKeys(metric, ['function', 'field', 'alias', 'where', 'scope'])
    // Check whether typeof metric.function !== 'string' || !structuredAggregates.includes(metric.function as AIAggregate before running this branch.
    if (
      typeof metric.function !== 'string' ||
      !structuredAggregates.includes(metric.function as AIAggregateFunction) ||
      typeof metric.alias !== 'string' ||
      !/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(metric.alias) ||
      aliases.has(metric.alias)
    ) {
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('Invalid aggregate metric or alias')
    }
    // Check whether metric.scope !== undefined && metric.scope !== 'group' && metric.scope !== 'overall' before running this branch.
    if (metric.scope !== undefined && metric.scope !== 'group' && metric.scope !== 'overall') {
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('Aggregate scope must be group or overall')
    }
    // Define fn for the steps below.
    const fn = metric.function as AIAggregateFunction
    // Define where for the steps below.
    const where = metric.where === undefined ? undefined : validateStructuredFilter(metric.where, model, 0)
    // Check whether fn === 'count' && metric.field === undefined before running this branch.
    if (fn === 'count' && metric.field === undefined) {
      // Call aliases.add to run this step.
      aliases.add(metric.alias)
      // Pass { function: fn, alias: metric.alias, ...(where ? { where } : {}), ...(metric.scope ? { scope: metric back to the caller.
      return {
        function: fn,
        alias: metric.alias,
        ...(where ? { where } : {}),
        ...(metric.scope ? { scope: metric.scope } : {}),
      }
    }
    // Check whether typeof metric.field !== 'string' before running this branch.
    if (typeof metric.field !== 'string') throw new Error(`${fn} requires an approved field`)
    // Use resolveAIFieldPath to initialize field.
    const field = resolveAIFieldPath(model, metric.field)
    // Check whether !field || !field.capabilities.aggregate.includes(fn) before running this branch.
    if (!field || !field.capabilities.aggregate.includes(fn)) {
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error(`Field is not approved for ${fn}: ${metric.field}`)
    }
    // Check whether fn === 'sum' || fn === 'avg' before running this branch.
    if (fn === 'sum' || fn === 'avg') {
      // Check whether !['Int', 'Float', 'BigInt', 'Decimal'].includes(field.type) before running this branch.
      if (!['Int', 'Float', 'BigInt', 'Decimal'].includes(field.type)) {
        // Stop this operation and tell the caller why it cannot continue.
        throw new Error(`${fn} requires a numeric field`)
      }
    }
    // Call aliases.add to run this step.
    aliases.add(metric.alias)
    // Pass { function: fn, field: metric.field, alias: metric.alias, ...(where ? { where } : {}), ...(metric.sc back to the caller.
    return {
      function: fn,
      field: metric.field,
      alias: metric.alias,
      ...(where ? { where } : {}),
      ...(metric.scope ? { scope: metric.scope } : {}),
    }
  })
}

// Define the helper that will validate structured calculations.
function validateStructuredCalculations(
  value: unknown,
  aggregates: StructuredAggregate[]
): StructuredCalculation[] {
  // Check whether value === undefined before running this branch.
  if (value === undefined) return []
  // Check whether !Array.isArray(value) || value.length > 3 before running this branch.
  if (!Array.isArray(value) || value.length > 3) throw new Error('Invalid calculations')
  // Define knownAliases for the steps below.
  const knownAliases = new Set(aggregates.map((metric) => metric.alias))
  // Define aggregateByAlias for the steps below.
  const aggregateByAlias = new Map(aggregates.map((metric) => [metric.alias, metric]))
  // Pass value.map((calculation) => { if (!isRecord(calculation)) throw new Error('Calculation must be an obj back to the caller.
  return value.map((calculation) => {
    // Check whether !isRecord(calculation) before running this branch.
    if (!isRecord(calculation)) throw new Error('Calculation must be an object')
    // Call assertOnlyKeys to run this step.
    assertOnlyKeys(calculation, ['function', 'numerator', 'denominator', 'alias'])
    // Check whether calculation.function !== 'percentage' || typeof calculation.numerator !== 'string' || !knownAliases. before running this branch.
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
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('Invalid percentage calculation')
    }
    // Use aggregateByAlias.get to initialize numerator.
    const numerator = aggregateByAlias.get(calculation.numerator)
    // Use aggregateByAlias.get to initialize denominator.
    const denominator = aggregateByAlias.get(calculation.denominator)
    // Check whether !numerator?.scope || !denominator?.scope || numerator.function !== denominator.function || numerator before running this branch.
    if (
      !numerator?.scope ||
      !denominator?.scope ||
      numerator.function !== denominator.function ||
      numerator.field !== denominator.field
    ) {
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('Percentage metrics require explicit scopes and matching aggregate units')
    }
    // Call knownAliases.add to run this step.
    knownAliases.add(calculation.alias)
    // Pass { function: 'percentage', numerator: calculation.numerator, denominator: calculation.denominator, al back to the caller.
    return {
      function: 'percentage',
      numerator: calculation.numerator,
      denominator: calculation.denominator,
      alias: calculation.alias,
    }
  })
}

// Define the helper that will validate structured order.
function validateStructuredOrder(
  value: unknown,
  model: AIModelName,
  aggregates: StructuredAggregate[],
  calculations: StructuredCalculation[]
): StructuredOrder[] {
  // Check whether value === undefined before running this branch.
  if (value === undefined) return []
  // Check whether !Array.isArray(value) || value.length > 3 before running this branch.
  if (!Array.isArray(value) || value.length > 3) throw new Error('Invalid sort order')
  // Define metricAliases for the steps below.
  const metricAliases = new Set([
    ...aggregates.map((metric) => metric.alias),
    ...calculations.map((calculation) => calculation.alias),
  ])
  // Pass value.map((order) => { if (!isRecord(order)) throw new Error('Sort order must be an object') assertO back to the caller.
  return value.map((order) => {
    // Check whether !isRecord(order) before running this branch.
    if (!isRecord(order)) throw new Error('Sort order must be an object')
    // Call assertOnlyKeys to run this step.
    assertOnlyKeys(order, ['field', 'direction'])
    // Check whether typeof order.field !== 'string' || (order.direction !== 'asc' && order.direction !== 'desc') || (!me before running this branch.
    if (
      typeof order.field !== 'string' ||
      (order.direction !== 'asc' && order.direction !== 'desc') ||
      (!metricAliases.has(order.field) && !resolveAIFieldPath(model, order.field)?.capabilities.sort)
    ) {
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('Sort field or direction is not approved')
    }
    // Pass { field: order.field, direction: order.direction } back to the caller.
    return { field: order.field, direction: order.direction }
  })
}

// Define the helper that will validate structured filter.
function validateStructuredFilter(
  input: unknown,
  model: AIModelName,
  depth: number
): StructuredFilter {
  // Check whether depth > 4 || !isRecord(input) before running this branch.
  if (depth > 4 || !isRecord(input)) throw new Error('Invalid or excessively nested filter')
  // Check whether Object.hasOwn(input, 'and') || Object.hasOwn(input, 'or') before running this branch.
  if (Object.hasOwn(input, 'and') || Object.hasOwn(input, 'or')) {
    // Define key for the steps below.
    const key = Object.hasOwn(input, 'and') ? 'and' : 'or'
    // Call assertOnlyKeys to run this step.
    assertOnlyKeys(input, [key])
    // Define children for the steps below.
    const children = input[key]
    // Check whether !Array.isArray(children) || children.length < 1 || children.length > 20 before running this branch.
    if (!Array.isArray(children) || children.length < 1 || children.length > 20) {
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error(`${key} filter requires one to twenty clauses`)
    }
    // Pass { [key]: children.map((child) => validateStructuredFilter(child, model, depth + 1)) } as | { and: St back to the caller.
    return { [key]: children.map((child) => validateStructuredFilter(child, model, depth + 1)) } as
      | { and: StructuredFilter[] }
      | { or: StructuredFilter[] }
  }
  // Check whether Object.hasOwn(input, 'not') before running this branch.
  if (Object.hasOwn(input, 'not')) {
    // Call assertOnlyKeys to run this step.
    assertOnlyKeys(input, ['not'])
    // Pass { not: validateStructuredFilter(input.not, model, depth + 1) } back to the caller.
    return { not: validateStructuredFilter(input.not, model, depth + 1) }
  }
  // Check whether Object.hasOwn(input, 'relation') before running this branch.
  if (Object.hasOwn(input, 'relation')) {
    // Call assertOnlyKeys to run this step.
    assertOnlyKeys(input, ['relation', 'quantifier', 'where'])
    // Check whether typeof input.relation !== 'string' || typeof input.quantifier !== 'string' before running this branch.
    if (typeof input.relation !== 'string' || typeof input.quantifier !== 'string') {
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('Invalid relation filter')
    }
    // Use resolveAIRelation to initialize relation.
    const relation = resolveAIRelation(model, input.relation)
    // Define allowedQuantifiers for the steps below.
    const allowedQuantifiers = relation?.cardinality === 'many'
      ? ['some', 'none', 'every']
      : ['is', 'isNot']
    // Check whether !relation || !allowedQuantifiers.includes(input.quantifier) before running this branch.
    if (!relation || !allowedQuantifiers.includes(input.quantifier)) {
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error(`Relation or quantifier is not approved: ${input.relation}`)
    }
    // Pass { relation: relation.name, quantifier: input.quantifier as AIRelationQuantifier, where: validateStru back to the caller.
    return {
      relation: relation.name,
      quantifier: input.quantifier as AIRelationQuantifier,
      where: validateStructuredFilter(input.where, relation.target, depth + 1),
    } as StructuredFilter
  }

  // Call assertOnlyKeys to run this step.
  assertOnlyKeys(input, ['field', 'operator', 'value'])
  // Check whether typeof input.field !== 'string' || input.field.includes('.') || typeof input.operator !== 'string' | before running this branch.
  if (
    typeof input.field !== 'string' ||
    input.field.includes('.') ||
    typeof input.operator !== 'string' ||
    !structuredFilterOperators.includes(input.operator as StructuredFilterOperator)
  ) {
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error('Invalid filter field or operator')
  }
  // Use resolveAIFieldPath to initialize field.
  const field = resolveAIFieldPath(model, input.field)
  // Check whether !field?.capabilities.filter || !isValidFilterValue(field.type, field.enumValues, input.operator, inp before running this branch.
  if (!field?.capabilities.filter || !isValidFilterValue(field.type, field.enumValues, input.operator, input.value)) {
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error(`Filter value or operator is not valid for ${model}.${input.field}`)
  }
  // Pass { field: input.field, operator: input.operator as StructuredFilterOperator, value: input.value, } back to the caller.
  return {
    field: input.field,
    operator: input.operator as StructuredFilterOperator,
    value: input.value,
  }
}

// Define the helper that will is valid filter value.
function isValidFilterValue(
  type: string,
  enumValues: string[] | undefined,
  operator: string,
  value: unknown
): boolean {
  // Define values for the steps below.
  const values = operator === 'in' || operator === 'notIn' ? value : [value]
  // Check whether !Array.isArray(values) || values.length < 1 || values.length > 50 before running this branch.
  if (!Array.isArray(values) || values.length < 1 || values.length > 50) return false
  // Check whether ['contains', 'startsWith', 'endsWith'].includes(operator) && type !== 'String' before running this branch.
  if (['contains', 'startsWith', 'endsWith'].includes(operator) && type !== 'String') return false
  // Check whether ['gt', 'gte', 'lt', 'lte'].includes(operator) && !['Int', 'Float', 'BigInt', 'Decimal', 'DateTime',  before running this branch.
  if (['gt', 'gte', 'lt', 'lte'].includes(operator) && !['Int', 'Float', 'BigInt', 'Decimal', 'DateTime', 'String'].includes(type)) return false
  // Check whether enumValues before running this branch.
  if (enumValues) return values.every((item) => typeof item === 'string' && enumValues.includes(item))
  // Check whether type === 'String' before running this branch.
  if (type === 'String') return values.every((item) => typeof item === 'string' && item.length <= 1000)
  // Check whether type === 'DateTime' before running this branch.
  if (type === 'DateTime') {
    // Pass values.every((item) => typeof item === 'string' && !Number.isNaN(Date.parse(item))) back to the caller.
    return values.every((item) => typeof item === 'string' && !Number.isNaN(Date.parse(item)))
  }
  // Check whether type === 'Boolean' before running this branch.
  if (type === 'Boolean') return ['eq', 'ne', 'in', 'notIn'].includes(operator) && values.every((item) => typeof item === 'boolean')
  // Check whether ['Int', 'Float', 'BigInt', 'Decimal'].includes(type) before running this branch.
  if (['Int', 'Float', 'BigInt', 'Decimal'].includes(type)) {
    // Pass values.every( (item) => typeof item === 'number' && Number.isFinite(item) && (!['Int', 'BigInt'].inc back to the caller.
    return values.every(
      (item) =>
        typeof item === 'number' &&
        Number.isFinite(item) &&
        (!['Int', 'BigInt'].includes(type) || Number.isInteger(item))
    )
  }
  // Pass false back to the caller.
  return false
}

// Define the helper that will assert only keys.
function assertOnlyKeys(record: Record<string, unknown>, allowed: string[]): void {
  // Check whether Object.keys(record).some((key) => !allowed.includes(key)) before running this branch.
  if (Object.keys(record).some((key) => !allowed.includes(key))) {
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error('Query plan contains an unsupported property')
  }
}

// Define studentSources for the steps below.
const studentSources: readonly AnalyticsSource[] = ['enrollments', 'memberships', 'choices']

// Define the helper that will validate query plan.
export function validateQueryPlan(plan: unknown) {
  // Check whether isRecord(plan) && Object.hasOwn(plan, 'source') before running this branch.
  if (isRecord(plan) && Object.hasOwn(plan, 'source')) return validateAnalyticsQuery(plan)
  // Check whether !isRecord(plan) before running this branch.
  if (!isRecord(plan)) throw new Error('Invalid query plan')
  // Define filters for the steps below.
  const filters = plan.filters
  // Check whether !isRecord(filters) before running this branch.
  if (!isRecord(filters)) throw new Error('Invalid filters')

  // Check whether plan.entity === 'enrollments' && plan.operation === 'count' before running this branch.
  if (plan.entity === 'enrollments' && plan.operation === 'count') {
    // Check whether !['major', 'year', 'none'].includes(plan.groupBy as string) before running this branch.
    if (!['major', 'year', 'none'].includes(plan.groupBy as string))
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('Unsupported grouping')
    // Check whether Object.keys(filters).some((key) => !['semester', 'major', 'year'].includes(key)) before running this branch.
    if (Object.keys(filters).some((key) => !['semester', 'major', 'year'].includes(key)))
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('Unsupported enrollment filter')
    // Check whether typeof filters.semester !== 'string' || !semesterPattern.test(filters.semester) before running this branch.
    if (typeof filters.semester !== 'string' || !semesterPattern.test(filters.semester))
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('Invalid semester')
    // Check whether filters.major !== undefined && (typeof filters.major !== 'string' || !filters.major.trim() || filter before running this branch.
    if (
      filters.major !== undefined &&
      (typeof filters.major !== 'string' || !filters.major.trim() || filters.major.length > 100)
    )
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('Invalid major')
    // Check whether filters.year !== undefined && !studentYears.includes(filters.year as (typeof studentYears)[number]) before running this branch.
    if (
      filters.year !== undefined &&
      !studentYears.includes(filters.year as (typeof studentYears)[number])
    )
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('Invalid student year')
    // Define chartType for the steps below.
    const chartType = plan.chartType === undefined ? undefined : validateChartType(plan.chartType)
    // Check whether chartType && (plan.groupBy === 'none' || chartType === 'table') before running this branch.
    if (chartType && (plan.groupBy === 'none' || chartType === 'table')) {
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('Enrollment charts require a grouping and a chart type')
    }
    // Pass { entity: 'enrollments' as const, operation: 'count' as const, groupBy: plan.groupBy as 'major' | 'y back to the caller.
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

  // Check whether plan.entity === 'projects' && (plan.operation === 'search' || plan.operation === 'count') before running this branch.
  if (plan.entity === 'projects' && (plan.operation === 'search' || plan.operation === 'count')) {
    // Check whether Object.keys(filters).some((key) => !['semester', 'keyword', 'type', 'status'].includes(key)) before running this branch.
    if (
      Object.keys(filters).some((key) => !['semester', 'keyword', 'type', 'status'].includes(key))
    )
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('Unsupported project filter')
    // Check whether filters.semester !== undefined && (typeof filters.semester !== 'string' || !semesterPattern.test(fil before running this branch.
    if (
      filters.semester !== undefined &&
      (typeof filters.semester !== 'string' || !semesterPattern.test(filters.semester))
    )
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('Invalid semester')
    // Check whether filters.keyword !== undefined && (typeof filters.keyword !== 'string' || !filters.keyword.trim() ||  before running this branch.
    if (
      filters.keyword !== undefined &&
      (typeof filters.keyword !== 'string' ||
        !filters.keyword.trim() ||
        filters.keyword.length > 100)
    )
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('Invalid keyword')
    // Check whether filters.type !== undefined && !projectTypes.includes(filters.type as (typeof projectTypes)[number]) before running this branch.
    if (
      filters.type !== undefined &&
      !projectTypes.includes(filters.type as (typeof projectTypes)[number])
    )
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('Invalid project type')
    // Check whether filters.status !== undefined && !projectStatuses.includes(filters.status as (typeof projectStatuses) before running this branch.
    if (
      filters.status !== undefined &&
      !projectStatuses.includes(filters.status as (typeof projectStatuses)[number])
    )
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('Invalid project status')
    // Check whether plan.groupBy !== 'none' && plan.groupBy !== undefined before running this branch.
    if (plan.groupBy !== 'none' && plan.groupBy !== undefined)
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('Unsupported project grouping')
    // Check whether plan.chartType !== undefined before running this branch.
    if (plan.chartType !== undefined) throw new Error('Charts are not supported for project lists')
    // Pass { entity: 'projects' as const, operation: plan.operation as 'search' | 'count', groupBy: 'none' as c back to the caller.
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
  // Stop this operation and tell the caller why it cannot continue.
  throw new Error('Unsupported query')
}

// Define the helper that will validate analytics query.
export function validateAnalyticsQuery(input: unknown): AnalyticsQuery {
  // Check whether !isRecord(input) before running this branch.
  if (!isRecord(input)) throw new Error('Invalid analytical query')
  // Check whether typeof input.source !== 'string' || !Object.hasOwn(analyticsSchema, input.source) before running this branch.
  if (typeof input.source !== 'string' || !Object.hasOwn(analyticsSchema, input.source))
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error('Unsupported analytical source')
  // Define source for the steps below.
  const source = input.source as AnalyticsSource
  // Check whether studentSources.includes(source) before running this branch.
  if (studentSources.includes(source))
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error('Student analytics require the protected enrollment query path')
  // Define schema for the steps below.
  const schema = analyticsSchema[source] as Record<string, string | readonly string[]>
  // Check whether !Array.isArray(input.filters) || !Array.isArray(input.dimensions) || !Array.isArray(input.metrics) before running this branch.
  if (
    !Array.isArray(input.filters) ||
    !Array.isArray(input.dimensions) ||
    !Array.isArray(input.metrics)
  )
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error('Invalid analytical query structure')
  // Check whether input.filters.length > 10 || input.dimensions.length > 3 || input.metrics.length < 1 || input.metric before running this branch.
  if (
    input.filters.length > 10 ||
    input.dimensions.length > 3 ||
    input.metrics.length < 1 ||
    input.metrics.length > 3
  )
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error('Analytical query exceeds limits')
  // Check whether Object.keys(input).some( (key) => !['source', 'filters', 'dimensions', 'metrics', 'chartType'].inclu before running this branch.
  if (
    Object.keys(input).some(
      (key) => !['source', 'filters', 'dimensions', 'metrics', 'chartType'].includes(key)
    )
  )
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error('Unsupported analytical query property')

  // Define chartType for the steps below.
  const chartType = input.chartType === undefined ? undefined : validateChartType(input.chartType)

  // Define filters for the steps below.
  const filters: AnalyticsFilter[] = []
  // Define seenFilters for the steps below.
  const seenFilters = new Set<string>()
  // Repeat the following steps for each item in input.filters.
  for (const value of input.filters) {
    // Check whether !isRecord(value) || typeof value.field !== 'string' || !(value.field in schema) || !['eq', 'in'].inc before running this branch.
    if (
      !isRecord(value) ||
      typeof value.field !== 'string' ||
      !(value.field in schema) ||
      !['eq', 'in'].includes(value.operator as string)
    )
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('Unsupported analytical filter')
    // Check whether seenFilters.has(value.field) before running this branch.
    if (seenFilters.has(value.field)) throw new Error('Duplicate analytical filter field')
    // Call seenFilters.add to run this step.
    seenFilters.add(value.field)
    // Define values for the steps below.
    const values = Array.isArray(value.value) ? value.value : [value.value]
    // Check whether (value.operator === 'eq' && Array.isArray(value.value)) || (value.operator === 'in' && (!Array.isArr before running this branch.
    if (
      (value.operator === 'eq' && Array.isArray(value.value)) ||
      (value.operator === 'in' &&
        (!Array.isArray(value.value) || value.value.length < 1 || value.value.length > 20))
    )
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('Invalid analytical filter value')
    // Define expected for the steps below.
    const expected = schema[value.field]
    // Repeat the following steps for each item in values.
    for (const item of values) {
      // Check whether Array.isArray(expected) before running this branch.
      if (Array.isArray(expected)) {
        // Check whether typeof item !== 'string' || !expected.includes(item) before running this branch.
        if (typeof item !== 'string' || !expected.includes(item))
          // Stop this operation and tell the caller why it cannot continue.
          throw new Error('Invalid enum filter value')
      } else if (expected === 'number') {
        // Check whether typeof item !== 'number' || !Number.isInteger(item) before running this branch.
        if (typeof item !== 'number' || !Number.isInteger(item))
          // Stop this operation and tell the caller why it cannot continue.
          throw new Error('Expected an integer filter value')
      } else if (expected === 'boolean') {
        // Check whether typeof item !== 'boolean' before running this branch.
        if (typeof item !== 'boolean') throw new Error('Expected a boolean filter value')
      } else if (typeof item !== 'string' || !item.trim() || item.length > 100)
        // Stop this operation and tell the caller why it cannot continue.
        throw new Error('Invalid string filter value')
    }
    // Check whether (source === 'projects' && value.field === 'teams.semester.year') || (source === 'partners' && value. before running this branch.
    if (
      (source === 'projects' && value.field === 'teams.semester.year') ||
      (source === 'partners' && value.field === 'projects.teams.semester.year') ||
      (source === 'teams' && value.field === 'semester.year') ||
      (source === 'semesters' && value.field === 'year')
    ) {
      // Check whether values.some((item) => typeof item !== 'number' || item < 2000 || item > 2099) before running this branch.
      if (values.some((item) => typeof item !== 'number' || item < 2000 || item > 2099))
        // Stop this operation and tell the caller why it cannot continue.
        throw new Error('Invalid academic year')
    }
    // Call filters.push to run this step.
    filters.push({
      field: value.field,
      operator: value.operator as 'eq' | 'in',
      value: value.value as AnalyticsFilter['value'],
    })
  }

  // Define dimensions for the steps below.
  const dimensions: string[] = []
  // Repeat the following steps for each item in input.dimensions.
  for (const dimension of input.dimensions) {
    // Check whether typeof dimension !== 'string' || !(dimension in schema) || dimensions.includes(dimension) before running this branch.
    if (typeof dimension !== 'string' || !(dimension in schema) || dimensions.includes(dimension))
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('Unsupported analytical dimension')
    // Call dimensions.push to run this step.
    dimensions.push(dimension)
  }

  // Define metrics for the steps below.
  const metrics: AnalyticsMetric[] = []
  // Define aliases for the steps below.
  const aliases = new Set<string>()
  // Repeat the following steps for each item in input.metrics.
  for (const value of input.metrics) {
    // Check whether !isRecord(value) || !['count', 'countDistinct'].includes(value.function as string) || typeof value.a before running this branch.
    if (
      !isRecord(value) ||
      !['count', 'countDistinct'].includes(value.function as string) ||
      typeof value.alias !== 'string' ||
      !/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(value.alias) ||
      aliases.has(value.alias)
    )
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('Unsupported analytical metric')
    // Check whether value.field !== undefined && (typeof value.field !== 'string' || !(value.field in schema)) before running this branch.
    if (value.field !== undefined && (typeof value.field !== 'string' || !(value.field in schema)))
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('Unsupported metric field')
    // Check whether value.function === 'countDistinct' && value.field === undefined before running this branch.
    if (value.function === 'countDistinct' && value.field === undefined)
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('countDistinct requires an approved field')
    // Check whether value.function === 'count' && value.field !== undefined before running this branch.
    if (value.function === 'count' && value.field !== undefined)
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('count does not accept a field')
    // Call aliases.add to run this step.
    aliases.add(value.alias)
    // Call metrics.push to run this step.
    metrics.push({
      function: value.function as 'count' | 'countDistinct',
      ...(typeof value.field === 'string' ? { field: value.field } : {}),
      alias: value.alias,
    })
  }

  // Use ['line', 'area', 'radar', 'stackedBar'].includes to initialize supportsMultipleMetrics.
  const supportsMultipleMetrics = ['line', 'area', 'radar', 'stackedBar'].includes(chartType ?? '')
  // Define validSankeyShape for the steps below.
  const validSankeyShape = chartType === 'sankey' && dimensions.length === 2 && metrics.length === 1
  // Check whether chartType !== undefined && chartType !== 'table' && (!validSankeyShape && (dimensions.length !== 1 | before running this branch.
  if (
    chartType !== undefined &&
    chartType !== 'table' &&
    (!validSankeyShape && (dimensions.length !== 1 || (!supportsMultipleMetrics && metrics.length !== 1)))
  ) {
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error('Chart plans require one dimension and a compatible metric count')
  }

  // Check whether studentSources.includes(source) before running this branch.
  if (studentSources.includes(source)) {
    // Check whether metrics.some((metric) => metric.function !== 'count' || metric.field !== undefined) before running this branch.
    if (metrics.some((metric) => metric.function !== 'count' || metric.field !== undefined))
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('Student-related queries must use aggregate row counts')
    // Check whether dimensions.length > 1 || filters.length > 1 || (dimensions.length && filters.length && dimensions[0] before running this branch.
    if (
      dimensions.length > 1 ||
      filters.length > 1 ||
      (dimensions.length && filters.length && dimensions[0] === filters[0]?.field)
    )
      // Stop this operation and tell the caller why it cannot continue.
      throw new Error('Student-related query risks overlapping-filter inference')
  }
  // Pass { source, filters, dimensions, metrics, ...(chartType ? { chartType } : {}) } back to the caller.
  return { source, filters, dimensions, metrics, ...(chartType ? { chartType } : {}) }
}

// Define the helper that will validate chart type.
export function validateChartType(value: unknown): AIChartType {
  // Check whether typeof value !== 'string' before running this branch.
  if (typeof value !== 'string') {
    // Stop this operation and tell the caller why it cannot continue.
    throw new Error('Unsupported chart type')
  }
  // Use value.trim().toLowerCase().replace to initialize normalized.
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, '')
  // Define chartTypes for the steps below.
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
  // Define chartType for the steps below.
  const chartType = chartTypes[normalized]
  // Check whether !chartType before running this branch.
  if (!chartType) throw new Error('Unsupported chart type')
  // Pass chartType back to the caller.
  return chartType
}

// Define the helper that will is record.
function isRecord(value: unknown): value is Record<string, any> {
  // Pass typeof value === 'object' && value !== null && !Array.isArray(value) back to the caller.
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
