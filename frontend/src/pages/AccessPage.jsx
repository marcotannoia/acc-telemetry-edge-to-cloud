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
        <p className="etichetta-sezione">ACC-Telemetry</p>
        <h1 className="titolo-principale">Riconoscimento<span> postazione.</span></h1>
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
    <section className={`schermata schermata-accesso ${pilot ? 'schermata-accesso-pilota' : ''}`}>
      <div className="corpo-accesso">
        <div className="hero-accesso">
          <h1 className="titolo-principale">
            {pilot ? 'Collega il tuo ' : 'Accedi ai dati '}
            <span>{pilot ? 'ingegnere.' : 'del pilota.'}</span>
          </h1>
        </div>

        <div className="pannello">
          <h2>{generatedCodes ? 'Codici pronti.' : pilot ? 'Crea i codici.' : 'Entra.'}</h2>

          {generatedCodes ? (
            <div className="codici-generati">
              <p className="testo-informativo">
                Comunica entrambi i codici all’ingegnere di pista.
              </p>
              <CodeField label="Codice postazione" value={generatedCodes.stationCode} readOnly />
              <CodeField label="Codice di accesso" value={generatedCodes.accessCode} readOnly />
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
                {pilot ? 'Genera accesso' : 'Accedi'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}

export default AccessPage
