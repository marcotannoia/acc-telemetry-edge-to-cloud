function SessionList({ sessions, onBack, onOpen }) {
  return (
    <section className="screen">
      <div className="page-head">
        <h1>Lista Sessioni</h1>
        <button type="button" className="ghost-action" onClick={onBack}>
          Menu
        </button>
      </div>

      <div className="session-list">
        {!sessions.length && <p>Nessuna sessione trovata per questo utente.</p>}

        {sessions.map((session) => (
          <button
            type="button"
            className="session-card"
            key={session.session_id}
            onClick={() => onOpen(session)}
          >
            <span>
              <strong>{session.track || 'Pista sconosciuta'}</strong>
              <span>{session.driver || 'Pilota'}</span>
              <span>{session.lap_count || 0} giri</span>
            </span>
            <strong>Apri</strong>
          </button>
        ))}
      </div>
    </section>
  )
}

export default SessionList
