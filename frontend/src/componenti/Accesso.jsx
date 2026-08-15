import { useState } from 'react'

function CampoCodice({ etichetta, valore, quandoCambia, solaLettura = false }) {
  return (
    <label className="campo-accesso">
      <span>{etichetta}</span>
      <input
        autoComplete="off"
        maxLength={32}
        readOnly={solaLettura}
        required
        value={valore}
        onChange={(evento) => quandoCambia?.(evento.target.value.toUpperCase())}
      />
    </label>
  )
}

function Accesso({
  caricamento,
  codiceGenerato,
  errore,
  modalita,
  quandoAccedi,
  quandoEntraPilota,
  quandoGenera,
}) {
  const [codicePostazione, impostaCodicePostazione] = useState('')
  const [codiceAccesso, impostaCodiceAccesso] = useState('')

  const pilota = modalita === 'pilota'

  if (modalita === 'caricamento') {
    return (
      <section className="schermata schermata-centrata">
        <h1 className="titolo-principale">ACC-Telemetry</h1>
        <p className="sottotitolo-accesso">Riconoscimento della postazione</p>
      </section>
    )
  }

  async function invia(evento) {
    evento.preventDefault()
    if (pilota) {
      await quandoGenera(codicePostazione)
      return
    }
    await quandoAccedi(codicePostazione, codiceAccesso)
  }

  return (
    <section className="schermata schermata-centrata">
      <div>
        <h1 className="titolo-principale">ACC-Telemetry</h1>
        <p className="sottotitolo-accesso">
          {pilota ? 'Configura l’accesso dell’ingegnere' : 'Accedi alla telemetria del pilota'}
        </p>
      </div>

      <div className="pannello">
        <p className="etichetta-sezione">{pilota ? 'Postazione pilota' : 'Ingegnere di pista'}</p>
        <h2>{pilota ? 'Crea i codici' : 'Inserisci i codici'}</h2>

        {pilota && !codiceGenerato && (
          <p className="testo-informativo">
            Scegli un codice riconoscibile per la postazione. Il sistema genererà il codice di accesso segreto.
          </p>
        )}

        {codiceGenerato ? (
          <div className="codici-generati">
            <p className="testo-informativo">
              Comunica entrambi i codici direttamente all’ingegnere. Il codice di accesso viene mostrato ora.
            </p>
            <CampoCodice
              etichetta="Codice postazione"
              valore={codiceGenerato.codicePostazione}
              solaLettura
            />
            <CampoCodice
              etichetta="Codice di accesso"
              valore={codiceGenerato.codiceAccesso}
              solaLettura
            />
            <button
              type="button"
              className="azione-primaria azione-piena"
              onClick={quandoEntraPilota}
            >
              Entra nella dashboard
            </button>
          </div>
        ) : (
          <form className="modulo-accesso" onSubmit={invia}>
            <CampoCodice
              etichetta="Codice postazione"
              valore={codicePostazione}
              quandoCambia={impostaCodicePostazione}
            />

            {!pilota && (
              <CampoCodice
                etichetta="Codice di accesso"
                valore={codiceAccesso}
                quandoCambia={impostaCodiceAccesso}
              />
            )}

            {errore && <p className="testo-errore errore-accesso">{errore}</p>}

            <button
              type="submit"
              className="azione-primaria azione-piena"
              disabled={caricamento}
            >
              {pilota ? 'Genera codice di accesso' : 'Accedi alla dashboard'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}

export default Accesso
