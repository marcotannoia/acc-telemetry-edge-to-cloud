import { useCallback, useEffect, useRef, useState } from 'react'
import { useDashboardSession } from './useDashboardSession.js'
import { fetchAiAdvice } from '../services/aiApi.js'
import { errorMessage } from '../utils/errorMessage.js'

export function useAiEngineer() {
  const { apiUrl, credentials } = useDashboardSession()
  const controllerRef = useRef(null)
  const [advice, setAdvice] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const reset = useCallback(() => {
    controllerRef.current?.abort()
    setAdvice(null)
    setError('')
    setLoading(false)
  }, [])

  const requestAdvice = useCallback(async (session) => {
    if (!session || !credentials) return

    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setLoading(true)
    setError('')

    try {
      const data = await fetchAiAdvice({
        apiUrl,
        credentials,
        session,
        signal: controller.signal,
      })

      setAdvice({
        generatedAt: new Date().toISOString(),
        lapsAnalyzed: data.laps_analyzed,
        model: data.model,
        question: data.question,
        text: data.ai_engineer_insight,
      })
    } catch (requestError) {
      if (requestError.name !== 'AbortError') {
        setError(errorMessage(requestError))
      }
    } finally {
      if (controllerRef.current === controller && !controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [apiUrl, credentials])

  useEffect(() => () => controllerRef.current?.abort(), [])

  return { advice, error, loading, requestAdvice, reset }
}
