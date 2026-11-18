export type V1Status =
  | 'answer'
  | 'no_data'
  | 'privacy_restricted'
  | 'clarification_needed'
  | 'unsupported_capability'
  | 'execution_error'

export type V1Column = {
  key: string
  label: string
  type: string
  role: 'field' | 'dimension' | 'metric' | 'calculation'
}

export type V1Result = {
  version: 1
  model: 'Project' | 'Partner' | 'Team' | 'Semester'
  kind: 'records' | 'aggregate'
  columns: V1Column[]
  rows: Array<{ key: string; values: Record<string, unknown> }>
  scannedRootRows: number
  complete: boolean
  hasMore: boolean
  limit: number
  empty: boolean
}

export type V1Presentation = {
  status: V1Status
  explanation: string
  result?: V1Result
  summary?: { label: string; value: number }
  chart?: {
    type: Exclude<AIChartType, 'table' | 'scatter' | 'bubble'>
    labels: string[]
    series: Array<{ label: string; values: number[] }>
  }
  sankey?: SankeyPresentation
}

export type SankeyPresentation = {
  sourceLabel: string
  targetLabel: string
  valueLabel: string
  links: Array<{ source: string; target: string; value: number }>
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

export type LegacyAIResponse = {
  success: boolean
  plan: {
    operation: string
    source?: string
    entity?: string
    groupBy?: string
    dimensions?: string[]
    metrics?: Array<{ function: 'count' | 'countDistinct'; field?: string; alias: string }>
    chartType?: AIChartType
  }
  data?: {
    semester?: string
    count?: number | null
    [key: string]: unknown
    results?: Array<Record<string, unknown>>
  }
}

const validStatuses: V1Status[] = [
  'answer', 'no_data', 'privacy_restricted', 'clarification_needed',
  'unsupported_capability', 'execution_error',
]
const validChartTypes: AIChartType[] = [
  'bar', 'line', 'area', 'pie', 'doughnut', 'polarArea', 'radar',
  'scatter', 'bubble', 'horizontalBar', 'stackedBar', 'table',
  'sankey',
]
const allowedModels = ['Project', 'Partner', 'Team', 'Semester']
const numericTypes = ['Int', 'Float', 'BigInt', 'Decimal']

export function normalizeV1Response(input: unknown): V1Presentation | null {
  if (!isRecord(input)) return null
  const versioned = input.kind === 'v1' && input.apiVersion === 1
  const statusOnly = input.kind === undefined && input.success !== true &&
    validStatuses.includes(input.status as V1Status) && typeof input.explanation === 'string'
  if (!versioned && !statusOnly) return null
  if (!validStatuses.includes(input.status as V1Status) || typeof input.explanation !== 'string') {
    return {
      status: 'execution_error',
      explanation: 'The AI search returned an invalid response. Please try again.',
    }
  }

  const presentation: V1Presentation = {
    status: input.status as V1Status,
    explanation: input.explanation,
  }
  const result = normalizeResult(input.result)
  if (result) {
    presentation.result = result
    const plan = isRecord(input.plan) ? input.plan : {}
    presentation.summary = getScalarSummary(result)
    presentation.chart = getChart(result, plan.chartType)
    presentation.sankey = getSankey(result, plan.chartType)
  } else if (input.result !== undefined) {
    return {
      status: 'execution_error',
      explanation: 'The AI search returned results in an unsupported format. Please try again.',
    }
  }
  return presentation
}

export function isLegacyAIResponse(input: unknown): input is LegacyAIResponse {
  return (
    isRecord(input) && input.success === true && isRecord(input.plan) &&
    typeof input.plan.operation === 'string'
  )
}

export function supportsCategoricalChart(
  type: string | undefined,
  dimensionCount: number,
  metricCount: number
): boolean {
  const selected = type ?? 'bar'
  if (!validChartTypes.includes(selected as AIChartType) || selected === 'table' || selected === 'sankey') return false
  if (dimensionCount !== 1 || metricCount < 1 || selected === 'scatter' || selected === 'bubble') return false
  if (['pie', 'doughnut', 'polarArea'].includes(selected) && metricCount !== 1) return false
  return metricCount === 1 || ['bar', 'horizontalBar', 'line', 'area', 'radar', 'stackedBar'].includes(selected)
}

export type LegacyEnrollmentChart = {
  type: Exclude<AIChartType, 'table' | 'scatter' | 'bubble'>
  labels: string[]
  values: number[]
}

export function buildLegacyEnrollmentChart(
  rows: Array<{ label: string; count: number }>,
  requestedType?: AIChartType
): LegacyEnrollmentChart | undefined {
  const type = requestedType ?? 'bar'
  if (!rows.length || !supportsCategoricalChart(type, 1, 1)) return
  if (rows.some((row) => typeof row.label !== 'string' || !Number.isFinite(row.count))) return
  if (['pie', 'doughnut', 'polarArea'].includes(type) && rows.some((row) => row.count < 0)) return
  return {
    type: type as LegacyEnrollmentChart['type'],
    labels: rows.map((row) => row.label),
    values: rows.map((row) => row.count),
  }
}

export function legacyAnalyticsView(
  dimensionCount: number,
  metricCount: number,
  chartType?: AIChartType
): 'summary' | 'table' | AIChartType {
  if (dimensionCount === 0 && metricCount === 1) return 'summary'
  if (chartType === 'table') return 'table'
  const singleSeries = dimensionCount === 1 && metricCount === 1
  if (chartType && !supportsCategoricalChart(chartType, dimensionCount, metricCount)) return 'table'
  if (singleSeries) return chartType ?? 'bar'
  return 'table'
}

export function humanizeV1Label(column: V1Column): string {
  const known: Record<string, string> = {
    id: 'ID',
    name: 'Name',
    description: 'Description',
    type: 'Project Type',
    status: 'Project Status',
    repoURL: 'Repository URL',
    year: 'Academic Year',
    season: 'Semester',
    meetingDay: 'Meeting Day',
  }
  if (column.role === 'metric' || column.role === 'calculation') {
    return titleCase(column.label || column.key)
  }
  const leaf = column.key.split('.').at(-1) ?? column.key
  if (known[leaf]) return known[leaf]!
  return titleCase(column.label || column.key.replaceAll('.', ' '))
}

export function formatV1Value(column: V1Column, value: unknown): string {
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString() : '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value !== 'string') return value === null ? '—' : String(value)
  const enumLabels: Record<string, string> = {
    SOFTWARE: 'Software', HARDWARE: 'Hardware', BOTH: 'Both',
    NEW: 'New', RETURNING: 'Returning', COMPLETE: 'Complete', WITHDRAWN: 'Withdrawn', HOLD: 'On hold',
    SPRING: 'Spring', SUMMER: 'Summer', FALL: 'Fall',
    WEDNESDAY: 'Wednesday', THURSDAY: 'Thursday',
  }
  return enumLabels[value] ?? value
}

function normalizeResult(value: unknown): V1Result | undefined {
  if (!isRecord(value) || value.version !== 1 || !allowedModels.includes(String(value.model))) return
  if (value.kind !== 'records' && value.kind !== 'aggregate') return
  if (!Array.isArray(value.columns) || !Array.isArray(value.rows)) return
  if (
    typeof value.limit !== 'number' || value.limit < 1 || value.limit > 100 ||
    value.rows.length > value.limit || typeof value.complete !== 'boolean' ||
    typeof value.hasMore !== 'boolean' || typeof value.empty !== 'boolean' ||
    typeof value.scannedRootRows !== 'number'
  ) return
  const columns: V1Column[] = []
  for (const column of value.columns) {
    if (
      !isRecord(column) || typeof column.key !== 'string' || typeof column.label !== 'string' ||
      typeof column.type !== 'string' ||
      !['field', 'dimension', 'metric', 'calculation'].includes(String(column.role))
    ) return
    columns.push(column as V1Column)
  }
  const rows: V1Result['rows'] = []
  for (const row of value.rows) {
    if (!isRecord(row) || typeof row.key !== 'string' || !isRecord(row.values)) return
    if (Object.keys(row.values).some((key) => !columns.some((column) => column.key === key))) return
    rows.push({ key: row.key, values: row.values })
  }
  return {
    version: 1,
    model: value.model as V1Result['model'],
    kind: value.kind,
    columns,
    rows,
    scannedRootRows: value.scannedRootRows,
    complete: value.complete,
    hasMore: value.hasMore,
    limit: value.limit,
    empty: value.empty,
  }
}

function getScalarSummary(result: V1Result): V1Presentation['summary'] {
  if (result.kind !== 'aggregate' || result.columns.length !== 1 || result.rows.length !== 1) return
  const column = result.columns[0]
  const value = result.rows[0]?.values[column?.key ?? '']
  if (!column || !numericTypes.includes(column.type) || typeof value !== 'number' || !Number.isFinite(value)) return
  return { label: humanizeV1Label(column), value }
}

function getChart(result: V1Result, requested: unknown): V1Presentation['chart'] {
  if (result.kind !== 'aggregate' || result.rows.length === 0) return
  const dimensions = result.columns.filter((column) => column.role === 'dimension')
  const metrics = result.columns.filter((column) =>
    (column.role === 'metric' || column.role === 'calculation') && numericTypes.includes(column.type)
  )
  if (!supportsCategoricalChart(typeof requested === 'string' ? requested : undefined, dimensions.length, metrics.length)) return
  const type = typeof requested === 'string' && validChartTypes.includes(requested as AIChartType)
    ? requested as AIChartType
    : 'bar'
  const dimension = dimensions[0]!
  const labels: string[] = []
  for (const row of result.rows) {
    const value = row.values[dimension.key]
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return
    labels.push(formatV1Value(dimension, value))
  }
  const series = metrics.map((metric) => {
    const values = result.rows.map((row) => row.values[metric.key])
    if (values.some((value) => typeof value !== 'number' || !Number.isFinite(value))) return null
    const numeric = values as number[]
    if (['pie', 'doughnut', 'polarArea'].includes(type) && numeric.some((value) => value < 0)) return null
    return { label: humanizeV1Label(metric), values: numeric }
  })
  if (series.some((entry) => entry === null)) return
  return { type, labels, series: series as Array<{ label: string; values: number[] }> }
}

function getSankey(result: V1Result, requested: unknown): SankeyPresentation | undefined {
  if (requested !== 'sankey' || result.kind !== 'aggregate') return
  const dimensions = result.columns.filter((column) => column.role === 'dimension')
  const measures = result.columns.filter((column) =>
    (column.role === 'metric' || column.role === 'calculation') && numericTypes.includes(column.type)
  )
  if (dimensions.length !== 2 || measures.length !== 1 || result.rows.length === 0) return
  const [sourceColumn, targetColumn] = dimensions
  const measure = measures[0]
  if (!sourceColumn || !targetColumn || !measure) return

  const links = new Map<string, { source: string; target: string; value: number }>()
  for (const row of result.rows) {
    const sourceValue = row.values[sourceColumn.key]
    const targetValue = row.values[targetColumn.key]
    const value = row.values[measure.key]
    if (
      (typeof sourceValue !== 'string' && typeof sourceValue !== 'number' && typeof sourceValue !== 'boolean') ||
      (typeof targetValue !== 'string' && typeof targetValue !== 'number' && typeof targetValue !== 'boolean') ||
      typeof value !== 'number' || !Number.isFinite(value) || value < 0
    ) return
    if (value === 0) continue
    const source = formatV1Value(sourceColumn, sourceValue)
    const target = formatV1Value(targetColumn, targetValue)
    const key = JSON.stringify([source, target])
    const existing = links.get(key)
    links.set(key, { source, target, value: (existing?.value ?? 0) + value })
  }
  if (links.size === 0) return
  return {
    sourceLabel: humanizeV1Label(sourceColumn),
    targetLabel: humanizeV1Label(targetColumn),
    valueLabel: humanizeV1Label(measure),
    links: [...links.values()],
  }
}

function titleCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
