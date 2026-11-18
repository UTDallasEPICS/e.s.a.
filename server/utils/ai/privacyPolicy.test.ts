import assert from 'node:assert/strict'
import test from 'node:test'
import { protectAggregateCount, validateAIPlan } from './harness'
import { executeStructuredQueryRequest } from './structuredResponse'
import type { StructuredQueryResult } from './queryExecutor'

const emptyResult: StructuredQueryResult = {
  version: 1,
  model: 'Project',
  kind: 'records',
  columns: [{ key: 'name', label: 'name', type: 'String', role: 'field' }],
  rows: [],
  scannedRootRows: 0,
  complete: true,
  hasMore: false,
  limit: 20,
  empty: true,
}

test('unauthorized v1 requests are rejected before executor invocation', async () => {
  let executed = false
  const response = await executeStructuredQueryRequest(
    { version: 1, model: 'Project', select: ['name'] },
    { authorized: false, execute: async () => { executed = true; return emptyResult } }
  )
  assert.equal(response.status, 'execution_error')
  assert.equal(executed, false)
  assert.match(response.explanation, /not authorized/i)
})

test('student fields, models, and excluded relationships are privacy restricted', async () => {
  for (const plan of [
    { version: 1, model: 'Project', select: ['name', 'Student.email'] },
    { version: 1, model: 'Student', select: ['email'] },
    {
      version: 1,
      model: 'Project',
      select: ['name'],
      where: { relation: 'Choices', quantifier: 'some', where: { field: 'rank', operator: 'eq', value: 1 } },
    },
  ]) {
    const response = await executeStructuredQueryRequest(plan, { authorized: true })
    assert.equal(response.status, 'privacy_restricted')
    assert.doesNotMatch(response.explanation, /Student\.email|Choices|rank/i)
  }
})

test('invalid plans return a safe unsupported-capability response', async () => {
  const response = await executeStructuredQueryRequest(
    { version: 1, model: 'Project', select: ['name'], limit: 999999 },
    { authorized: true }
  )
  assert.equal(response.status, 'unsupported_capability')
  assert.match(response.explanation, /does not support/i)
  assert.doesNotMatch(response.explanation, /stack|Prisma|limit/i)
})

test('empty valid results are distinct from unsupported requests', async () => {
  const response = await executeStructuredQueryRequest(
    { version: 1, model: 'Project', select: ['name'] },
    { authorized: true, execute: async () => emptyResult }
  )
  assert.equal(response.status, 'no_data')
  assert.ok(response.result)
})

test('server result bounds are retained and truncation is explicit', async () => {
  const result = {
    ...emptyResult,
    rows: [{ key: '1', values: { name: 'A' } }],
    limit: 1,
    empty: false,
    complete: false,
    hasMore: true,
  }
  const response = await executeStructuredQueryRequest(
    { version: 1, model: 'Project', select: ['name'], limit: 1 },
    { authorized: true, execute: async () => result }
  )
  assert.equal(response.status, 'answer')
  assert.equal(response.result?.hasMore, true)
  assert.equal(response.result?.rows.length, 1)
})

test('database failures return safe messages without leaking internal details', async () => {
  const response = await executeStructuredQueryRequest(
    { version: 1, model: 'Project', select: ['name'] },
    { authorized: true, execute: async () => { throw new Error('secret schema and DB password') } }
  )
  assert.equal(response.status, 'execution_error')
  assert.doesNotMatch(response.explanation, /secret|schema|password/i)
})

test('legacy enrollment privacy and aggregate suppression remain active', () => {
  assert.throws(
    () => validateAIPlan({ entity: 'enrollments', operation: 'count', filters: { semester: 'SP26', major: 'X', year: 'SENIOR' }, groupBy: 'none' }),
    /cannot combine demographic filters/
  )
  assert.equal(protectAggregateCount(4), null)
  assert.equal(protectAggregateCount(5), 5)
})
