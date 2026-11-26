/**
 * Purpose
 * Check the expected behavior of ai result presentation.
 *
 * Inputs
 * - Test records, example requests, and the function being exercised.
 *
 * Outputs
 * - Passing assertions or a failure that identifies unexpected behavior.
 *
 * Pseudocode
 * Arrange the example → run the relevant function → compare its result with the expected behavior.
 */
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
} from './aiResultPresentation'

// Define the helper that will response.
function response(
  result: Record<string, unknown>,
  plan: Record<string, unknown> = {}
) {
  // Pass { kind: 'v1', apiVersion: 1, status: 'answer', explanation: 'Query complete.', plan, result } back to the caller.
  return { kind: 'v1', apiVersion: 1, status: 'answer', explanation: 'Query complete.', plan, result }
}

// Define the helper that will aggregate result.
function aggregateResult(
  columns: Array<Record<string, unknown>>,
  rows: Array<Record<string, unknown>>,
  options: Record<string, unknown> = {}
) {
  // Pass { version: 1, model: 'Project', kind: 'aggregate', columns, rows, scannedRootRows: 12, complete: tru back to the caller.
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

// Call test to run this step.
test('single scalar aggregate produces a summary card model', () => {
  // Use normalizeV1Response to initialize view.
  const view = normalizeV1Response(response(
    aggregateResult(
      [{ key: 'projects', label: 'projects', type: 'Int', role: 'metric' }],
      [{ key: '{}', values: { projects: 8 } }]
    ),
    { chartType: 'bar' }
  ))
  // Call assert.deepEqual to run this step.
  assert.deepEqual(view?.summary, { label: 'Projects', value: 8 })
  // Call assert.equal to run this step.
  assert.equal(view?.chart, undefined)
})

// Call test to run this step.
test('one category and one numeric metric produce the requested chart and table data', () => {
  // Use normalizeV1Response to initialize view.
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
  // Call assert.equal to run this step.
  assert.equal(view?.chart?.type, 'horizontalBar')
  // Call assert.deepEqual to run this step.
  assert.deepEqual(view?.chart?.labels, ['Software', 'Hardware'])
  // Call assert.deepEqual to run this step.
  assert.deepEqual(view?.chart?.series[0]?.values, [4, 2])
  // Call assert.equal to run this step.
  assert.equal(humanizeV1Label(view!.result!.columns[1]!), 'Project Count')
})

// Call test to run this step.
test('Sankey requests with two categorical dimensions and one metric produce flow links', () => {
  // Use normalizeV1Response to initialize view.
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

  // Call assert.deepEqual to run this step.
  assert.deepEqual(view?.sankey, {
    sourceLabel: 'Project Type',
    targetLabel: 'Project Status',
    valueLabel: 'Projects',
    links: [
      { source: 'Software', target: 'New', value: 4 },
      { source: 'Software', target: 'Complete', value: 2 },
    ],
  })
  // Call assert.equal to run this step.
  assert.equal(view?.result?.rows.length, 2)
  // Call assert.equal to run this step.
  assert.equal(view?.chart, undefined)
})

// Call test to run this step.
test('multiple metrics support a multi-series chart when requested', () => {
  // Use normalizeV1Response to initialize view.
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
  // Call assert.equal to run this step.
  assert.equal(view?.chart?.series.length, 2)
})

// Call test to run this step.
test('record selections use metadata for table rows and do not create charts', () => {
  // Use normalizeV1Response to initialize view.
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
  // Call assert.equal to run this step.
  assert.equal(view?.result?.rows.length, 1)
  // Call assert.equal to run this step.
  assert.equal(view?.chart, undefined)
  // Call assert.equal to run this step.
  assert.equal(humanizeV1Label(view!.result!.columns[1]!), 'Project Type')
  // Call assert.equal to run this step.
  assert.equal(formatV1Value(view!.result!.columns[1]!, 'SOFTWARE'), 'Software')
})

// Call test to run this step.
test('scatter and bubble fall back to table data instead of fabricating coordinates or radii', () => {
  // Use aggregateResult to initialize base.
  const base = aggregateResult(
    [
      { key: 'type', label: 'type', type: 'ProjectType', role: 'dimension' },
      { key: 'count', label: 'count', type: 'Int', role: 'metric' },
    ],
    [{ key: 'one', values: { type: 'SOFTWARE', count: 4 } }]
  )
  // Call assert.equal to run this step.
  assert.equal(normalizeV1Response(response(base, { chartType: 'scatter' }))?.chart, undefined)
  // Call assert.equal to run this step.
  assert.equal(normalizeV1Response(response(base, { chartType: 'bubble' }))?.chart, undefined)
  // Call assert.equal to run this step.
  assert.equal(supportsCategoricalChart('scatter', 1, 1), false)
  // Call assert.equal to run this step.
  assert.equal(supportsCategoricalChart('bubble', 1, 1), false)
  // Call assert.equal to run this step.
  assert.equal(supportsCategoricalChart('bar', 2, 1), false)
  // Call assert.equal to run this step.
  assert.equal(supportsCategoricalChart('pie', 1, 2), false)
  // Call assert.equal to run this step.
  assert.equal(supportsCategoricalChart('line', 1, 2), true)
})

// Call test to run this step.
test('truncation indicators survive normalization for a visible limited-results notice', () => {
  // Use normalizeV1Response to initialize view.
  const view = normalizeV1Response(response({
    ...aggregateResult(
      [{ key: 'season', label: 'season', type: 'String', role: 'dimension' }, { key: 'count', label: 'count', type: 'Int', role: 'metric' }],
      [{ key: 'one', values: { season: 'FALL', count: 3 } }]
    ),
    complete: false,
    hasMore: true,
    limit: 1,
  }))
  // Call assert.equal to run this step.
  assert.equal(view?.result?.complete, false)
  // Call assert.equal to run this step.
  assert.equal(view?.result?.hasMore, true)
})

// Call test to run this step.
test('empty and all structured response statuses remain distinct', () => {
  // Use normalizeV1Response to initialize empty.
  const empty = normalizeV1Response({ ...response(aggregateResult([], [])), status: 'no_data' })
  // Call assert.equal to run this step.
  assert.equal(empty?.status, 'no_data')
  // Repeat the following steps for each item in ['privacy_restricted', 'clarification_needed', 'unsupported_capability', 'execution_error'].
  for (const status of ['privacy_restricted', 'clarification_needed', 'unsupported_capability', 'execution_error']) {
    // Use normalizeV1Response to initialize view.
    const view = normalizeV1Response({ kind: 'v1', apiVersion: 1, status, explanation: `${status} explanation` })
    // Call assert.equal to run this step.
    assert.equal(view?.status, status)
    // Call assert.equal to run this step.
    assert.equal(view?.result, undefined)
  }
  // Call assert.equal to run this step.
  assert.equal(normalizeV1Response({ status: 'execution_error', explanation: 'Planner unavailable.' })?.status, 'execution_error')
})

// Call test to run this step.
test('legacy response shapes are left for the existing legacy renderer', () => {
  // Define legacy for the steps below.
  const legacy = { success: true, plan: { operation: 'search_projects' }, data: { results: [] } }
  // Call assert.equal to run this step.
  assert.equal(normalizeV1Response(legacy), null)
  // Call assert.equal to run this step.
  assert.equal(isLegacyAIResponse(legacy), true)
  // Call assert.equal to run this step.
  assert.equal(legacyAnalyticsView(0, 1), 'summary')
  // Call assert.equal to run this step.
  assert.equal(legacyAnalyticsView(1, 1, 'scatter'), 'table')
})

// Call test to run this step.
test('legacy enrollment by major defaults to a bar chart using the returned privacy-filtered groups', () => {
  // Define results for the steps below.
  const results = [
    { label: 'Biomedical Engineering', count: 6 },
    { label: 'Computer Engineering', count: 8 },
    { label: 'Computer Science', count: 86 },
    { label: 'Electrical Engineering', count: 8 },
    { label: 'Mechanical Engineering', count: 22 },
  ]

  // Use buildLegacyEnrollmentChart to initialize chart.
  const chart = buildLegacyEnrollmentChart(results)
  // Call assert.equal to run this step.
  assert.equal(chart?.type, 'bar')
  // Call assert.deepEqual to run this step.
  assert.deepEqual(chart?.labels, results.map((row) => row.label))
  // Call assert.deepEqual to run this step.
  assert.deepEqual(chart?.values, results.map((row) => row.count))

  // Use buildLegacyEnrollmentChart to initialize pie.
  const pie = buildLegacyEnrollmentChart(results, 'pie')
  // Call assert.equal to run this step.
  assert.equal(pie?.type, 'pie')
  // Call assert.deepEqual to run this step.
  assert.deepEqual(pie?.values, [6, 8, 86, 8, 22])
})
