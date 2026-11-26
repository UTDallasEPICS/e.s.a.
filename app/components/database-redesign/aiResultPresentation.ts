/**
 * Purpose
 * Provide the ai result presentation logic used by other parts of ESA.
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
  tableOnly?: boolean
  unit?: 'percent'
}

export type V1Result = {
  version: 1
  model:
    | 'Project'
    | 'Partner'
    | 'Team'
    | 'Semester'
    | 'Enrollment'
    | 'Assignment'
    | 'Preference'
    | 'Contact'
    | 'Mentor'
  kind: 'records' | 'aggregate'
  columns: V1Column[]
  rows: Array<{
    key: string
    values: Record<string, unknown>
    references?: Array<{
      field: string
      type: 'student' | 'project' | 'partner' | 'external'
      id: string
      label: string
      semesterId?: string
      url?: string
    }>
  }>
  offset?: number
  totalRows?: number
  scannedRootRows: number
  complete: boolean
  hasMore: boolean
  limit: number
  empty: boolean
}

export type V1Presentation = {
  status: V1Status
  explanation: string
  durationMs?: number
  suggestions?: string[]
  axisLabels?: {
    x?: string
    y?: string
    xMin?: number
    xMax?: number
    yMin?: number
    yMax?: number
  }
  result?: V1Result
  summary?: { label: string; value: number; unit?: 'percent' }
  chart?: {
    type: Exclude<AIChartType, 'table' | 'scatter' | 'bubble'>
    labels: string[]
    series: Array<{ label: string; values: number[] }>
  }
  plot?: {
    type: 'scatter' | 'bubble'
    xLabel: string
    yLabel: string
    points: Array<{ x: number; y: number; r?: number; label: string }>
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

// Define validStatuses for the steps below.
const validStatuses: V1Status[] = [
  'answer',
  'no_data',
  'privacy_restricted',
  'clarification_needed',
  'unsupported_capability',
  'execution_error',
]
// Define validChartTypes for the steps below.
const validChartTypes: AIChartType[] = [
  'bar',
  'line',
  'area',
  'pie',
  'doughnut',
  'polarArea',
  'radar',
  'scatter',
  'bubble',
  'horizontalBar',
  'stackedBar',
  'table',
  'sankey',
]
// Define allowedModels for the steps below.
const allowedModels = [
  'Project',
  'Partner',
  'Team',
  'Semester',
  'Enrollment',
  'Assignment',
  'Preference',
  'Contact',
  'Mentor',
]
// Define numericTypes for the steps below.
const numericTypes = ['Int', 'Float', 'BigInt', 'Decimal']

// Define the helper that will normalize v1 response.
export function normalizeV1Response(input: unknown): V1Presentation | null {
  // Check whether !isRecord(input) before running this branch.
  if (!isRecord(input)) return null
  // Define versioned for the steps below.
  const versioned = input.kind === 'v1' && input.apiVersion === 1
  // Define statusOnly for the steps below.
  const statusOnly =
    input.kind === undefined &&
    input.success !== true &&
    validStatuses.includes(input.status as V1Status) &&
    typeof input.explanation === 'string'
  // Check whether !versioned && !statusOnly before running this branch.
  if (!versioned && !statusOnly) return null
  // Check whether !validStatuses.includes(input.status as V1Status) || typeof input.explanation !== 'string' before running this branch.
  if (!validStatuses.includes(input.status as V1Status) || typeof input.explanation !== 'string') {
    // Pass { status: 'execution_error', explanation: 'The AI search returned an invalid response. Please try ag back to the caller.
    return {
      status: 'execution_error',
      explanation: 'The AI search returned an invalid response. Please try again.',
    }
  }

  // Define presentation for the steps below.
  const presentation: V1Presentation = {
    status: input.status as V1Status,
    explanation: input.explanation,
    durationMs: typeof input.durationMs === 'number' ? input.durationMs : undefined,
    suggestions: Array.isArray(input.suggestions)
      ? input.suggestions
          .filter((s: unknown) => typeof s === 'string' && s.length <= 500)
          .slice(0, 3)
      : undefined,
  }
  // Use normalizeResult to initialize result.
  const result = normalizeResult(input.result)
  // Check whether result before running this branch.
  if (result) {
    // Update presentation.result with the value on the right.
    presentation.result = result
    // Define plan for the steps below.
    const plan = isRecord(input.plan) ? input.plan : {}
    // Check whether isRecord(plan.axes) before running this branch.
    if (isRecord(plan.axes))
      // Update presentation.axisLabels with the value on the right.
      presentation.axisLabels = {
        x: typeof plan.axes.xLabel === 'string' ? plan.axes.xLabel.slice(0, 80) : undefined,
        y: typeof plan.axes.yLabel === 'string' ? plan.axes.yLabel.slice(0, 80) : undefined,
        ...Object.fromEntries(
          ['xMin', 'xMax', 'yMin', 'yMax']
            .filter((key) => typeof plan.axes[key] === 'number' && Number.isFinite(plan.axes[key]))
            .map((key) => [key, plan.axes[key]])
        ),
      }
    // Update presentation.summary with the value on the right.
    presentation.summary = getScalarSummary(result)
    // Update presentation.chart with the value on the right.
    presentation.chart = getChart(result, plan.chartType)
    // Update presentation.sankey with the value on the right.
    presentation.sankey = getSankey(result, plan.chartType)
    // Update presentation.plot with the value on the right.
    presentation.plot = getNumericPlot(result, plan.chartType)
  } else if (input.result !== undefined) {
    // Pass { status: 'execution_error', explanation: 'The AI search returned results in an unsupported format.  back to the caller.
    return {
      status: 'execution_error',
      explanation: 'The AI search returned results in an unsupported format. Please try again.',
    }
  }
  // Pass presentation back to the caller.
  return presentation
}

// Define the helper that will is legacy airesponse.
export function isLegacyAIResponse(input: unknown): input is LegacyAIResponse {
  // Pass ( isRecord(input) && input.success === true && isRecord(input.plan) && typeof input.plan.operation = back to the caller.
  return (
    isRecord(input) &&
    input.success === true &&
    isRecord(input.plan) &&
    typeof input.plan.operation === 'string'
  )
}

// Define the helper that will supports categorical chart.
export function supportsCategoricalChart(
  type: string | undefined,
  dimensionCount: number,
  metricCount: number
): boolean {
  // Define selected for the steps below.
  const selected = type ?? 'bar'
  // Check whether !validChartTypes.includes(selected as AIChartType) || selected === 'table' || selected === 'sankey' before running this branch.
  if (
    !validChartTypes.includes(selected as AIChartType) ||
    selected === 'table' ||
    selected === 'sankey'
  )
    // Pass false back to the caller.
    return false
  // Check whether dimensionCount !== 1 || metricCount < 1 || selected === 'scatter' || selected === 'bubble' before running this branch.
  if (dimensionCount !== 1 || metricCount < 1 || selected === 'scatter' || selected === 'bubble')
    // Pass false back to the caller.
    return false
  // Check whether ['pie', 'doughnut', 'polarArea'].includes(selected) && metricCount !== 1 before running this branch.
  if (['pie', 'doughnut', 'polarArea'].includes(selected) && metricCount !== 1) return false
  // Pass ( metricCount === 1 || ['bar', 'horizontalBar', 'line', 'area', 'radar', 'stackedBar'].includes(sele back to the caller.
  return (
    metricCount === 1 ||
    ['bar', 'horizontalBar', 'line', 'area', 'radar', 'stackedBar'].includes(selected)
  )
}

export type LegacyEnrollmentChart = {
  type: Exclude<AIChartType, 'table' | 'scatter' | 'bubble'>
  labels: string[]
  values: number[]
}

// Define the helper that will build legacy enrollment chart.
export function buildLegacyEnrollmentChart(
  rows: Array<{ label: string; count: number }>,
  requestedType?: AIChartType
): LegacyEnrollmentChart | undefined {
  // Define type for the steps below.
  const type = requestedType ?? 'bar'
  // Check whether !rows.length || !supportsCategoricalChart(type, 1, 1) before running this branch.
  if (!rows.length || !supportsCategoricalChart(type, 1, 1)) return
  // Check whether rows.some((row) => typeof row.label !== 'string' || !Number.isFinite(row.count)) before running this branch.
  if (rows.some((row) => typeof row.label !== 'string' || !Number.isFinite(row.count))) return
  // Check whether ['pie', 'doughnut', 'polarArea'].includes(type) && rows.some((row) => row.count < 0) before running this branch.
  if (['pie', 'doughnut', 'polarArea'].includes(type) && rows.some((row) => row.count < 0)) return
  // Pass { type: type as LegacyEnrollmentChart['type'], labels: rows.map((row) => row.label), values: rows.ma back to the caller.
  return {
    type: type as LegacyEnrollmentChart['type'],
    labels: rows.map((row) => row.label),
    values: rows.map((row) => row.count),
  }
}

// Define the helper that will legacy analytics view.
export function legacyAnalyticsView(
  dimensionCount: number,
  metricCount: number,
  chartType?: AIChartType
): 'summary' | 'table' | AIChartType {
  // Check whether dimensionCount === 0 && metricCount === 1 before running this branch.
  if (dimensionCount === 0 && metricCount === 1) return 'summary'
  // Check whether chartType === 'table' before running this branch.
  if (chartType === 'table') return 'table'
  // Define singleSeries for the steps below.
  const singleSeries = dimensionCount === 1 && metricCount === 1
  // Check whether chartType && !supportsCategoricalChart(chartType, dimensionCount, metricCount) before running this branch.
  if (chartType && !supportsCategoricalChart(chartType, dimensionCount, metricCount)) return 'table'
  // Check whether singleSeries before running this branch.
  if (singleSeries) return chartType ?? 'bar'
  // Pass 'table' back to the caller.
  return 'table'
}

// Define the helper that will humanize v1 label.
export function humanizeV1Label(column: V1Column): string {
  // Define known for the steps below.
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
  // Check whether column.role === 'metric' || column.role === 'calculation' before running this branch.
  if (column.role === 'metric' || column.role === 'calculation') {
    // Pass titleCase(column.label || column.key) back to the caller.
    return titleCase(column.label || column.key)
  }
  // Define leaf for the steps below.
  const leaf = column.key.split('.').at(-1) ?? column.key
  // Check whether known[leaf] before running this branch.
  if (known[leaf]) return known[leaf]!
  // Pass titleCase(column.label || column.key.replaceAll('.', ' ')) back to the caller.
  return titleCase(column.label || column.key.replaceAll('.', ' '))
}

// Define the helper that will format v1 value.
export function formatV1Value(column: V1Column, value: unknown): string {
  // Check whether typeof value === 'number' before running this branch.
  if (typeof value === 'number')
    // Pass Number.isFinite(value) ? column.unit === 'percent' ? value.toLocaleString(undefined, { maximumFracti back to the caller.
    return Number.isFinite(value)
      ? column.unit === 'percent'
        ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) + '%'
        : value.toLocaleString()
      : '—'
  // Check whether typeof value === 'boolean' before running this branch.
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  // Check whether value === '' before running this branch.
  if (value === '') return 'Not supplied'
  // Check whether typeof value !== 'string' before running this branch.
  if (typeof value !== 'string') return value === null ? '—' : String(value)
  // Define enumLabels for the steps below.
  const enumLabels: Record<string, string> = {
    SOFTWARE: 'Software',
    HARDWARE: 'Hardware',
    BOTH: 'Both',
    UNKNOWN: 'Unknown',
    NEW: 'New',
    RETURNING: 'Returning',
    COMPLETE: 'Complete',
    WITHDRAWN: 'Withdrawn',
    HOLD: 'On hold',
    SPRING: 'Spring',
    SUMMER: 'Summer',
    FALL: 'Fall',
    WEDNESDAY: 'Wednesday',
    THURSDAY: 'Thursday',
  }
  // Pass enumLabels[value] ?? value back to the caller.
  return enumLabels[value] ?? value
}

// Define the helper that will normalize result.
function normalizeResult(value: unknown): V1Result | undefined {
  // Check whether !isRecord(value) || value.version !== 1 || !allowedModels.includes(String(value.model)) before running this branch.
  if (!isRecord(value) || value.version !== 1 || !allowedModels.includes(String(value.model)))
    return
  // Check whether value.kind !== 'records' && value.kind !== 'aggregate' before running this branch.
  if (value.kind !== 'records' && value.kind !== 'aggregate') return
  // Check whether !Array.isArray(value.columns) || !Array.isArray(value.rows) before running this branch.
  if (!Array.isArray(value.columns) || !Array.isArray(value.rows)) return
  // Check whether typeof value.limit !== 'number' || value.limit < 1 || value.limit > 1000 || value.rows.length > valu before running this branch.
  if (
    typeof value.limit !== 'number' ||
    value.limit < 1 ||
    value.limit > 1000 ||
    value.rows.length > value.limit ||
    typeof value.complete !== 'boolean' ||
    typeof value.hasMore !== 'boolean' ||
    typeof value.empty !== 'boolean' ||
    typeof value.scannedRootRows !== 'number'
  )
    return
  // Define columns for the steps below.
  const columns: V1Column[] = []
  // Repeat the following steps for each item in value.columns.
  for (const column of value.columns) {
    // Check whether !isRecord(column) || typeof column.key !== 'string' || typeof column.label !== 'string' || typeof co before running this branch.
    if (
      !isRecord(column) ||
      typeof column.key !== 'string' ||
      typeof column.label !== 'string' ||
      typeof column.type !== 'string' ||
      !['field', 'dimension', 'metric', 'calculation'].includes(String(column.role))
    )
      return
    // Call columns.push to run this step.
    columns.push(column as V1Column)
  }
  // Define rows for the steps below.
  const rows: V1Result['rows'] = []
  // Repeat the following steps for each item in value.rows.
  for (const row of value.rows) {
    // Check whether !isRecord(row) || typeof row.key !== 'string' || !isRecord(row.values) before running this branch.
    if (!isRecord(row) || typeof row.key !== 'string' || !isRecord(row.values)) return
    // Check whether Object.keys(row.values).some((key) => !columns.some((column) => column.key === key)) before running this branch.
    if (Object.keys(row.values).some((key) => !columns.some((column) => column.key === key))) return
    // Define references for the steps below.
    const references = Array.isArray(row.references)
      ? row.references.filter(
          (r: unknown) =>
            isRecord(r) &&
            typeof r.field === 'string' &&
            (['student', 'project', 'partner'].includes(r.type) ||
              (r.type === 'external' &&
                typeof r.url === 'string' &&
                /^(https?:\/\/|mailto:|tel:)/i.test(r.url))) &&
            typeof r.id === 'string' &&
            typeof r.label === 'string' &&
            (r.semesterId === undefined || typeof r.semesterId === 'string')
        )
      : undefined
    // Call rows.push to run this step.
    rows.push({ key: row.key, values: row.values, ...(references?.length ? { references } : {}) })
  }
  // Pass { version: 1, model: value.model as V1Result['model'], kind: value.kind, columns, rows, scannedRootR back to the caller.
  return {
    version: 1,
    model: value.model as V1Result['model'],
    kind: value.kind,
    columns,
    rows,
    scannedRootRows: value.scannedRootRows,
    offset: typeof value.offset === 'number' ? value.offset : undefined,
    totalRows: typeof value.totalRows === 'number' ? value.totalRows : undefined,
    complete: value.complete,
    hasMore: value.hasMore,
    limit: value.limit,
    empty: value.empty,
  }
}

// Define the helper that will get scalar summary.
function getScalarSummary(result: V1Result): V1Presentation['summary'] {
  // Check whether result.kind !== 'aggregate' || result.rows.length !== 1 || result.columns.some((c) => c.role === 'di before running this branch.
  if (
    result.kind !== 'aggregate' ||
    result.rows.length !== 1 ||
    result.columns.some((c) => c.role === 'dimension')
  )
    return
  // Use result.columns.filter to initialize calculations.
  const calculations = result.columns.filter((c) => c.role === 'calculation')
  // Define column for the steps below.
  const column =
    result.columns.length === 1
      ? result.columns[0]
      : calculations.length === 1
        ? calculations[0]
        : undefined
  // Define value for the steps below.
  const value = result.rows[0]?.values[column?.key ?? '']
  // Check whether !column || !numericTypes.includes(column.type) || typeof value !== 'number' || !Number.isFinite(valu before running this branch.
  if (
    !column ||
    !numericTypes.includes(column.type) ||
    typeof value !== 'number' ||
    !Number.isFinite(value)
  )
    return
  // Pass { label: humanizeV1Label(column), value, ...(column.unit ? { unit: column.unit } : {}) } back to the caller.
  return { label: humanizeV1Label(column), value, ...(column.unit ? { unit: column.unit } : {}) }
}

// Define the helper that will get chart.
function getChart(result: V1Result, requested: unknown): V1Presentation['chart'] {
  // Check whether result.kind !== 'aggregate' || result.rows.length === 0 before running this branch.
  if (result.kind !== 'aggregate' || result.rows.length === 0) return
  // Use result.columns.filter to initialize dimensions.
  const dimensions = result.columns.filter((column) => column.role === 'dimension')
  // Use result.columns.filter to initialize metrics.
  const metrics = result.columns.filter(
    (column) =>
      !column.tableOnly &&
      (column.role === 'metric' || column.role === 'calculation') &&
      numericTypes.includes(column.type)
  )
  // Check whether !supportsCategoricalChart( typeof requested === 'string' ? requested : undefined, dimensions.length, before running this branch.
  if (
    !supportsCategoricalChart(
      typeof requested === 'string' ? requested : undefined,
      dimensions.length,
      metrics.length
    )
  )
    return
  // Define type for the steps below.
  const type =
    typeof requested === 'string' && validChartTypes.includes(requested as AIChartType)
      ? (requested as AIChartType)
      : 'bar'
  // Define dimension for the steps below.
  const dimension = dimensions[0]!
  // Define labels for the steps below.
  const labels: string[] = []
  // Repeat the following steps for each item in result.rows.
  for (const row of result.rows) {
    // Define value for the steps below.
    const value = row.values[dimension.key]
    // Check whether typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean' before running this branch.
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return
    // Call labels.push to run this step.
    labels.push(formatV1Value(dimension, value))
  }
  // Use metrics.map to initialize series.
  const series = metrics.map((metric) => {
    // Use result.rows.map to initialize values.
    const values = result.rows.map((row) => row.values[metric.key])
    // Check whether values.some((value) => typeof value !== 'number' || !Number.isFinite(value)) before running this branch.
    if (values.some((value) => typeof value !== 'number' || !Number.isFinite(value))) return null
    // Define numeric for the steps below.
    const numeric = values as number[]
    // Check whether ['pie', 'doughnut', 'polarArea'].includes(type) && numeric.some((value) => value < 0) before running this branch.
    if (['pie', 'doughnut', 'polarArea'].includes(type) && numeric.some((value) => value < 0))
      // Pass null back to the caller.
      return null
    // Pass { label: humanizeV1Label(metric), values: numeric } back to the caller.
    return { label: humanizeV1Label(metric), values: numeric }
  })
  // Check whether series.some((entry) => entry === null) before running this branch.
  if (series.some((entry) => entry === null)) return
  // Check whether ['pie', 'doughnut', 'polarArea'].includes(type) && series.length === 1 && series[0] before running this branch.
  if (['pie', 'doughnut', 'polarArea'].includes(type) && series.length === 1 && series[0]) {
    // Use result.columns.find to initialize share.
    const share = result.columns.find((c) => c.tableOnly && c.key === '__share_' + metrics[0]!.key)
    // Define row for the steps below.
    const row = share && result.rows.find((r) => Number(r.values[share.key]) > 0)
    // Check whether share && row before running this branch.
    if (share && row) {
      // Define total for the steps below.
      const total = (Number(row.values[metrics[0]!.key]) / Number(row.values[share.key])) * 100
      // Use series[0].values.reduce to initialize visible.
      const visible = series[0].values.reduce((sum, value) => sum + value, 0)
      // Check whether total > visible + 1e-8 before running this branch.
      if (total > visible + 1e-8) {
        // Call labels.push to run this step.
        labels.push('Other matching groups')
        // Call series[0].values.push to run this step.
        series[0].values.push(total - visible)
      }
    }
  }
  // Pass { type, labels, series: series as Array<{ label: string; values: number[] }> } back to the caller.
  return { type, labels, series: series as Array<{ label: string; values: number[] }> }
}

// Define the helper that will get numeric plot.
function getNumericPlot(result: V1Result, type: unknown): V1Presentation['plot'] {
  // Check whether type !== 'scatter' && type !== 'bubble' before running this branch.
  if (type !== 'scatter' && type !== 'bubble') return
  // Use result.columns.filter to initialize metrics.
  const metrics = result.columns.filter(
    (c) => !c.tableOnly && (c.role === 'metric' || c.role === 'calculation')
  )
  // Use result.columns.find to initialize dimension.
  const dimension = result.columns.find((c) => c.role === 'dimension')
  // Check whether !dimension || metrics.length < (type === 'bubble' ? 3 : 2) before running this branch.
  if (!dimension || metrics.length < (type === 'bubble' ? 3 : 2)) return
  // Use result.rows.map to initialize points.
  const points = result.rows.map((row) => ({
    x: Number(row.values[metrics[0]!.key]),
    y: Number(row.values[metrics[1]!.key]),
    ...(type === 'bubble'
      ? { r: Math.sqrt(Math.max(0, Number(row.values[metrics[2]!.key]))) * 3 }
      : {}),
    label: String(row.values[dimension.key]),
  }))
  // Check whether points.some( (p) => !Number.isFinite(p.x) || !Number.isFinite(p.y) || (p.r !== undefined && !Number. before running this branch.
  if (
    points.some(
      (p) =>
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        (p.r !== undefined && !Number.isFinite(p.r))
    )
  )
    return
  // Pass { type, xLabel: humanizeV1Label(metrics[0]!), yLabel: humanizeV1Label(metrics[1]!), points, } back to the caller.
  return {
    type,
    xLabel: humanizeV1Label(metrics[0]!),
    yLabel: humanizeV1Label(metrics[1]!),
    points,
  }
}

// Define the helper that will get sankey.
function getSankey(result: V1Result, requested: unknown): SankeyPresentation | undefined {
  // Check whether requested !== 'sankey' || result.kind !== 'aggregate' before running this branch.
  if (requested !== 'sankey' || result.kind !== 'aggregate') return
  // Use result.columns.filter to initialize dimensions.
  const dimensions = result.columns.filter((column) => column.role === 'dimension')
  // Use result.columns.filter to initialize measures.
  const measures = result.columns.filter(
    (column) =>
      !column.tableOnly &&
      (column.role === 'metric' || column.role === 'calculation') &&
      numericTypes.includes(column.type)
  )
  // Check whether dimensions.length !== 2 || measures.length !== 1 || result.rows.length === 0 before running this branch.
  if (dimensions.length !== 2 || measures.length !== 1 || result.rows.length === 0) return
  // Define [sourceColumn, targetColumn] for the steps below.
  const [sourceColumn, targetColumn] = dimensions
  // Define measure for the steps below.
  const measure = measures[0]
  // Check whether !sourceColumn || !targetColumn || !measure before running this branch.
  if (!sourceColumn || !targetColumn || !measure) return

  // Define links for the steps below.
  const links = new Map<string, { source: string; target: string; value: number }>()
  // Repeat the following steps for each item in result.rows.
  for (const row of result.rows) {
    // Define sourceValue for the steps below.
    const sourceValue = row.values[sourceColumn.key]
    // Define targetValue for the steps below.
    const targetValue = row.values[targetColumn.key]
    // Define value for the steps below.
    const value = row.values[measure.key]
    // Check whether (typeof sourceValue !== 'string' && typeof sourceValue !== 'number' && typeof sourceValue !== 'boole before running this branch.
    if (
      (typeof sourceValue !== 'string' &&
        typeof sourceValue !== 'number' &&
        typeof sourceValue !== 'boolean') ||
      (typeof targetValue !== 'string' &&
        typeof targetValue !== 'number' &&
        typeof targetValue !== 'boolean') ||
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < 0
    )
      return
    // Check whether value === 0 before running this branch.
    if (value === 0) continue
    // Use formatV1Value to initialize source.
    const source = formatV1Value(sourceColumn, sourceValue)
    // Use formatV1Value to initialize target.
    const target = formatV1Value(targetColumn, targetValue)
    // Use JSON.stringify to initialize key.
    const key = JSON.stringify([source, target])
    // Use links.get to initialize existing.
    const existing = links.get(key)
    // Call links.set to run this step.
    links.set(key, { source, target, value: (existing?.value ?? 0) + value })
  }
  // Check whether links.size === 0 before running this branch.
  if (links.size === 0) return
  // Pass { sourceLabel: humanizeV1Label(sourceColumn), targetLabel: humanizeV1Label(targetColumn), valueLabel back to the caller.
  return {
    sourceLabel: humanizeV1Label(sourceColumn),
    targetLabel: humanizeV1Label(targetColumn),
    valueLabel: humanizeV1Label(measure),
    links: [...links.values()],
  }
}

// Define the helper that will title case.
function titleCase(value: string): string {
  // Pass value .replace(/([a-z0-9])([A-Z])/g, '$1 $2') .replace(/[._-]+/g, ' ') .replace(/\s+/g, ' ') .trim() back to the caller.
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

// Define the helper that will is record.
function isRecord(value: unknown): value is Record<string, any> {
  // Pass typeof value === 'object' && value !== null && !Array.isArray(value) back to the caller.
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
