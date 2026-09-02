import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { CenteredMessage } from '../components/CenteredMessage.jsx'
import TelemetryDashboard from '../components/dashboard/TelemetryDashboard.jsx'
import { useSessionLaps } from '../hooks/useSessionLaps.js'
import { useSessions } from '../hooks/useSessions.js'

function SessionPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { sessionId } = useParams()
  const navigationSession = location.state?.session
  const sessionFromNavigation = String(navigationSession?.session_id) === sessionId
    ? navigationSession
    : null
  const {
    error: sessionsError,
    loading: sessionsLoading,
    sessions,
  } = useSessions({ enabled: !sessionFromNavigation })
  const session = sessionFromNavigation
    || sessions.find((item) => String(item.session_id) === sessionId)
  const { error: lapsError, laps, loading: lapsLoading } = useSessionLaps(session)

  if (!session) {
    if (sessionsLoading) return <CenteredMessage message="Caricamento sessione..." />
    if (sessionsError) return <CenteredMessage error message={sessionsError} />
    return <CenteredMessage error message="Sessione non trovata." />
  }

  if (lapsLoading) return <CenteredMessage message="Caricamento giri..." />
  if (lapsError) return <CenteredMessage error message={lapsError} />

  return (
    <TelemetryDashboard
      laps={laps}
      live={false}
      onBack={() => navigate('/menu')}
      session={session}
    />
  )
}

export default SessionPage
