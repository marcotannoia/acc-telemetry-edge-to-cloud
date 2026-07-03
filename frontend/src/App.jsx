import { useCallback, useEffect, useState } from 'react'
import './App.css'
import Dashboard from './components/Dashboard.jsx'
import Login from './components/Login.jsx'
import Menu from './components/Menu.jsx'
import SessionList from './components/SessionList.jsx'
import { api } from './services/api.js'
import { readRuntimeConfig } from './services/runtimeConfig.js'

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
  const [isLive, setIsLive] = useState(false)

  const loadSessions = useCallback(async () => {
    setStatus('Carico sessioni')
    const data = await api({ action: 'list_sessions', user_id: userId, limit: 300 }, apiUrl)
    const ordered = [...(data.sessions || [])].sort((a, b) =>
      String(b.last_timestamp || '').localeCompare(String(a.last_timestamp || '')),
    )
    setSessions(ordered)
    setStatus('Sessioni aggiornate')
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

  async function openHistory() {
    setIsLive(false)
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
    setLaps(await loadLaps(latest))
    setView('dashboard')
  }

  async function openSession(session) {
    setIsLive(false)
    setSelectedSession(session)
    setLaps(await loadLaps(session))
    setView('dashboard')
  }

  useEffect(() => {
    if (!isLive || view !== 'dashboard' || !selectedSession) return undefined

    const timer = window.setInterval(async () => {
      const updatedLaps = await loadLaps(selectedSession)
      setLaps(updatedLaps)
      setStatus('Live aggiornata')
    }, 5000)

    return () => window.clearInterval(timer)
  }, [isLive, loadLaps, selectedSession, view])

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
          laps={laps}
          session={selectedSession}
          userId={userId}
          onBack={() => setView('menu')}
        />
      )}
    </main>
  )
}

export default App
