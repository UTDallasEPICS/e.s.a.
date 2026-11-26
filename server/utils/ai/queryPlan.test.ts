/**
 * Purpose
 * Check the expected behavior of query plan.
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
import { aiSchemaCatalog } from './schemaCatalog'
import { validateQueryPlan, validateStructuredQueryPlan } from './queryPlan'

// Call test to run this step.
test('catalog derives approved fields and relationships from generated Prisma metadata', () => {
  // Call assert.deepEqual to run this step.
  assert.deepEqual(Object.keys(aiSchemaCatalog).sort(), ['Partner', 'Project', 'Semester', 'Team'])
  // Call assert.equal to run this step.
  assert.equal(aiSchemaCatalog.Project.fields.repoURL?.type, 'String')
  // Call assert.deepEqual to run this step.
  assert.deepEqual(aiSchemaCatalog.Project.fields.type?.enumValues, ['SOFTWARE', 'HARDWARE', 'BOTH', 'UNKNOWN'])
  // Call assert.equal to run this step.
  assert.equal(aiSchemaCatalog.Project.relations.Teams?.target, 'Team')
  // Call assert.equal to run this step.
  assert.equal(aiSchemaCatalog.Project.relations.Teams?.cardinality, 'many')
  // Call assert.equal to run this step.
  assert.equal(aiSchemaCatalog.Team.relations.Semester?.cardinality, 'one')
  // Call assert.equal to run this step.
  assert.equal('Student' in aiSchemaCatalog, false)
  // Call assert.equal to run this step.
  assert.equal('Contact' in aiSchemaCatalog, false)
})

// Call test to run this step.
test('structured record query validates typed filters in correlated relation scopes', () => {
  // Use validateStructuredQueryPlan to initialize plan.
  const plan = validateStructuredQueryPlan({
    version: 1,
    model: 'Project',
    select: ['name', 'repoURL', 'Partner.name'],
    where: {
      relation: 'Teams',
      quantifier: 'some',
      where: {
        and: [
          { field: 'meetingDay', operator: 'eq', value: 'WEDNESDAY' },
          {
            relation: 'Semester',
            quantifier: 'is',
            where: {
              and: [
                { field: 'year', operator: 'gte', value: 2025 },
                { field: 'season', operator: 'eq', value: 'FALL' },
              ],
            },
          },
        ],
      },
    },
    orderBy: [{ field: 'name', direction: 'asc' }],
    limit: 25,
  })

  // Call assert.equal to run this step.
  assert.equal(plan.model, 'Project')
  // Call assert.deepEqual to run this step.
  assert.deepEqual(plan.select, ['name', 'repoURL', 'Partner.name'])
  // Call assert.equal to run this step.
  assert.equal(plan.limit, 25)
})

// Call test to run this step.
test('structured aggregate query validates counts, distinct counts, percentages, sorting and chart choice', () => {
  // Use validateStructuredQueryPlan to initialize plan.
  const plan = validateStructuredQueryPlan({
    version: 1,
    model: 'Project',
    groupBy: ['type'],
    aggregates: [
      { function: 'count', alias: 'projects', scope: 'group' },
      { function: 'count', alias: 'allProjects', scope: 'overall' },
    ],
    calculations: [
      { function: 'percentage', numerator: 'projects', denominator: 'allProjects', alias: 'ratio' },
    ],
    orderBy: [{ field: 'projects', direction: 'desc' }],
    chartType: 'bar',
  })

  // Call assert.deepEqual to run this step.
  assert.deepEqual(plan.groupBy, ['type'])
  // Call assert.equal to run this step.
  assert.equal(plan.aggregates?.length, 2)
  // Call assert.equal to run this step.
  assert.equal(plan.calculations?.[0]?.alias, 'ratio')
  // Call assert.equal to run this step.
  assert.equal(plan.chartType, 'bar')
})

// Call test to run this step.
test('Sankey plans require two dimensions and one aggregate metric', () => {
  // Use validateStructuredQueryPlan to initialize plan.
  const plan = validateStructuredQueryPlan({
    version: 1,
    model: 'Project',
    groupBy: ['type', 'status'],
    aggregates: [{ function: 'count', alias: 'projects' }],
    chartType: 'sankey',
  })
  // Call assert.equal to run this step.
  assert.equal(plan.chartType, 'sankey')
  // Call assert.deepEqual to run this step.
  assert.deepEqual(plan.groupBy, ['type', 'status'])

  // Call assert.throws to run this step.
  assert.throws(() => validateStructuredQueryPlan({
    version: 1,
    model: 'Project',
    groupBy: ['type'],
    aggregates: [{ function: 'count', alias: 'projects' }],
    chartType: 'sankey',
  }))
})

// Call test to run this step.
test('catalog-backed validation rejects sensitive models, unapproved joins and invalid value types', () => {
  // Call assert.throws to run this step.
  assert.throws(
    () => validateStructuredQueryPlan({ version: 1, model: 'Student', select: ['email'] }),
    /Model is not approved/
  )
  // Call assert.throws to run this step.
  assert.throws(
    () =>
      validateStructuredQueryPlan({
        version: 1,
        model: 'Project',
        select: ['name'],
        where: {
          relation: 'Choices',
          quantifier: 'some',
          where: { field: 'rank', operator: 'eq', value: 1 },
        },
      }),
    /Relation or quantifier is not approved/
  )
  // Call assert.throws to run this step.
  assert.throws(
    () =>
      validateStructuredQueryPlan({
        version: 1,
        model: 'Project',
        select: ['name'],
        where: { field: 'type', operator: 'eq', value: 'GRADUATE' },
      }),
    /Filter value or operator is not valid/
  )
})

// Call test to run this step.
test('legacy analytics plans remain valid during the phase 1 transition', () => {
  // Use validateQueryPlan to initialize plan.
  const plan = validateQueryPlan({
    source: 'projects',
    filters: [],
    dimensions: ['type'],
    metrics: [{ function: 'count', alias: 'count' }],
  })

  // Call assert.equal to run this step.
  assert.equal('source' in plan && plan.source, 'projects')
})
