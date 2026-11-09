/**
 * POST /api/team-formation/gemini-test
 * Makes one tiny real call to Gemini so staff can check the key and model name work before a run.
 * Returns {ok, model, message, ms?}. Never returns the key. Writes nothing.
 */
import {testGemini} from '#server/services/skillFitService'

export default defineEventHandler(async () => testGemini())
