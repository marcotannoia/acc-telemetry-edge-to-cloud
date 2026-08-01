function Accesso({ configurazione, errore, quandoAccesso, quandoRicarica }) {
  return (
    <section className="schermata schermata-centrata">
      <h1 className="titolo-principale">ACC-Telemetry</h1>
      <p className="sottotitolo-principale">Benvenuto, effettua l'accesso.</p>

      <div className="pannello">
        <p className="etichetta-sezione">Benvenuto</p>
        <h2>Accesso</h2>

        {configurazione && (
          <div className="info-configurazione">
            <span>ID utente</span>
            <strong>{configurazione.idUtente}</strong>
            <span>Endpoint API</span>
            <strong>{configurazione.urlApi}</strong>
          </div>
        )}

        {errore && <p className="testo-errore">{errore}</p>}

        <div className="pila-bottoni">
          <button
            type="button"
            className="azione-primaria azione-piena"
            disabled={!configurazione}
            onClick={quandoAccesso}
          >
            Entra
          </button>
          <button type="button" className="azione-secondaria azione-piena" onClick={quandoRicarica}>
            Ricarica configurazione
          </button>
        </div>
      </div>
    </section>
  )
}

export default Accesso
