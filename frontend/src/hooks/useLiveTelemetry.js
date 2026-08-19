import { useEffect, useState } from 'react'
import { useDashboardSession } from './useDashboardSession.js'
import { fetchSessionLaps, fetchSessions } from '../services/sessionsApi.js'
import { errorMessage } from '../utils/errorMessage.js'

const LIVE_REFRESH_MS = 5000

export function useLiveTelemetry() {
  const { apiUrl, credentials } = useDashboardSession()
  const [session, setSession] = useState(null)
  const [laps, setLaps] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!credentials) return undefined

    let requestRunning = false
    let activeController = null

    async function updateLiveTelemetry() {
      if (requestRunning) return

      requestRunning = true
      activeController = new AbortController()

      try {
        const sessions = await fetchSessions({
          apiUrl,
          credentials,
          signal: activeController.signal,
        })
        const latestSession = sessions[0]

        if (!latestSession) {
          setSession(null)
          setLaps([])
          setError('Nessuna sessione disponibile')
          return
        }

        const updatedLaps = await fetchSessionLaps({
          apiUrl,
          credentials,
          session: latestSession,
          signal: activeController.signal,
        })

        setSession(latestSession)
        setLaps(updatedLaps)
        setError('')
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setError(errorMessage(requestError))
        }
      } finally {
        requestRunning = false
        if (!activeController?.signal.aborted) setLoading(false)
      }
    }

    updateLiveTelemetry()
    const intervalId = window.setInterval(updateLiveTelemetry, LIVE_REFRESH_MS)

    return () => {
      window.clearInterval(intervalId)
      activeController?.abort()
    }
  }, [apiUrl, credentials])

  return { error, laps, loading, session }
}
