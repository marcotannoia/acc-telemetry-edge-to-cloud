import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CenteredMessage } from '../components/CenteredMessage.jsx'
import TelemetryDashboard from '../components/dashboard/TelemetryDashboard.jsx'
import { useAiEngineer } from '../hooks/useAiEngineer.js'
import { useLiveTelemetry } from '../hooks/useLiveTelemetry.js'

function LivePage() {
  const navigate = useNavigate()
  const { error, laps, loading, session } = useLiveTelemetry()
  const {
    advice,
    error: aiError,
    loading: aiLoading,
    requestAdvice,
    reset: resetAi,
  } = useAiEngineer()

  useEffect(() => {
    resetAi()
  }, [resetAi, session?.session_id])

  if (loading && !session) return <CenteredMessage message="Avvio sessione live..." />
  if (!session) return <CenteredMessage error message={error || 'Nessuna sessione disponibile.'} />

  return (
    <TelemetryDashboard
      aiAdvice={advice}
      aiError={aiError}
      aiLoading={aiLoading}
      laps={laps}
      live
      onBack={() => navigate('/menu')}
      onRequestAi={() => requestAdvice(session)}
      session={session}
    />
  )
}

export default LivePage
