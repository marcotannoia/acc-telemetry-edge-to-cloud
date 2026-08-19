import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDashboardSession } from '../hooks/useDashboardSession.js'

function CodeField({ label, onChange, readOnly = false, value }) {
  return (
    <label className="campo-accesso">
      <span>{label}</span>
      <input
        autoComplete="off"
        maxLength={32}
        readOnly={readOnly}
        required
        value={value}
        onChange={(event) => onChange?.(event.target.value.toUpperCase())}
      />
    </label>
  )
}

function AccessPage() {
  const navigate = useNavigate()
  const {
    accessError,
    accessLoading,
    accessMode,
    generateAccess,
    generatedCodes,
    loginAsEngineer,
  } = useDashboardSession()
  const [stationCode, setStationCode] = useState('')
  const [accessCode, setAccessCode] = useState('')

  const pilot = accessMode === 'pilot'

  if (accessMode === 'loading') {
    return (
      <section className="schermata schermata-centrata">
        <h1 className="titolo-principale">ACC-Telemetry</h1>
        <p className="sottotitolo-accesso">Riconoscimento della postazione</p>
      </section>
    )
  }

  async function submit(event) {
    event.preventDefault()

    if (pilot) {
      await generateAccess(stationCode)
      return
    }

    const authenticated = await loginAsEngineer(stationCode, accessCode)
    if (authenticated) navigate('/menu')
  }

  return (
    <section className="schermata schermata-centrata">
      <div>
        <h1 className="titolo-principale">ACC-Telemetry</h1>
        <p className="sottotitolo-accesso">
          {pilot ? 'Configura l’accesso dell’ingegnere' : 'Accedi alla telemetria del pilota'}
        </p>
      </div>

      <div className="pannello">
        <p className="etichetta-sezione">{pilot ? 'Postazione pilota' : 'Ingegnere di pista'}</p>
        <h2>{pilot ? 'Crea i codici' : 'Inserisci i codici'}</h2>

        {pilot && !generatedCodes && (
          <p className="testo-informativo">
            Scegli un codice riconoscibile per la postazione. Il sistema genererà il codice di accesso segreto.
          </p>
        )}

        {generatedCodes ? (
          <div className="codici-generati">
            <p className="testo-informativo">
              Comunica entrambi i codici direttamente all’ingegnere. Il codice di accesso viene mostrato ora.
            </p>
            <CodeField label="Codice postazione" value={generatedCodes.stationCode} readOnly />
            <CodeField label="Codice di accesso" value={generatedCodes.accessCode} readOnly />
            <button
              type="button"
              className="azione-primaria azione-piena"
              onClick={() => navigate('/menu')}
            >
              Entra nella dashboard
            </button>
          </div>
        ) : (
          <form className="modulo-accesso" onSubmit={submit}>
            <CodeField label="Codice postazione" value={stationCode} onChange={setStationCode} />

            {!pilot && (
              <CodeField label="Codice di accesso" value={accessCode} onChange={setAccessCode} />
            )}

            {accessError && <p className="testo-errore errore-accesso">{accessError}</p>}

            <button
              type="submit"
              className="azione-primaria azione-piena"
              disabled={accessLoading}
            >
              {pilot ? 'Genera codice di accesso' : 'Accedi alla dashboard'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}

export default AccessPage
