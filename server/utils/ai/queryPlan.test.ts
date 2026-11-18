import assert from 'node:assert/strict'
import test from 'node:test'
import { aiSchemaCatalog } from './schemaCatalog'
import { validateQueryPlan, validateStructuredQueryPlan } from './queryPlan'

test('catalog derives approved fields and relationships from generated Prisma metadata', () => {
  assert.deepEqual(Object.keys(aiSchemaCatalog).sort(), ['Partner', 'Project', 'Semester', 'Team'])
  assert.equal(aiSchemaCatalog.Project.fields.repoURL?.type, 'String')
  assert.deepEqual(aiSchemaCatalog.Project.fields.type?.enumValues, ['SOFTWARE', 'HARDWARE', 'BOTH'])
  assert.equal(aiSchemaCatalog.Project.relations.Teams?.target, 'Team')
  assert.equal(aiSchemaCatalog.Project.relations.Teams?.cardinality, 'many')
  assert.equal(aiSchemaCatalog.Team.relations.Semester?.cardinality, 'one')
  assert.equal('Student' in aiSchemaCatalog, false)
  assert.equal('Contact' in aiSchemaCatalog, false)
})

test('structured record query validates typed filters in correlated relation scopes', () => {
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

  assert.equal(plan.model, 'Project')
  assert.deepEqual(plan.select, ['name', 'repoURL', 'Partner.name'])
  assert.equal(plan.limit, 25)
})

test('structured aggregate query validates counts, distinct counts, percentages, sorting and chart choice', () => {
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

  assert.deepEqual(plan.groupBy, ['type'])
  assert.equal(plan.aggregates?.length, 2)
  assert.equal(plan.calculations?.[0]?.alias, 'ratio')
  assert.equal(plan.chartType, 'bar')
})

test('Sankey plans require two dimensions and one aggregate metric', () => {
  const plan = validateStructuredQueryPlan({
    version: 1,
    model: 'Project',
    groupBy: ['type', 'status'],
    aggregates: [{ function: 'count', alias: 'projects' }],
    chartType: 'sankey',
  })
  assert.equal(plan.chartType, 'sankey')
  assert.deepEqual(plan.groupBy, ['type', 'status'])

  assert.throws(() => validateStructuredQueryPlan({
    version: 1,
    model: 'Project',
    groupBy: ['type'],
    aggregates: [{ function: 'count', alias: 'projects' }],
    chartType: 'sankey',
  }))
})

test('catalog-backed validation rejects sensitive models, unapproved joins and invalid value types', () => {
  assert.throws(
    () => validateStructuredQueryPlan({ version: 1, model: 'Student', select: ['email'] }),
    /Model is not approved/
  )
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

test('legacy analytics plans remain valid during the phase 1 transition', () => {
  const plan = validateQueryPlan({
    source: 'projects',
    filters: [],
    dimensions: ['type'],
    metrics: [{ function: 'count', alias: 'count' }],
  })

  assert.equal('source' in plan && plan.source, 'projects')
})
