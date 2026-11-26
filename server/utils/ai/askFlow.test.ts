/**
 * Purpose
 * Check the expected behavior of ask flow.
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
import { plannerInstructions, runAIQuestion } from './askFlow'
import type { StructuredQueryPlan } from './queryPlan'
import type { StructuredQueryResult } from './queryExecutor'

// Define the helper that will result for.
function resultFor(plan: StructuredQueryPlan, empty = true): StructuredQueryResult {
  // Use (plan.select ?? []).map to initialize columns.
  const columns = (plan.select ?? []).map((key) => ({ key, label: key, type: 'String', role: 'field' as const }))
  // Pass { version: 1, model: plan.model, kind: 'records', columns, rows: empty ? [] : [{ key: 'project-1', v back to the caller.
  return {
    version: 1,
    model: plan.model,
    kind: 'records',
    columns,
    rows: empty ? [] : [{ key: 'project-1', values: { name: 'Solar Lab' } }],
    scannedRootRows: empty ? 0 : 1,
    complete: true,
    hasMore: false,
    limit: plan.limit ?? 100,
    empty,
  }
}

// Call test to run this step.
test('valid v1 plan uses the privacy response wrapper and returns a distinct v1 contract', async () => {
  // Define response for the steps below.
  const response = await runAIQuestion('List software projects', undefined, {
    authorized: true,
    requestPlan: async () => JSON.stringify({ version: 1, model: 'Project', select: ['name'] }),
    executeV1: async (plan) => resultFor(plan),
  })
  // Call assert.equal to run this step.
  assert.equal('kind' in response && response.kind, 'v1')
  // Call assert.equal to run this step.
  assert.equal(response.status, 'no_data')
  // Call assert.equal to run this step.
  assert.equal('apiVersion' in response && response.apiVersion, 1)
})

// Call test to run this step.
test('invalid JSON and invalid plans receive at most one bounded repair attempt', async () => {
  // Define calls for the steps below.
  let calls = 0
  // Define response for the steps below.
  const response = await runAIQuestion('List projects', undefined, {
    authorized: true,
    requestPlan: async () => {
      calls++
      // Pass calls === 1 ? '{not json' : JSON.stringify({ version: 1, model: 'Project', select: ['name'] }) back to the caller.
      return calls === 1 ? '{not json' : JSON.stringify({ version: 1, model: 'Project', select: ['name'] })
    },
    executeV1: async (plan) => resultFor(plan),
  })
  // Call assert.equal to run this step.
  assert.equal(calls, 2)
  // Call assert.equal to run this step.
  assert.equal('kind' in response && response.kind, 'v1')

  // Update calls with the value on the right.
  calls = 0
  // Define stillInvalid for the steps below.
  const stillInvalid = await runAIQuestion('List projects', undefined, {
    authorized: true,
    requestPlan: async () => {
      calls++
      // Pass JSON.stringify({ version: 1, model: 'Project', select: ['missingField'] }) back to the caller.
      return JSON.stringify({ version: 1, model: 'Project', select: ['missingField'] })
    },
  })
  // Call assert.equal to run this step.
  assert.equal(calls, 2)
  // Call assert.equal to run this step.
  assert.equal('status' in stillInvalid && stillInvalid.status, 'unsupported_capability')

  // Update calls with the value on the right.
  calls = 0
  // Define rejected for the steps below.
  const rejected = await runAIQuestion('List projects', undefined, {
    authorized: true,
    requestPlan: async () => {
      calls++
      // Pass JSON.stringify({ version: 1, model: 'Project', select: ['Student.email'] }) back to the caller.
      return JSON.stringify({ version: 1, model: 'Project', select: ['Student.email'] })
    },
  })
  // Call assert.equal to run this step.
  assert.equal(calls, 1)
  // Call assert.equal to run this step.
  assert.equal('status' in rejected && rejected.status, 'privacy_restricted')
})

// Call test to run this step.
test('planner instructions distinguish protected enrollment aggregates from restricted records', async () => {
  // Call assert.match to run this step.
  assert.match(plannerInstructions, /only permitted student-related exception/i)
  // Call assert.match to run this step.
  assert.match(plannerInstructions, /"chartType":"pie"/)
  // Call assert.match to run this step.
  assert.match(plannerInstructions, /projects by type as a chart/i)
  // Call assert.doesNotMatch to run this step.
  assert.doesNotMatch(plannerInstructions, /Never access Student, Enrollment, Membership/)

  // Define feedback for the steps below.
  let feedback = ''
  // Define calls for the steps below.
  let calls = 0
  // Define response for the steps below.
  const response = await runAIQuestion('Count projects by type', undefined, {
    authorized: true,
    requestPlan: async (messages) => {
      calls++
      // Check whether calls === 1 before running this branch.
      if (calls === 1) {
        // Pass JSON.stringify({ version: 1, model: 'Project', select: ['unknownPlannerField'] }) back to the caller.
        return JSON.stringify({ version: 1, model: 'Project', select: ['unknownPlannerField'] })
      }
      // Update feedback with the value on the right.
      feedback = messages.at(-1)?.content ?? ''
      // Pass JSON.stringify({ version: 1, model: 'Project', groupBy: ['type'], aggregates: [{ function: 'count',  back to the caller.
      return JSON.stringify({
        version: 1, model: 'Project', groupBy: ['type'],
        aggregates: [{ function: 'count', alias: 'projects' }],
      })
    },
    executeV1: async (plan) => ({ ...resultFor(plan), kind: 'aggregate', columns: [
      { key: 'type', label: 'type', type: 'ProjectType', role: 'dimension' },
      { key: 'projects', label: 'projects', type: 'Int', role: 'metric' },
    ], rows: [{ key: 'one', values: { type: 'SOFTWARE', projects: 1 } }], empty: false }),
  })
  // Call assert.equal to run this step.
  assert.equal('kind' in response && response.kind, 'v1')
  // Call assert.match to run this step.
  assert.match(feedback, /exact model, field, and relationship names/i)
  // Call assert.doesNotMatch to run this step.
  assert.doesNotMatch(feedback, /unknownPlannerField/)
})

// Call test to run this step.
test('legacy project search remains on its compatibility path and preserves its result shape', async () => {
  // Define received for the steps below.
  let received: unknown
  // Define response for the steps below.
  const response = await runAIQuestion('Find projects containing robotics', undefined, {
    authorized: true,
    requestPlan: async () => JSON.stringify({
      entity: 'projects', operation: 'search', filters: { keyword: 'robotics' }, groupBy: 'none',
    }),
    executeLegacy: async (plan) => { received = plan; return { results: [], count: 0 } },
  })
  // Call assert.equal to run this step.
  assert.equal('kind' in response && response.kind, 'legacy')
  // Call assert.deepEqual to run this step.
  assert.deepEqual(received, {
    entity: 'projects', operation: 'search', groupBy: 'none', filters: { keyword: 'robotics' },
  })
})

// Call test to run this step.
test('legacy protected enrollment analytics remains available through its compatibility path', async () => {
  // Define received for the steps below.
  let received: unknown
  // Define response for the steps below.
  const response = await runAIQuestion('Count students by year', 'SP26', {
    authorized: true,
    requestPlan: async () => JSON.stringify({
      entity: 'enrollments', operation: 'count', filters: { semester: 'SP26' }, groupBy: 'year',
    }),
    executeLegacy: async (plan) => { received = plan; return { semester: 'SP26', results: [] } },
  })
  // Call assert.equal to run this step.
  assert.equal('kind' in response && response.kind, 'legacy')
  // Call assert.deepEqual to run this step.
  assert.deepEqual(received, {
    entity: 'enrollments', operation: 'count', groupBy: 'year', filters: { semester: 'SP26' },
  })
})

// Call test to run this step.
test('protected spring enrollment pie plans retain the explicit semester and chart type', async () => {
  // Define received for the steps below.
  let received: unknown
  // Define response for the steps below.
  const response = await runAIQuestion('Show a pie chart of majors of students in spring 2026', 'FA26', {
    authorized: true,
    requestPlan: async () => JSON.stringify({
      entity: 'enrollments',
      operation: 'count',
      filters: { semester: 'SP26' },
      groupBy: 'major',
      chartType: 'pie',
    }),
    executeLegacy: async (plan) => {
      // Update received with the value on the right.
      received = plan
      // Pass { semester: 'SP26', results: [{ major: 'Engineering', count: 12 }] } back to the caller.
      return { semester: 'SP26', results: [{ major: 'Engineering', count: 12 }] }
    },
  })
  // Call assert.equal to run this step.
  assert.equal('kind' in response && response.kind, 'legacy')
  // Call assert.deepEqual to run this step.
  assert.deepEqual(received, {
    entity: 'enrollments',
    operation: 'count',
    groupBy: 'major',
    filters: { semester: 'SP26' },
    chartType: 'pie',
  })
})

// Call test to run this step.
test('authorization is checked before calling the planner', async () => {
  // Define called for the steps below.
  let called = false
  // Define response for the steps below.
  const response = await runAIQuestion('List projects', undefined, {
    authorized: false,
    requestPlan: async () => { called = true; return '{}' },
  })
  // Call assert.equal to run this step.
  assert.equal(called, false)
  // Call assert.equal to run this step.
  assert.equal('status' in response && response.status, 'execution_error')
})

// Call test to run this step.
test('answer, clarification, unsupported, and planner-error statuses are returned distinctly', async () => {
  // Define answer for the steps below.
  const answer = await runAIQuestion('List projects', undefined, {
    authorized: true,
    requestPlan: async () => JSON.stringify({ version: 1, model: 'Project', select: ['name'] }),
    executeV1: async (plan) => resultFor(plan, false),
  })
  // Call assert.equal to run this step.
  assert.equal(answer.status, 'answer')

  // Define clarification for the steps below.
  const clarification = await runAIQuestion('Show the usual thing', undefined, {
    authorized: true,
    requestPlan: async () => JSON.stringify({ operation: 'clarification_needed', question: 'Which grouping?' }),
  })
  // Call assert.equal to run this step.
  assert.equal('status' in clarification && clarification.status, 'clarification_needed')

  // Define unsupported for the steps below.
  const unsupported = await runAIQuestion('Show private student records', undefined, {
    authorized: true,
    requestPlan: async () => JSON.stringify({ operation: 'unsupported' }),
  })
  // Call assert.equal to run this step.
  assert.equal('status' in unsupported && unsupported.status, 'unsupported_capability')

  // Define executionError for the steps below.
  const executionError = await runAIQuestion('List projects', undefined, {
    authorized: true,
    requestPlan: async () => { throw new Error('private upstream response') },
  })
  // Call assert.equal to run this step.
  assert.equal('status' in executionError && executionError.status, 'execution_error')
  // Call assert.doesNotMatch to run this step.
  assert.doesNotMatch(executionError.explanation, /private upstream/i)
})

// Call test to run this step.
test('dashboard semester is applied by default but explicit semesters and comparisons are preserved', async () => {
  // Define captured for the steps below.
  let captured: StructuredQueryPlan | undefined
  // Define defaulted for the steps below.
  const defaulted = await runAIQuestion('List projects', 'SP26', {
    authorized: true,
    requestPlan: async () => JSON.stringify({ version: 1, model: 'Project', select: ['name'] }),
    executeV1: async (plan) => { captured = plan; return resultFor(plan) },
  })
  // Call assert.equal to run this step.
  assert.equal('kind' in defaulted && defaulted.kind, 'v1')
  // Call assert.match to run this step.
  assert.match(JSON.stringify(captured?.where), /2026|SPRING/)

  // Update captured with the value on the right.
  captured = undefined
  // Define explicit for the steps below.
  const explicit = await runAIQuestion('List projects from Fall 2024', 'SP26', {
    authorized: true,
    requestPlan: async () => JSON.stringify({
      version: 1, model: 'Project', select: ['name'],
      where: { relation: 'Teams', quantifier: 'some', where: { relation: 'Semester', quantifier: 'is', where: { and: [
        { field: 'year', operator: 'eq', value: 2024 },
        { field: 'season', operator: 'eq', value: 'FALL' },
      ] } } },
    }),
    executeV1: async (plan) => { captured = plan; return resultFor(plan) },
  })
  // Call assert.equal to run this step.
  assert.equal('kind' in explicit && explicit.kind, 'v1')
  // Call assert.match to run this step.
  assert.match(JSON.stringify(captured?.where), /2024|FALL/)
  // Call assert.doesNotMatch to run this step.
  assert.doesNotMatch(JSON.stringify(captured?.where), /2026|SPRING/)
})

// Call test to run this step.
test('semester comparison requires the requested comparison dimension', async () => {
  // Define calls for the steps below.
  let calls = 0
  // Define response for the steps below.
  const response = await runAIQuestion('Compare projects across semesters', 'SP26', {
    authorized: true,
    requestPlan: async () => {
      calls++
      // Pass JSON.stringify({ version: 1, model: 'Project', groupBy: ['Teams.Semester.season'], aggregates: [{ fu back to the caller.
      return JSON.stringify({ version: 1, model: 'Project', groupBy: ['Teams.Semester.season'], aggregates: [{ function: 'count', alias: 'projects' }] })
    },
    executeV1: async (plan) => resultFor(plan),
  })
  // Call assert.equal to run this step.
  assert.equal(calls, 1)
  // Call assert.equal to run this step.
  assert.equal('kind' in response && response.kind, 'v1')
})
