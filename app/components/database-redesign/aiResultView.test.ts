import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatV1Value,
  humanizeV1Label,
  buildLegacyEnrollmentChart,
  isLegacyAIResponse,
  legacyAnalyticsView,
  normalizeV1Response,
  supportsCategoricalChart,
} from './aiResultView'

function response(
  result: Record<string, unknown>,
  plan: Record<string, unknown> = {}
) {
  return { kind: 'v1', apiVersion: 1, status: 'answer', explanation: 'Query complete.', plan, result }
}

function aggregateResult(
  columns: Array<Record<string, unknown>>,
  rows: Array<Record<string, unknown>>,
  options: Record<string, unknown> = {}
) {
  return {
    version: 1,
    model: 'Project',
    kind: 'aggregate',
    columns,
    rows,
    scannedRootRows: 12,
    complete: true,
    hasMore: false,
    limit: 100,
    empty: rows.length === 0,
    ...options,
  }
}

test('single scalar aggregate produces a summary card model', () => {
  const view = normalizeV1Response(response(
    aggregateResult(
      [{ key: 'projects', label: 'projects', type: 'Int', role: 'metric' }],
      [{ key: '{}', values: { projects: 8 } }]
    ),
    { chartType: 'bar' }
  ))
  assert.deepEqual(view?.summary, { label: 'Projects', value: 8 })
  assert.equal(view?.chart, undefined)
})

test('one category and one numeric metric produce the requested chart and table data', () => {
  const view = normalizeV1Response(response(
    aggregateResult(
      [
        { key: 'type', label: 'type', type: 'ProjectType', role: 'dimension' },
        { key: 'projectCount', label: 'projectCount', type: 'Int', role: 'metric' },
      ],
      [
        { key: '{"type":"SOFTWARE"}', values: { type: 'SOFTWARE', projectCount: 4 } },
        { key: '{"type":"HARDWARE"}', values: { type: 'HARDWARE', projectCount: 2 } },
      ]
    ),
    { chartType: 'horizontalBar' }
  ))
  assert.equal(view?.chart?.type, 'horizontalBar')
  assert.deepEqual(view?.chart?.labels, ['Software', 'Hardware'])
  assert.deepEqual(view?.chart?.series[0]?.values, [4, 2])
  assert.equal(humanizeV1Label(view!.result!.columns[1]!), 'Project Count')
})

test('Sankey requests with two categorical dimensions and one metric produce flow links', () => {
  const view = normalizeV1Response(response(
    aggregateResult(
      [
        { key: 'type', label: 'type', type: 'ProjectType', role: 'dimension' },
        { key: 'status', label: 'status', type: 'ProjectStatus', role: 'dimension' },
        { key: 'projects', label: 'projects', type: 'Int', role: 'metric' },
      ],
      [
        { key: 'software-new', values: { type: 'SOFTWARE', status: 'NEW', projects: 4 } },
        { key: 'software-complete', values: { type: 'SOFTWARE', status: 'COMPLETE', projects: 2 } },
      ]
    ),
    { chartType: 'sankey' }
  ))

  assert.deepEqual(view?.sankey, {
    sourceLabel: 'Project Type',
    targetLabel: 'Project Status',
    valueLabel: 'Projects',
    links: [
      { source: 'Software', target: 'New', value: 4 },
      { source: 'Software', target: 'Complete', value: 2 },
    ],
  })
  assert.equal(view?.result?.rows.length, 2)
  assert.equal(view?.chart, undefined)
})

test('multiple metrics support a multi-series chart when requested', () => {
  const view = normalizeV1Response(response(
    aggregateResult(
      [
        { key: 'season', label: 'season', type: 'SemesterSeason', role: 'dimension' },
        { key: 'projects', label: 'projects', type: 'Int', role: 'metric' },
        { key: 'partners', label: 'partners', type: 'Int', role: 'metric' },
      ],
      [{ key: '{"season":"FALL"}', values: { season: 'FALL', projects: 7, partners: 3 } }]
    ),
    { chartType: 'line' }
  ))
  assert.equal(view?.chart?.series.length, 2)
})

test('record selections use metadata for table rows and do not create charts', () => {
  const view = normalizeV1Response(response({
    version: 1,
    model: 'Project',
    kind: 'records',
    columns: [
      { key: 'name', label: 'name', type: 'String', role: 'field' },
      { key: 'type', label: 'type', type: 'ProjectType', role: 'field' },
    ],
    rows: [{ key: 'p1', values: { name: 'Solar Lab', type: 'SOFTWARE' } }],
    scannedRootRows: 1,
    complete: true,
    hasMore: false,
    limit: 100,
    empty: false,
  }))
  assert.equal(view?.result?.rows.length, 1)
  assert.equal(view?.chart, undefined)
  assert.equal(humanizeV1Label(view!.result!.columns[1]!), 'Project Type')
  assert.equal(formatV1Value(view!.result!.columns[1]!, 'SOFTWARE'), 'Software')
})

test('scatter and bubble fall back to table data instead of fabricating coordinates or radii', () => {
  const base = aggregateResult(
    [
      { key: 'type', label: 'type', type: 'ProjectType', role: 'dimension' },
      { key: 'count', label: 'count', type: 'Int', role: 'metric' },
    ],
    [{ key: 'one', values: { type: 'SOFTWARE', count: 4 } }]
  )
  assert.equal(normalizeV1Response(response(base, { chartType: 'scatter' }))?.chart, undefined)
  assert.equal(normalizeV1Response(response(base, { chartType: 'bubble' }))?.chart, undefined)
  assert.equal(supportsCategoricalChart('scatter', 1, 1), false)
  assert.equal(supportsCategoricalChart('bubble', 1, 1), false)
  assert.equal(supportsCategoricalChart('bar', 2, 1), false)
  assert.equal(supportsCategoricalChart('pie', 1, 2), false)
  assert.equal(supportsCategoricalChart('line', 1, 2), true)
})

test('truncation indicators survive normalization for a visible limited-results notice', () => {
  const view = normalizeV1Response(response({
    ...aggregateResult(
      [{ key: 'season', label: 'season', type: 'String', role: 'dimension' }, { key: 'count', label: 'count', type: 'Int', role: 'metric' }],
      [{ key: 'one', values: { season: 'FALL', count: 3 } }]
    ),
    complete: false,
    hasMore: true,
    limit: 1,
  }))
  assert.equal(view?.result?.complete, false)
  assert.equal(view?.result?.hasMore, true)
})

test('empty and all structured response statuses remain distinct', () => {
  const empty = normalizeV1Response({ ...response(aggregateResult([], [])), status: 'no_data' })
  assert.equal(empty?.status, 'no_data')
  for (const status of ['privacy_restricted', 'clarification_needed', 'unsupported_capability', 'execution_error']) {
    const view = normalizeV1Response({ kind: 'v1', apiVersion: 1, status, explanation: `${status} explanation` })
    assert.equal(view?.status, status)
    assert.equal(view?.result, undefined)
  }
  assert.equal(normalizeV1Response({ status: 'execution_error', explanation: 'Planner unavailable.' })?.status, 'execution_error')
})

test('legacy response shapes are left for the existing legacy renderer', () => {
  const legacy = { success: true, plan: { operation: 'search_projects' }, data: { results: [] } }
  assert.equal(normalizeV1Response(legacy), null)
  assert.equal(isLegacyAIResponse(legacy), true)
  assert.equal(legacyAnalyticsView(0, 1), 'summary')
  assert.equal(legacyAnalyticsView(1, 1, 'scatter'), 'table')
})

test('legacy enrollment by major defaults to a bar chart using the returned privacy-filtered groups', () => {
  const results = [
    { label: 'Biomedical Engineering', count: 6 },
    { label: 'Computer Engineering', count: 8 },
    { label: 'Computer Science', count: 86 },
    { label: 'Electrical Engineering', count: 8 },
    { label: 'Mechanical Engineering', count: 22 },
  ]

  const chart = buildLegacyEnrollmentChart(results)
  assert.equal(chart?.type, 'bar')
  assert.deepEqual(chart?.labels, results.map((row) => row.label))
  assert.deepEqual(chart?.values, results.map((row) => row.count))

  const pie = buildLegacyEnrollmentChart(results, 'pie')
  assert.equal(pie?.type, 'pie')
  assert.deepEqual(pie?.values, [6, 8, 86, 8, 22])
})
