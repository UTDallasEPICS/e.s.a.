/**
 * Purpose
 * Check the expected behavior of privacy policy.
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
import { protectAggregateCount, validateAIPlan } from './harness'
import { executeStructuredQueryRequest } from './structuredResponse'
import type { StructuredQueryResult } from './queryExecutor'

// Define emptyResult for the steps below.
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

// Call test to run this step.
test('unauthorized v1 requests are rejected before executor invocation', async () => {
  // Define executed for the steps below.
  let executed = false
  // Define response for the steps below.
  const response = await executeStructuredQueryRequest(
    { version: 1, model: 'Project', select: ['name'] },
    { authorized: false, execute: async () => { executed = true; return emptyResult } }
  )
  // Call assert.equal to run this step.
  assert.equal(response.status, 'execution_error')
  // Call assert.equal to run this step.
  assert.equal(executed, false)
  // Call assert.match to run this step.
  assert.match(response.explanation, /not authorized/i)
})

// Call test to run this step.
test('student fields, models, and excluded relationships are privacy restricted', async () => {
  // Repeat the following steps for each item in [ { version: 1, model: 'Project', select: ['name', 'Student.email'] }, { version: 1, model: 'Student.
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
    // Define response for the steps below.
    const response = await executeStructuredQueryRequest(plan, { authorized: true })
    // Call assert.equal to run this step.
    assert.equal(response.status, 'privacy_restricted')
    // Call assert.doesNotMatch to run this step.
    assert.doesNotMatch(response.explanation, /Student\.email|Choices|rank/i)
  }
})

// Call test to run this step.
test('invalid plans return a safe unsupported-capability response', async () => {
  // Define response for the steps below.
  const response = await executeStructuredQueryRequest(
    { version: 1, model: 'Project', select: ['name'], limit: 999999 },
    { authorized: true }
  )
  // Call assert.equal to run this step.
  assert.equal(response.status, 'unsupported_capability')
  // Call assert.match to run this step.
  assert.match(response.explanation, /does not support/i)
  // Call assert.doesNotMatch to run this step.
  assert.doesNotMatch(response.explanation, /stack|Prisma|limit/i)
})

// Call test to run this step.
test('empty valid results are distinct from unsupported requests', async () => {
  // Define response for the steps below.
  const response = await executeStructuredQueryRequest(
    { version: 1, model: 'Project', select: ['name'] },
    { authorized: true, execute: async () => emptyResult }
  )
  // Call assert.equal to run this step.
  assert.equal(response.status, 'no_data')
  // Call assert.ok to run this step.
  assert.ok(response.result)
})

// Call test to run this step.
test('server result bounds are retained and truncation is explicit', async () => {
  // Define result for the steps below.
  const result = {
    ...emptyResult,
    rows: [{ key: '1', values: { name: 'A' } }],
    limit: 1,
    empty: false,
    complete: false,
    hasMore: true,
  }
  // Define response for the steps below.
  const response = await executeStructuredQueryRequest(
    { version: 1, model: 'Project', select: ['name'], limit: 1 },
    { authorized: true, execute: async () => result }
  )
  // Call assert.equal to run this step.
  assert.equal(response.status, 'answer')
  // Call assert.equal to run this step.
  assert.equal(response.result?.hasMore, true)
  // Call assert.equal to run this step.
  assert.equal(response.result?.rows.length, 1)
})

// Call test to run this step.
test('database failures return safe messages without leaking internal details', async () => {
  // Define response for the steps below.
  const response = await executeStructuredQueryRequest(
    { version: 1, model: 'Project', select: ['name'] },
    { authorized: true, execute: async () => { throw new Error('secret schema and DB password') } }
  )
  // Call assert.equal to run this step.
  assert.equal(response.status, 'execution_error')
  // Call assert.doesNotMatch to run this step.
  assert.doesNotMatch(response.explanation, /secret|schema|password/i)
})

// Call test to run this step.
test('legacy enrollment privacy and aggregate suppression remain active', () => {
  // Call assert.throws to run this step.
  assert.throws(
    () => validateAIPlan({ entity: 'enrollments', operation: 'count', filters: { semester: 'SP26', major: 'X', year: 'SENIOR' }, groupBy: 'none' }),
    /cannot combine demographic filters/
  )
  // Call assert.equal to run this step.
  assert.equal(protectAggregateCount(4), null)
  // Call assert.equal to run this step.
  assert.equal(protectAggregateCount(5), 5)
})
