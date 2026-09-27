import { accessPayload } from './accessApi.js'
import { postApi } from './apiClient.js'

const AI_QUESTION = (
  'Analizza gli ultimi giri live. Rispondi con priorita, rischio principale, '
  + 'azione consigliata e dato da monitorare nei prossimi giri.'
)

export async function fetchAiAdvice({ apiUrl, credentials, session, signal }) {
  return postApi({
    action: 'ai_insight',
    ...accessPayload(credentials),
    session_id: session.session_id,
    track: session.track,
    driver: session.driver,
    limit: 80,
    question: AI_QUESTION,
  }, { apiUrl, signal })
}
