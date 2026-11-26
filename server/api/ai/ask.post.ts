/**
 * Purpose
 * Handle an administrator’s question about ESA records.
 *
 * Inputs
 * - The signed-in session, question, selected semester, browser workspace, and conversation ID.
 *
 * Outputs
 * - A report, clarification, or error response.
 *
 * Pseudocode
 * Check access → validate the workspace → interpret the question → calculate an answer → remember the turn.
 */
import { requireAdmin } from '../../utils/authz'
import { prisma } from '../../utils/prisma'
import { localRefinement, localLookup, cachedReportPlan } from '../../utils/ai/reportPlanCacheAndShortcuts'
import { loadReportData, withReportData } from '../../utils/ai/academicReportData'
import {
  reportConversation,
  followUpQuestion,
  safeResultContext,
  rememberReport,
} from '../../utils/ai/academicReportConversation'
import { runAcademicQuestion } from '../../utils/ai/academicReport'
import type { AskFlowResult } from '../../utils/ai/askFlow'

// Define seasonPrefixes for the steps below.
const seasonPrefixes = { SPRING: 'SP', SUMMER: 'SU', FALL: 'FA' } as const

export default defineEventHandler(async (event) => {
  // Authorization precedes all protected data reads and all planner/executor work.
  const startedAt = Date.now()
  // Define session for the steps below.
  const session = await requireAdmin(event)
  // Define body for the steps below.
  const body = await readBody(event)
  // Check whether typeof body?.question !== 'string' || !body.question.trim() || body.question.length > 4000 before running this branch.
  if (typeof body?.question !== 'string' || !body.question.trim() || body.question.length > 4000) {
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({ statusCode: 400, statusMessage: 'Invalid question' })
  }

  // Define selectedSemester for the steps below.
  const selectedSemester = await resolveSelectedSemester(body.selectedSemester)
  // Use useRuntimeConfig to initialize config.
  const config = useRuntimeConfig(event)
  // Check whether !config.openrouterApiKey before running this branch.
  if (!config.openrouterApiKey) {
    // Pass { status: 'execution_error', explanation: 'AI is not connected. Add NUXT_OPENROUTER_API_KEY to the l back to the caller.
    return {
      status: 'execution_error',
      explanation:
        'AI is not connected. Add NUXT_OPENROUTER_API_KEY to the local .env file and restart the app.',
    }
  }

  // Define data for the steps below.
  let data
  try {
    // Update data with the value on the right.
    data = await loadReportData(body.workspace)
  } catch {
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({
      statusCode: 400,
      statusMessage: 'The current workspace records could not be validated. Reload and try again.',
    })
  }
  // Use reportConversation to initialize conversation.
  const conversation = reportConversation(session.user.id, body.conversationId)
  // Use conversation.session.turns.at to initialize last.
  const last = conversation.session.turns.at(-1)
  // Use conversation.session.turns.findLast to initialize lastAnswer.
  const lastAnswer = conversation.session.turns.findLast((turn) => turn.plan && turn.result)
  // Define previousQuestion for the steps below.
  const previousQuestion =
    last && followUpQuestion(body.question)
      ? last.question
      : typeof body.previousQuestion === 'string'
        ? body.previousQuestion.slice(0, 4000)
        : undefined
  // Define flowResult for the steps below.
  let flowResult: any
  try {
    // Update flowResult with the value on the right.
    flowResult = await withReportData(data, () =>
      runAcademicQuestion(body.question, selectedSemester, {
        authorized: true,
        localPlan: (previous, question) =>
          localRefinement(previous, question) ?? localLookup(question),
        previousQuestion,
        previousPlan: last?.plan ?? lastAnswer?.plan,
        previousScope: last?.semesterScope ?? lastAnswer?.semesterScope,
        resultContext: safeResultContext(last),
        history: conversation.session.turns
          .slice(-8)
          .map((turn) => ({
            question: turn.question,
            status: turn.status,
            semester: turn.semester,
          })),
        requestPlan: async (messages) =>
          cachedReportPlan(session.user.id, config.openrouterModel, messages, async () => {
            // Define response for the steps below.
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              signal: AbortSignal.timeout(45_000),
              headers: {
                Authorization: `Bearer ${config.openrouterApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: config.openrouterModel,
                max_tokens: 4000,
                reasoning: { enabled: false },
                response_format: { type: 'json_object' },
                messages,
                temperature: 0,
              }),
            })
            // Check whether !response.ok before running this branch.
            if (!response.ok) throw new Error('Planner request failed')
            // Define result for the steps below.
            const result = await response.json()
            // Define content for the steps below.
            const content = result.choices?.[0]?.message?.content
            // Check whether typeof content !== 'string' before running this branch.
            if (typeof content !== 'string') throw new Error('Planner response was invalid')
            // Pass content back to the caller.
            return content
          }),
      })
    )
  } catch {
    // Pass { status: 'execution_error', explanation: 'The database search could not be completed. Please try ag back to the caller.
    return {
      status: 'execution_error',
      explanation: 'The database search could not be completed. Please try again.',
    }
  }

  // Call rememberReport to run this step.
  rememberReport(conversation.session, body.question, flowResult, selectedSemester)
  // Update flowResult.conversationId with the value on the right.
  flowResult.conversationId = conversation.id
  // Update flowResult.durationMs with the value on the right.
  flowResult.durationMs = Date.now() - startedAt
  // Check whether flowResult.kind === 'v1' before running this branch.
  if (flowResult.kind === 'v1') return flowResult
  // Check whether flowResult.kind === 'legacy' before running this branch.
  if (flowResult.kind === 'legacy') return legacyResponse(flowResult)
  // Pass flowResult back to the caller.
  return flowResult
})

// Define the helper that will legacy response.
function legacyResponse(result: Extract<AskFlowResult, { kind: 'legacy' }>) {
  // Define { plan, data } for the steps below.
  const { plan, data } = result
  // Check whether 'source' in plan before running this branch.
  if ('source' in plan) {
    // Pass { success: true, plan: { ...plan, operation: 'analytics' }, data } back to the caller.
    return { success: true, plan: { ...plan, operation: 'analytics' }, data }
  }
  // Check whether plan.entity === 'enrollments' before running this branch.
  if (plan.entity === 'enrollments') {
    // Define operation for the steps below.
    const operation =
      plan.groupBy === 'major'
        ? 'student_count_by_major'
        : plan.groupBy === 'year'
          ? 'student_count_by_year'
          : 'count_students'
    // Pass { success: true, plan: { ...plan, operation }, data } back to the caller.
    return { success: true, plan: { ...plan, operation }, data }
  }
  // Pass { success: true, plan: { ...plan, operation: plan.operation === 'count' ? 'count_projects' : 'search back to the caller.
  return {
    success: true,
    plan: { ...plan, operation: plan.operation === 'count' ? 'count_projects' : 'search_projects' },
    data,
  }
}

// Define the helper that will resolve selected semester.
async function resolveSelectedSemester(value: unknown): Promise<string | undefined> {
  // Check whether value === undefined || value === null || value === 'all' before running this branch.
  if (value === undefined || value === null || value === 'all') return undefined
  // Check whether typeof value !== 'string' || !value.trim() before running this branch.
  if (typeof value !== 'string' || !value.trim()) {
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({ statusCode: 400, statusMessage: 'Invalid selected semester' })
  }
  // Use value.trim to initialize candidate.
  const candidate = value.trim()
  // Check whether /^(SP|SU|FA)\d{2}$/.test(candidate) before running this branch.
  if (/^(SP|SU|FA)\d{2}$/.test(candidate)) return candidate
  // Define semester for the steps below.
  const semester = await prisma.semester.findUnique({
    where: { id: candidate },
    select: { year: true, season: true },
  })
  // Check whether !semester before running this branch.
  if (!semester) throw createError({ statusCode: 400, statusMessage: 'Invalid selected semester' })
  // Pass `${seasonPrefixes[semester.season]}${String(semester.year).slice(-2)}` back to the caller.
  return `${seasonPrefixes[semester.season]}${String(semester.year).slice(-2)}`
}
