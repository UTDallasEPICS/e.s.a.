import assert from 'node:assert/strict'
import test from 'node:test'
import { plannerInstructions, runAIQuestion } from './askFlow'
import type { StructuredQueryPlan } from './queryPlan'
import type { StructuredQueryResult } from './queryExecutor'

function resultFor(plan: StructuredQueryPlan, empty = true): StructuredQueryResult {
  const columns = (plan.select ?? []).map((key) => ({ key, label: key, type: 'String', role: 'field' as const }))
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

test('valid v1 plan uses the privacy response wrapper and returns a distinct v1 contract', async () => {
  const response = await runAIQuestion('List software projects', undefined, {
    authorized: true,
    requestPlan: async () => JSON.stringify({ version: 1, model: 'Project', select: ['name'] }),
    executeV1: async (plan) => resultFor(plan),
  })
  assert.equal('kind' in response && response.kind, 'v1')
  assert.equal(response.status, 'no_data')
  assert.equal('apiVersion' in response && response.apiVersion, 1)
})

test('invalid JSON and invalid plans receive at most one bounded repair attempt', async () => {
  let calls = 0
  const response = await runAIQuestion('List projects', undefined, {
    authorized: true,
    requestPlan: async () => {
      calls++
      return calls === 1 ? '{not json' : JSON.stringify({ version: 1, model: 'Project', select: ['name'] })
    },
    executeV1: async (plan) => resultFor(plan),
  })
  assert.equal(calls, 2)
  assert.equal('kind' in response && response.kind, 'v1')

  calls = 0
  const stillInvalid = await runAIQuestion('List projects', undefined, {
    authorized: true,
    requestPlan: async () => {
      calls++
      return JSON.stringify({ version: 1, model: 'Project', select: ['missingField'] })
    },
  })
  assert.equal(calls, 2)
  assert.equal('status' in stillInvalid && stillInvalid.status, 'unsupported_capability')

  calls = 0
  const rejected = await runAIQuestion('List projects', undefined, {
    authorized: true,
    requestPlan: async () => {
      calls++
      return JSON.stringify({ version: 1, model: 'Project', select: ['Student.email'] })
    },
  })
  assert.equal(calls, 1)
  assert.equal('status' in rejected && rejected.status, 'privacy_restricted')
})

test('planner instructions distinguish protected enrollment aggregates from restricted records', async () => {
  assert.match(plannerInstructions, /only permitted student-related exception/i)
  assert.match(plannerInstructions, /"chartType":"pie"/)
  assert.match(plannerInstructions, /projects by type as a chart/i)
  assert.doesNotMatch(plannerInstructions, /Never access Student, Enrollment, Membership/)

  let feedback = ''
  let calls = 0
  const response = await runAIQuestion('Count projects by type', undefined, {
    authorized: true,
    requestPlan: async (messages) => {
      calls++
      if (calls === 1) {
        return JSON.stringify({ version: 1, model: 'Project', select: ['unknownPlannerField'] })
      }
      feedback = messages.at(-1)?.content ?? ''
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
  assert.equal('kind' in response && response.kind, 'v1')
  assert.match(feedback, /exact model, field, and relationship names/i)
  assert.doesNotMatch(feedback, /unknownPlannerField/)
})

test('legacy project search remains on its compatibility path and preserves its result shape', async () => {
  let received: unknown
  const response = await runAIQuestion('Find projects containing robotics', undefined, {
    authorized: true,
    requestPlan: async () => JSON.stringify({
      entity: 'projects', operation: 'search', filters: { keyword: 'robotics' }, groupBy: 'none',
    }),
    executeLegacy: async (plan) => { received = plan; return { results: [], count: 0 } },
  })
  assert.equal('kind' in response && response.kind, 'legacy')
  assert.deepEqual(received, {
    entity: 'projects', operation: 'search', groupBy: 'none', filters: { keyword: 'robotics' },
  })
})

test('legacy protected enrollment analytics remains available through its compatibility path', async () => {
  let received: unknown
  const response = await runAIQuestion('Count students by year', 'SP26', {
    authorized: true,
    requestPlan: async () => JSON.stringify({
      entity: 'enrollments', operation: 'count', filters: { semester: 'SP26' }, groupBy: 'year',
    }),
    executeLegacy: async (plan) => { received = plan; return { semester: 'SP26', results: [] } },
  })
  assert.equal('kind' in response && response.kind, 'legacy')
  assert.deepEqual(received, {
    entity: 'enrollments', operation: 'count', groupBy: 'year', filters: { semester: 'SP26' },
  })
})

test('protected spring enrollment pie plans retain the explicit semester and chart type', async () => {
  let received: unknown
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
      received = plan
      return { semester: 'SP26', results: [{ major: 'Engineering', count: 12 }] }
    },
  })
  assert.equal('kind' in response && response.kind, 'legacy')
  assert.deepEqual(received, {
    entity: 'enrollments',
    operation: 'count',
    groupBy: 'major',
    filters: { semester: 'SP26' },
    chartType: 'pie',
  })
})

test('authorization is checked before calling the planner', async () => {
  let called = false
  const response = await runAIQuestion('List projects', undefined, {
    authorized: false,
    requestPlan: async () => { called = true; return '{}' },
  })
  assert.equal(called, false)
  assert.equal('status' in response && response.status, 'execution_error')
})

test('answer, clarification, unsupported, and planner-error statuses are returned distinctly', async () => {
  const answer = await runAIQuestion('List projects', undefined, {
    authorized: true,
    requestPlan: async () => JSON.stringify({ version: 1, model: 'Project', select: ['name'] }),
    executeV1: async (plan) => resultFor(plan, false),
  })
  assert.equal(answer.status, 'answer')

  const clarification = await runAIQuestion('Show the usual thing', undefined, {
    authorized: true,
    requestPlan: async () => JSON.stringify({ operation: 'clarification_needed', question: 'Which grouping?' }),
  })
  assert.equal('status' in clarification && clarification.status, 'clarification_needed')

  const unsupported = await runAIQuestion('Show private student records', undefined, {
    authorized: true,
    requestPlan: async () => JSON.stringify({ operation: 'unsupported' }),
  })
  assert.equal('status' in unsupported && unsupported.status, 'unsupported_capability')

  const executionError = await runAIQuestion('List projects', undefined, {
    authorized: true,
    requestPlan: async () => { throw new Error('private upstream response') },
  })
  assert.equal('status' in executionError && executionError.status, 'execution_error')
  assert.doesNotMatch(executionError.explanation, /private upstream/i)
})

test('dashboard semester is applied by default but explicit semesters and comparisons are preserved', async () => {
  let captured: StructuredQueryPlan | undefined
  const defaulted = await runAIQuestion('List projects', 'SP26', {
    authorized: true,
    requestPlan: async () => JSON.stringify({ version: 1, model: 'Project', select: ['name'] }),
    executeV1: async (plan) => { captured = plan; return resultFor(plan) },
  })
  assert.equal('kind' in defaulted && defaulted.kind, 'v1')
  assert.match(JSON.stringify(captured?.where), /2026|SPRING/)

  captured = undefined
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
  assert.equal('kind' in explicit && explicit.kind, 'v1')
  assert.match(JSON.stringify(captured?.where), /2024|FALL/)
  assert.doesNotMatch(JSON.stringify(captured?.where), /2026|SPRING/)
})

test('semester comparison requires the requested comparison dimension', async () => {
  let calls = 0
  const response = await runAIQuestion('Compare projects across semesters', 'SP26', {
    authorized: true,
    requestPlan: async () => {
      calls++
      return JSON.stringify({ version: 1, model: 'Project', groupBy: ['Teams.Semester.season'], aggregates: [{ function: 'count', alias: 'projects' }] })
    },
    executeV1: async (plan) => resultFor(plan),
  })
  assert.equal(calls, 1)
  assert.equal('kind' in response && response.kind, 'v1')
})
