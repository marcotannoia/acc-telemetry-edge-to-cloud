import { accessPayload } from './accessApi.js'
import { postApi } from './apiClient.js'

export async function fetchSessions({ apiUrl, credentials, signal }) {
  const data = await postApi({
    action: 'list_sessions',
    ...accessPayload(credentials),
    limit: 300,
  }, { apiUrl, signal })

  return [...(data.sessions || [])].sort((first, second) =>
    String(second.last_timestamp || '').localeCompare(String(first.last_timestamp || '')),
  )
}

export async function fetchSessionLaps({ apiUrl, credentials, session, signal }) {
  const data = await postApi({
    action: 'get_session_laps',
    ...accessPayload(credentials),
    session_id: session.session_id,
    track: session.track,
  }, { apiUrl, signal })

  return data.laps || []
}
