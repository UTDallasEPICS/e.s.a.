/**
 * Purpose
 * Keep track of report requests and their results for each signed-in user.
 *
 * Inputs
 * - User ID, conversation ID, question, and validated result.
 *
 * Outputs
 * - Recent turns and safe context for the next question.
 *
 * Pseudocode
 * Find the user’s conversation → expire old entries → save the new turn → pick relevant context for the next question.
 */
import { randomUUID } from 'node:crypto'
type Turn = {
  question: string
  plan?: any
  result?: any
  semester?: string
  status: string
  explanation: string
  suggestions?: string[]
  semesterScope?: string[]
}
type Conversation = { userId: string; updatedAt: number; turns: Turn[] }
// Define sessions for the steps below.
const sessions = new Map<string, Conversation>()
// Define ttl for the steps below.
const ttl = 30 * 60 * 1000
// Define the helper that will report conversation.
export function reportConversation(userId: string, requested: unknown) {
  // Use Date.now to initialize now.
  const now = Date.now()
  // Repeat the following steps for each item in sessions.
  for (const [id, session] of sessions) if (now - session.updatedAt > ttl) sessions.delete(id)
  // Define id for the steps below.
  const id =
    typeof requested === 'string' &&
    /^[a-f0-9-]{36}$/i.test(requested) &&
    sessions.get(requested)?.userId === userId
      ? requested
      : randomUUID()
  // Define session for the steps below.
  const session = sessions.get(id) ?? { userId, updatedAt: now, turns: [] }
  // Update session.updatedAt with the value on the right.
  session.updatedAt = now
  // Call sessions.set to run this step.
  sessions.set(id, session)
  // Check whether sessions.size > 200 before running this branch.
  if (sessions.size > 200) sessions.delete(sessions.keys().next().value!)
  // Pass { id, session } back to the caller.
  return { id, session }
}
// Define the helper that will follow up question.
export function followUpQuestion(question: string): boolean {
  // Pass ( /^(?:and\b|also\b|now\b|instead\b|only\b|exclude\b|include\b|remove\b|add\b|sort\b|order\b|top\s+\ back to the caller.
  return (
    /^(?:and\b|also\b|now\b|instead\b|only\b|exclude\b|include\b|remove\b|add\b|sort\b|order\b|top\s+\d|bottom\s+\d|show (?:more|the next|the previous|those|their|that|it)\b|next\b|previous\b|who are (?:they|those)\b|what about\b|make (?:it|that|this)\b|change\b|rename\b|set\b|put\b|use\b|same\b|by\b|yes\b|no\b|open (?:that|their|the)\b|the (?:first|second|third|last)\b)/i.test(
      question.trim()
    ) ||
    /^(?:spring|summer|fall)(?:\s+(?:20)?\d{2})?(?:\s+instead)?[?.!]?$/i.test(question.trim()) ||
    /^(?:pie|bar|line|sankey|donut|doughnut|radar|scatter|bubble)(?:\s+(?:chart|graph))?(?:\s+instead)?[?.!]?$/i.test(
      question.trim()
    )
  )
}
// Define the helper that will safe result context.
export function safeResultContext(turn?: Turn) {
  // Check whether !turn before running this branch.
  if (!turn) return undefined
  // Define allowed for the steps below.
  const allowed = new Set([
    'studentName',
    'project',
    'partner',
    'semester',
    'course',
    'classYear',
    'major',
    'meetingDay',
    'projectType',
    'projectStatus',
  ])
  // Use (turn.result?.columns ?? []).filter to initialize columns.
  const columns = (turn.result?.columns ?? []).filter(
    (c: any) =>
      allowed.has(c.key) ||
      (['metric', 'calculation', 'dimension'].includes(c.role) &&
        !/(email|phone|netid|comments|notes|contact|gender|ethnicity)/i.test(c.key))
  )
  // Pass { question: turn.question, plan: turn.plan, semester: turn.semester, status: turn.status, explanatio back to the caller.
  return {
    question: turn.question,
    plan: turn.plan,
    semester: turn.semester,
    status: turn.status,
    explanation: turn.explanation,
    suggestions: turn.suggestions,
    semesterScope: turn.semesterScope,
    result: {
      columns,
      rows: (turn.result?.rows ?? [])
        .slice(0, 20)
        .map((row: any) => ({
          values: Object.fromEntries(columns.map((c: any) => [c.key, row.values[c.key]])),
        })),
      totalRows: turn.result?.totalRows,
      offset: turn.result?.offset,
      hasMore: turn.result?.hasMore,
    },
  }
}
// Define the helper that will remember report.
export function rememberReport(
  session: Conversation,
  question: string,
  response: any,
  semester?: string
) {
  // Call session.turns.push to run this step.
  session.turns.push({
    question,
    plan: response.plan,
    result: response.result,
    semester,
    status: response.status,
    explanation: response.explanation,
    suggestions: response.suggestions,
    semesterScope: response.semesterScope,
  })
  // Update session.turns with the value on the right.
  session.turns = session.turns.slice(-12)
  // Update session.updatedAt with the value on the right.
  session.updatedAt = Date.now()
}
