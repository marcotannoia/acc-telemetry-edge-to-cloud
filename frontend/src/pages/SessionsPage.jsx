import { useNavigate } from 'react-router-dom'
import { useSessions } from '../hooks/useSessions.js'

function SessionsPage() {
  const navigate = useNavigate()
  const { error, loading, sessions } = useSessions()

  return (
    <section className="schermata">
      <div className="intestazione-pagina">
        <div>
          <p className="etichetta-sezione">Archivio</p>
          <h1>Sessioni.</h1>
        </div>
        <button type="button" className="azione-secondaria" onClick={() => navigate('/menu')}>
          Menu
        </button>
      </div>

      <div className="lista-sessioni">
        {loading && <p>Caricamento sessioni...</p>}
        {!loading && error && <p className="testo-errore">{error}</p>}
        {!loading && !error && !sessions.length && <p>Nessuna sessione trovata per questo utente.</p>}

        {!loading && sessions.map((session) => (
          <button
            type="button"
            className="scheda-sessione"
            key={session.session_id}
            onClick={() => navigate(`/sessions/${encodeURIComponent(session.session_id)}`, {
              state: { session },
            })}
          >
            <span className="dati-sessione">
              <strong>{session.track || 'Pista sconosciuta'}</strong>
              <span>{session.driver || 'Pilota'} · {session.lap_count || 0} giri</span>
            </span>
            <strong className="apri-sessione">Apri</strong>
          </button>
        ))}
      </div>
    </section>
  )
}

export default SessionsPage
