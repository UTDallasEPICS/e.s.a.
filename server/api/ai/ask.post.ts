import { requireAdmin } from '../../utils/authz'
import { prisma } from '../../utils/prisma'
import { runAIQuestion, type AskFlowResult } from '../../utils/ai/askFlow'

const seasonPrefixes = { SPRING: 'SP', SUMMER: 'SU', FALL: 'FA' } as const

export default defineEventHandler(async (event) => {
  // Authorization precedes all protected data reads and all planner/executor work.
  await requireAdmin(event)
  const body = await readBody(event)
  if (typeof body?.question !== 'string' || !body.question.trim() || body.question.length > 500) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid question' })
  }

  const selectedSemester = await resolveSelectedSemester(body.selectedSemester)
  const config = useRuntimeConfig(event)
  if (!config.openrouterApiKey) {
    return { status: 'execution_error', explanation: 'AI search is temporarily unavailable.' }
  }

  let flowResult: AskFlowResult | { status: string; explanation: string }
  try {
    flowResult = await runAIQuestion(body.question, selectedSemester, {
      authorized: true,
      requestPlan: async (messages) => {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.openrouterApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'deepseek/deepseek-v4-flash-0731',
            messages,
            temperature: 0,
          }),
        })
        if (!response.ok) throw new Error('Planner request failed')
        const result = await response.json()
        const content = result.choices?.[0]?.message?.content
        if (typeof content !== 'string') throw new Error('Planner response was invalid')
        return content
      },
    })
  } catch {
    return { status: 'execution_error', explanation: 'The database search could not be completed. Please try again.' }
  }

  if (flowResult.kind === 'v1') return flowResult
  if (flowResult.kind === 'legacy') return legacyResponse(flowResult)
  return flowResult
})

function legacyResponse(result: Extract<AskFlowResult, { kind: 'legacy' }>) {
  const { plan, data } = result
  if ('source' in plan) {
    return { success: true, plan: { ...plan, operation: 'analytics' }, data }
  }
  if (plan.entity === 'enrollments') {
    const operation = plan.groupBy === 'major'
      ? 'student_count_by_major'
      : plan.groupBy === 'year'
        ? 'student_count_by_year'
        : 'count_students'
    return { success: true, plan: { ...plan, operation }, data }
  }
  return {
    success: true,
    plan: { ...plan, operation: plan.operation === 'count' ? 'count_projects' : 'search_projects' },
    data,
  }
}

async function resolveSelectedSemester(value: unknown): Promise<string | undefined> {
  if (value === undefined || value === null || value === 'all') return undefined
  if (typeof value !== 'string' || !value.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid selected semester' })
  }
  const candidate = value.trim()
  if (/^(SP|SU|FA)\d{2}$/.test(candidate)) return candidate
  const semester = await prisma.semester.findUnique({
    where: { id: candidate },
    select: { year: true, season: true },
  })
  if (!semester) throw createError({ statusCode: 400, statusMessage: 'Invalid selected semester' })
  return `${seasonPrefixes[semester.season]}${String(semester.year).slice(-2)}`
}
