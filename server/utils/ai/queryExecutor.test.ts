/**
 * Purpose
 * Check the expected behavior of query executor.
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
import test, { after } from 'node:test'
import { prisma } from '../prisma'
import {
  executeStructuredQueryPlan,
  StructuredQueryExecutionError,
} from './queryExecutor'

// Call after to run this step.
after(async () => prisma.$disconnect())

// Call test to run this step.
test('record selection, filtering, relation projection, ordering, and limit match direct Prisma reads', async () => {
  // Define plan for the steps below.
  const plan = {
    version: 1,
    model: 'Project',
    select: ['id', 'name', 'Partner.name'],
    where: { field: 'type', operator: 'eq', value: 'SOFTWARE' },
    orderBy: [{ field: 'name', direction: 'asc' }],
    limit: 5,
  } as const
  // Define result for the steps below.
  const result = await executeStructuredQueryPlan(plan)
  // Define direct for the steps below.
  const direct = await prisma.project.findMany({
    where: { type: 'SOFTWARE' },
    select: { id: true, name: true, Partner: { select: { name: true } } },
    orderBy: { name: 'asc' },
    take: 5,
  })

  // Call assert.deepEqual to run this step.
  assert.deepEqual(
    result.rows.map(({ key, values }) => ({ id: key, name: values.name, partner: values['Partner.name'] })),
    direct.map((row) => ({ id: row.id, name: row.name, partner: row.Partner.name }))
  )
  // Call assert.equal to run this step.
  assert.equal(result.kind, 'records')
  // Call assert.equal to run this step.
  assert.equal(result.columns.length, 3)
})

// Call test to run this step.
test('multi-relation filters keep conditions correlated to the same Team and match direct Prisma', async () => {
  // Define plan for the steps below.
  const plan = {
    version: 1,
    model: 'Project',
    select: ['id', 'name'],
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
    orderBy: [{ field: 'id', direction: 'asc' }],
    limit: 100,
  } as const
  // Define result for the steps below.
  const result = await executeStructuredQueryPlan(plan)
  // Define direct for the steps below.
  const direct = await prisma.project.findMany({
    where: {
      Teams: {
        some: {
          AND: [
            { meetingDay: 'WEDNESDAY' },
            { Semester: { is: { year: { gte: 2025 }, season: 'FALL' } } },
          ],
        },
      },
    },
    select: { id: true, name: true },
    orderBy: { id: 'asc' },
    take: 100,
  })

  // Call assert.deepEqual to run this step.
  assert.deepEqual(result.rows.map((row) => row.key), direct.map((row) => row.id))
})

// Call test to run this step.
test('grouped counts, distinct counts, and percentages match direct Prisma record populations', async () => {
  // Define result for the steps below.
  const result = await executeStructuredQueryPlan({
    version: 1,
    model: 'Project',
    groupBy: ['type'],
    aggregates: [
      {
        function: 'count',
        alias: 'completeProjects',
        where: { field: 'status', operator: 'eq', value: 'COMPLETE' },
        scope: 'group',
      },
      { function: 'count', alias: 'allProjects', scope: 'overall' },
      { function: 'countDistinct', field: 'Partner.name', alias: 'partners', scope: 'group' },
    ],
    calculations: [
      { function: 'percentage', numerator: 'completeProjects', denominator: 'allProjects', alias: 'completePercent' },
    ],
    orderBy: [{ field: 'type', direction: 'asc' }],
  })
  // Define direct for the steps below.
  const direct = await prisma.project.findMany({
    select: { id: true, type: true, status: true, Partner: { select: { name: true } } },
  })
  // Define allProjects for the steps below.
  const allProjects = direct.length
  // Use [...new Set(direct.map((row) => row.type))].sort to initialize types.
  const types = [...new Set(direct.map((row) => row.type))].sort()
  // Use types.map to initialize expected.
  const expected = types.map((type) => {
    // Use direct.filter to initialize projects.
    const projects = direct.filter((project) => project.type === type)
    // Define completeProjects for the steps below.
    const completeProjects = projects.filter((project) => project.status === 'COMPLETE').length
    // Pass { type, completeProjects, allProjects, partners: new Set(projects.map((project) => project.Partner.n back to the caller.
    return {
      type,
      completeProjects,
      allProjects,
      partners: new Set(projects.map((project) => project.Partner.name)).size,
      completePercent: allProjects ? (completeProjects / allProjects) * 100 : null,
    }
  })

  // Call assert.deepEqual to run this step.
  assert.deepEqual(
    result.rows.map((row) => row.values),
    expected
  )
  // Call assert.equal to run this step.
  assert.equal(result.kind, 'aggregate')
})

// Call test to run this step.
test('sum, average, minimum, and maximum match direct Prisma semester values', async () => {
  // Define result for the steps below.
  const result = await executeStructuredQueryPlan({
    version: 1,
    model: 'Semester',
    groupBy: ['season'],
    aggregates: [
      { function: 'sum', field: 'year', alias: 'sumYear' },
      { function: 'avg', field: 'year', alias: 'averageYear' },
      { function: 'min', field: 'year', alias: 'minimumYear' },
      { function: 'max', field: 'year', alias: 'maximumYear' },
    ],
    orderBy: [{ field: 'season', direction: 'asc' }],
  })
  // Define direct for the steps below.
  const direct = await prisma.semester.findMany({ select: { season: true, year: true } })
  // Use [...new Set(direct.map((row) => row.season))].sort to initialize seasons.
  const seasons = [...new Set(direct.map((row) => row.season))].sort()
  // Use seasons.map to initialize expected.
  const expected = seasons.map((season) => {
    // Use direct.filter((row) => row.season === season).map to initialize years.
    const years = direct.filter((row) => row.season === season).map((row) => row.year)
    // Pass { season, sumYear: years.reduce((sum, year) => sum + year, 0), averageYear: years.reduce((sum, year) back to the caller.
    return {
      season,
      sumYear: years.reduce((sum, year) => sum + year, 0),
      averageYear: years.reduce((sum, year) => sum + year, 0) / years.length,
      minimumYear: Math.min(...years),
      maximumYear: Math.max(...years),
    }
  })
  // Call assert.deepEqual to run this step.
  assert.deepEqual(result.rows.map((row) => row.values), expected)
})

// Call test to run this step.
test('empty aggregates and zero percentage denominators return safe structured values', async () => {
  // Define result for the steps below.
  const result = await executeStructuredQueryPlan({
    version: 1,
    model: 'Project',
    where: { field: 'id', operator: 'eq', value: '__no_such_project__' },
    aggregates: [
      { function: 'count', alias: 'matches', scope: 'group' },
      { function: 'count', alias: 'total', scope: 'overall' },
    ],
    calculations: [
      { function: 'percentage', numerator: 'matches', denominator: 'total', alias: 'percent' },
    ],
  })
  // Call assert.equal to run this step.
  assert.equal(result.empty, true)
  // Call assert.equal to run this step.
  assert.equal(result.rows[0]?.values.matches, 0)
  // Call assert.equal to run this step.
  assert.equal(result.rows[0]?.values.percent, null)
})

// Call test to run this step.
test('invalid numeric aggregates and invalid limits are rejected before querying', async () => {
  await assert.rejects(
    executeStructuredQueryPlan({
      version: 1,
      model: 'Project',
      aggregates: [{ function: 'sum', field: 'name', alias: 'badSum' }],
    }),
    /Field is not approved for sum|sum requires a numeric field/
  )
  await assert.rejects(
    executeStructuredQueryPlan({ version: 1, model: 'Project', select: ['name'], limit: 101 }),
    /Query limit must be an integer between 1 and 100/
  )
})

// Call test to run this step.
test('result truncation is explicit and excessive grouping is rejected', async () => {
  // Define fakeClient for the steps below.
  const fakeClient = {
    project: {
      async findMany(args: Record<string, unknown>) {
        // Call assert.equal to run this step.
        assert.equal(args.take, 2)
        // Pass [ { id: 'p1', name: 'Project 1' }, { id: 'p2', name: 'Project 2' }, ] back to the caller.
        return [
          { id: 'p1', name: 'Project 1' },
          { id: 'p2', name: 'Project 2' },
        ]
      },
    },
  }
  // Define limited for the steps below.
  const limited = await executeStructuredQueryPlan(
    { version: 1, model: 'Project', select: ['name'], limit: 1 },
    fakeClient
  )
  // Call assert.equal to run this step.
  assert.equal(limited.rows.length, 1)
  // Call assert.equal to run this step.
  assert.equal(limited.complete, false)
  // Call assert.equal to run this step.
  assert.equal(limited.hasMore, true)

  // Define wideFakeClient for the steps below.
  const wideFakeClient = {
    project: {
      async findMany() {
        // Pass Array.from({ length: 501 }, (_, index) => ({ id: `p${index}` })) back to the caller.
        return Array.from({ length: 501 }, (_, index) => ({ id: `p${index}` }))
      },
    },
  }
  await assert.rejects(
    executeStructuredQueryPlan(
      { version: 1, model: 'Project', groupBy: ['id'], aggregates: [{ function: 'count', alias: 'projects' }] },
      wideFakeClient
    ),
    (error: unknown) => error instanceof StructuredQueryExecutionError && error.code === 'GROUP_LIMIT_EXCEEDED'
  )
})
