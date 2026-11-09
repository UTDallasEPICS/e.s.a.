/**
 * GET /api/team-formation/skill-provider
 * Tells the Team Formation page whether the optional Gemini skill tie-break can be switched on
 * (a GEMINI_API_KEY is set on the server) and what the server default is. Never returns the key.
 */
import {geminiModel} from '#server/services/skillFitService'

export default defineEventHandler(() => {
  const geminiAvailable = !!process.env.GEMINI_API_KEY
  const wanted = (process.env.SKILL_TIEBREAK_PROVIDER ?? 'tfidf').toLowerCase()
  return {
    geminiAvailable,
    defaultProvider: geminiAvailable && wanted === 'gemini' ? 'gemini' : 'tfidf',
    model: geminiModel(),
  }
})
