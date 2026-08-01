function ListaSessioni({ sessioni, quandoIndietro, quandoApri }) {
  return (
    <section className="schermata">
      <div className="intestazione-pagina">
        <h1>Lista Sessioni</h1>
        <button type="button" className="azione-secondaria" onClick={quandoIndietro}>
          Menu
        </button>
      </div>

      <div className="lista-sessioni">
        {!sessioni.length && <p>Nessuna sessione trovata per questo utente.</p>}

        {sessioni.map((sessione) => (
          <button
            type="button"
            className="scheda-sessione"
            key={sessione.session_id}
            onClick={() => quandoApri(sessione)}
          >
            <span>
              <strong>{sessione.track || 'Pista sconosciuta'}</strong>
              <span>{sessione.driver || 'Pilota'}</span>
              <span>{sessione.lap_count || 0} giri</span>
            </span>
            <strong>Apri</strong>
          </button>
        ))}
      </div>
    </section>
  )
}

export default ListaSessioni
