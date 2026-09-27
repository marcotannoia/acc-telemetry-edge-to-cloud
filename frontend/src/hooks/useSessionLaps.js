import { useEffect, useState } from 'react'
import { useDashboardSession } from './useDashboardSession.js'
import { fetchSessionLaps } from '../services/sessionsApi.js'
import { errorMessage } from '../utils/errorMessage.js'

export function useSessionLaps(session) {
  const { apiUrl, credentials } = useDashboardSession()
  const [laps, setLaps] = useState([])
  const [loading, setLoading] = useState(Boolean(session))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session || !credentials) {
      setLaps([])
      setLoading(false)
      return undefined
    }

    const controller = new AbortController()

    async function loadLaps() {
      setLoading(true)
      setError('')

      try {
        const loadedLaps = await fetchSessionLaps({
          apiUrl,
          credentials,
          session,
          signal: controller.signal,
        })
        setLaps(loadedLaps)
      } catch (requestError) {
        if (requestError.name === 'AbortError') return
        setLaps([])
        setError(errorMessage(requestError))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadLaps()
    return () => controller.abort()
  }, [apiUrl, credentials, session])

  return { error, laps, loading }
}
