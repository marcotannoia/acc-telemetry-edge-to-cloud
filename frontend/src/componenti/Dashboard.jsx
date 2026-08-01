import { creaSezioniGrafici } from '../utilita/datiGrafici.js'
import {
  deltaGiro,
  distaccoDavantiGara,
  formattaDeltaGiro,
  formattaDistacco,
  formattaProgressoGiro,
  formattaTempoGiro,
  mediaMappaRuote,
  numeroMetrica,
  numeroONullo,
} from '../utilita/formatoTelemetria.js'
import { SezioneGrafici } from './dashboard/Grafici.jsx'
import { ConsiglioAi, ListaConsigli } from './dashboard/Consigli.jsx'
import { Metrica, SezioneMetriche } from './dashboard/Metriche.jsx'

function Dashboard({
  caricamentoAi,
  consiglioAi,
  erroreAi,
  giri,
  liveAttivo,
  quandoChiediAi,
  quandoIndietro,
  sessione,
}) {
  const etichette = giri.map((giro) => `G${giro.lap_number || '-'}`)
  const sezioniGrafici = creaSezioniGrafici(giri)
  const ultimoGiro = giri.at(-1) || sessione?.latest_lap || {}
  const migliorGiro = tempoMigliorGiro(giri)
  const delta = deltaGiro(giri)

  const posizioneGara = numeroONullo(ultimoGiro.position)
  const temperaturaGomme = mediaMappaRuote(ultimoGiro, 'avg_tyre_core_C')
  const temperaturaFreni = mediaMappaRuote(ultimoGiro, 'avg_brake_temp_C')

  return (
    <section className="schermata">
      <div className="intestazione-pagina">
        <div>
          <p className="etichetta-sezione">{liveAttivo ? 'Live' : 'Storico'}</p>
          <h1>{sessione?.track || 'Sessione'}</h1>
        </div>
        <button type="button" className="azione-secondaria" onClick={quandoIndietro}>
          Menu
        </button>
      </div>

      <div className="sezioni-metriche">
        <SezioneMetriche titolo="Sessione">
          <Metrica etichetta="Giro" valore={formattaProgressoGiro(ultimoGiro)} />
          <Metrica etichetta="Posizione" valore={ultimoGiro.position || '-'} />
        </SezioneMetriche>

        <SezioneMetriche titolo="Distanze">
          <Metrica etichetta="Davanti" valore={formattaDistacco(distaccoDavantiGara(ultimoGiro.gap_ahead_ms, posizioneGara))} />
          <Metrica etichetta="Dietro" valore={formattaDistacco(ultimoGiro.gap_behind_ms)} />
        </SezioneMetriche>

        <SezioneMetriche titolo="Ambiente">
          <Metrica etichetta="Aria" valore={numeroMetrica(ultimoGiro.air_temp_C, ' C')} />
          <Metrica etichetta="Asfalto" valore={numeroMetrica(ultimoGiro.road_temp_C, ' C')} />
        </SezioneMetriche>

        <SezioneMetriche titolo="Gomme">
          <Metrica etichetta="Temp gomme" valore={temperaturaGomme === null ? '-' : `${temperaturaGomme.toFixed(1)} C`} />
          <Metrica etichetta="Stint gomme" valore={numeroMetrica(ultimoGiro.tyre_age_laps, '', 0)} />
          <Metrica etichetta="Temp freni" valore={temperaturaFreni === null ? '-' : `${temperaturaFreni.toFixed(0)} C`} />
        </SezioneMetriche>

        <SezioneMetriche titolo="Ritmo">
          <Metrica etichetta="Giro migliore" valore={migliorGiro ? formattaTempoGiro(migliorGiro) : '-'} />
          <Metrica etichetta="Giro precedente" valore={formattaTempoGiro(ultimoGiro.lap_time_ms)} />
          <Metrica
            etichetta="Delta prec."
            valore={formattaDeltaGiro(delta)}
            tono={delta?.deltaMs > 0 ? 'negativo' : delta?.deltaMs < 0 ? 'positivo' : ''}
          />
        </SezioneMetriche>
      </div>

      <div className="sezioni-grafici">
        {sezioniGrafici.map((sezione) => (
          <SezioneGrafici
            key={sezione.titolo}
            etichette={etichette}
            sezione={sezione}
          />
        ))}
      </div>

      <section className="pannello-consigli">
        <div className="colonna-consigli">
          <p className="etichetta-sezione">Conclusioni strategiche</p>
          <ListaConsigli testo={ultimoGiro.strategy_advice} testoFallback="Nessun dato strategico disponibile." />
        </div>

        {liveAttivo && (
          <div className="colonna-consigli">
            <div className="intestazione-ai">
              <div>
                <p className="etichetta-sezione">Ingegnere AI</p>
                <p className="testo-ai-secondario">Analisi rapida sugli ultimi giri.</p>
              </div>
              <button type="button" className="azione-primaria" disabled={caricamentoAi} onClick={quandoChiediAi}>
                {caricamentoAi ? 'Analisi...' : 'Consiglio AI'}
              </button>
            </div>

            {erroreAi && <p className="testo-errore errore-compatto">{erroreAi}</p>}
            {consiglioAi ? <ConsiglioAi consiglio={consiglioAi} /> : <p className="testo-ai-secondario">Nessun consiglio richiesto.</p>}
          </div>
        )}
      </section>
    </section>
  )
}

function tempoMigliorGiro(giri) {
  const tempi = giri
    .map((giro) => numeroONullo(giro.lap_time_ms))
    .filter((tempo) => tempo !== null && tempo > 0)

  return tempi.length ? Math.min(...tempi) : null
}

export default Dashboard
