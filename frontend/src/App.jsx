import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import Dashboard from './components/Dashboard.jsx'
import Login from './components/Login.jsx'
import Menu from './components/Menu.jsx'
import SessionList from './components/SessionList.jsx'
import { api } from './services/api.js'
import { readRuntimeConfig } from './services/runtimeConfig.js'

function aiStorageKey(sessionId) {
  return `acc-telemetry-ai:${sessionId}`
}

function readStoredAiInsight(session) {
  if (!session?.session_id) return null

  try {
    const saved = window.localStorage.getItem(aiStorageKey(session.session_id))
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

function lapsDataKey(laps) {
  return JSON.stringify((laps || []).map((lap) => ({
    lap_number: lap.lap_number,
    lap_time_ms: lap.lap_time_ms,
    best_time_ms: lap.best_time_ms,
    sector_times_ms: lap.sector_times_ms,
    fuel_left_L: lap.fuel_left_L,
    fuel_consumed_L: lap.fuel_consumed_L,
    fuel_laps_possible: lap.fuel_laps_possible,
    max_speed_kmh: lap.max_speed_kmh,
    min_speed_kmh: lap.min_speed_kmh,
    max_g_force: lap.max_g_force,
    avg_gas_percent: lap.avg_gas_percent,
    avg_brake_percent: lap.avg_brake_percent,
    max_rpm: lap.max_rpm,
    avg_tyre_core_C: lap.avg_tyre_core_C,
    avg_brake_temp_C: lap.avg_brake_temp_C,
    tyre_age_laps: lap.tyre_age_laps,
    remaining_laps: lap.remaining_laps,
    max_slip_by_tyre: lap.max_slip_by_tyre,
    max_slip_by_sector: lap.max_slip_by_sector,
    slip_events_by_sector: lap.slip_events_by_sector,
  })))
}

function App() {
  const [view, setView] = useState('login')
  const [status, setStatus] = useState('Pronto')
  const [config, setConfig] = useState(null)
  const [configError, setConfigError] = useState('')
  const [userId, setUserId] = useState('')
  const [apiUrl, setApiUrl] = useState('')
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [laps, setLaps] = useState([])
  const [liveState, setLiveState] = useState(null)
  const [isLive, setIsLive] = useState(false)
  const [aiInsight, setAiInsight] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const liveStateUnsupportedRef = useRef(false)

  const loadSessions = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setStatus('Carico sessioni')
    const data = await api({ action: 'list_sessions', user_id: userId, limit: 300 }, apiUrl)
    const ordered = [...(data.sessions || [])].sort((a, b) =>
      String(b.last_timestamp || '').localeCompare(String(a.last_timestamp || '')),
    )
    setSessions(ordered)
    if (!silent) setStatus('Sessioni aggiornate')
    return ordered
  }, [apiUrl, userId])

  const loadLaps = useCallback(async (session) => {
    const data = await api({
      action: 'get_session_laps',
      user_id: userId,
      session_id: session.session_id,
      track: session.track,
    }, apiUrl)
    return data.laps || []
  }, [apiUrl, userId])

  const loadLiveState = useCallback(async (session) => {
    if (!session?.session_id || liveStateUnsupportedRef.current) return null

    try {
      const data = await api({
        action: 'get_live_state',
        user_id: userId,
        session_id: session.session_id,
      }, apiUrl)
      return data.live_state || null
    } catch {
      liveStateUnsupportedRef.current = true
      return null
    }
  }, [apiUrl, userId])

  async function openHistory() {
    setIsLive(false)
    setLiveState(null)
    setView('sessions')
    await loadSessions()
  }

  async function openLive() {
    setIsLive(true)
    const ordered = await loadSessions()
    const latest = ordered[0]
    if (!latest) {
      setStatus('Nessuna sessione disponibile')
      return
    }
    setSelectedSession(latest)
    setAiError('')
    setAiInsight(readStoredAiInsight(latest))
    const liveLaps = await loadLaps(latest)
    setLaps(liveLaps)
    setLiveState(await loadLiveState(latest))
    setStatus(`Live avviata - ${liveLaps.length} giri`)
    setView('dashboard')
  }

  async function openSession(session) {
    setIsLive(false)
    setSelectedSession(session)
    setLiveState(null)
    setAiError('')
    setAiInsight(readStoredAiInsight(session))
    setLaps(await loadLaps(session))
    setView('dashboard')
  }

  async function askAiEngineer() {
    if (!selectedSession) return

    setAiLoading(true)
    setAiError('')
    setStatus('Analisi AI in corso')

    try {
      const data = await api({
        action: 'ai_insight',
        user_id: userId,
        session_id: selectedSession.session_id,
        track: selectedSession.track,
        driver: selectedSession.driver,
        limit: 80,
        question: (
          'Analizza gli ultimi giri live. Rispondi con priorita, rischio principale, '
          + 'azione consigliata e dato da monitorare nei prossimi giri.'
        ),
      }, apiUrl)

      const insight = {
        generatedAt: new Date().toISOString(),
        lapsAnalyzed: data.laps_analyzed,
        model: data.model,
        question: data.question,
        text: data.ai_engineer_insight,
      }

      window.localStorage.setItem(aiStorageKey(selectedSession.session_id), JSON.stringify(insight))
      setAiInsight(insight)
      setStatus('Consiglio AI aggiornato')
    } catch (error) {
      setAiError(error.message)
      setStatus('Consiglio AI non disponibile')
    } finally {
      setAiLoading(false)
    }
  }

  useEffect(() => {
    if (!isLive || view !== 'dashboard' || !selectedSession) return undefined

    const timer = window.setInterval(async () => {
      try {
        const ordered = await loadSessions({ silent: true })
        const latestSession = ordered[0] || selectedSession

        if (latestSession.session_id !== selectedSession.session_id) {
          setSelectedSession(latestSession)
          setLiveState(null)
          setAiError('')
          setAiInsight(readStoredAiInsight(latestSession))
        }

        const updatedLaps = await loadLaps(latestSession)
        setLaps((currentLaps) => (
          lapsDataKey(currentLaps) === lapsDataKey(updatedLaps) ? currentLaps : updatedLaps
        ))
        setStatus(`Live aggiornata - ${updatedLaps.length} giri`)
      } catch (error) {
        setStatus(`Live non aggiornata: ${error.message}`)
      }
    }, 5000)

    return () => window.clearInterval(timer)
  }, [isLive, loadLaps, loadSessions, selectedSession, view])

  useEffect(() => {
    if (!isLive || view !== 'dashboard' || !selectedSession) return undefined

    const timer = window.setInterval(async () => {
      try {
        setLiveState(await loadLiveState(selectedSession))
      } catch {
        setLiveState(null)
      }
    }, 1000)

    return () => window.clearInterval(timer)
  }, [isLive, loadLiveState, selectedSession, view])

  const loadConfig = useCallback(async () => {
    try {
      setStatus('Leggo configurazione locale')
      const runtimeConfig = await readRuntimeConfig()
      setConfig(runtimeConfig)
      setConfigError('')
      setUserId(runtimeConfig.userId)
      setApiUrl(runtimeConfig.apiUrl)
      setStatus('Configurazione pronta')
    } catch (error) {
      setConfig(null)
      setConfigError(error.message)
      setStatus('Configurazione mancante')
    }
  }, [])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  function handleLogin() {
    if (!config) return
    setStatus('Login effettuato')
    setView('menu')
  }

  return (
    <main className="app">
      <span className="status-badge">{status}</span>

      {view === 'login' && (
        <Login config={config} error={configError} onLogin={handleLogin} onReload={loadConfig} />
      )}

      {view === 'menu' && <Menu onHistory={openHistory} onLive={openLive} />}

      {view === 'sessions' && (
        <SessionList sessions={sessions} onBack={() => setView('menu')} onOpen={openSession} />
      )}

      {view === 'dashboard' && (
        <Dashboard
          isLive={isLive}
          aiError={aiError}
          aiInsight={aiInsight}
          aiLoading={aiLoading}
          laps={laps}
          liveState={liveState}
          onAskAi={askAiEngineer}
          session={selectedSession}
          onBack={() => setView('menu')}
        />
      )}
    </main>
  )
}

export default App
