import { useCallback, useEffect, useState } from 'react'
import { useDashboardSession } from './useDashboardSession.js'
import { fetchSessions } from '../services/sessionsApi.js'
import { errorMessage } from '../utils/errorMessage.js'

export function useSessions({ enabled = true } = {}) {
  const { apiUrl, credentials } = useDashboardSession()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState('')

  const loadSessions = useCallback(async ({ signal } = {}) => {
    if (!enabled || !credentials) return []

    setLoading(true)
    setError('')

    try {
      const loadedSessions = await fetchSessions({ apiUrl, credentials, signal })
      setSessions(loadedSessions)
      return loadedSessions
    } catch (requestError) {
      if (requestError.name === 'AbortError') return []
      setSessions([])
      setError(errorMessage(requestError))
      return []
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [apiUrl, credentials, enabled])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return undefined
    }

    const controller = new AbortController()
    loadSessions({ signal: controller.signal })
    return () => controller.abort()
  }, [enabled, loadSessions])

  return { error, loadSessions, loading, sessions }
}
