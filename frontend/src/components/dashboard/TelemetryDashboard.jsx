import { creaSezioniGrafici } from '../../utils/chartData.js'
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
} from '../../utils/telemetryFormatters.js'
import { ChartsSection } from './Charts.jsx'
import { AiAdvice, StrategyOverview } from './Advice.jsx'
import { Metric, MetricsSection } from './Metrics.jsx'

function TelemetryDashboard({
  aiAdvice,
  aiError,
  aiLoading,
  laps,
  live,
  onBack,
  onRequestAi,
  session,
}) {
  const labels = laps.map((lap) => `G${lap.lap_number || '-'}`)
  const chartSections = creaSezioniGrafici(laps)
  const latestLap = laps.at(-1) || session?.latest_lap || {}
  const bestLap = bestLapTime(laps)
  const delta = deltaGiro(laps)

  const racePosition = numeroONullo(latestLap.position)
  const tyreTemperature = mediaMappaRuote(latestLap, 'avg_tyre_core_C')
  const brakeTemperature = mediaMappaRuote(latestLap, 'avg_brake_temp_C')

  return (
    <section className="schermata">
      <div className="intestazione-pagina">
        <div>
          <p className="etichetta-sezione">{live ? 'Live' : 'Storico'}</p>
          <h1>{session?.track || 'Sessione'}</h1>
        </div>
        <button type="button" className="azione-secondaria" onClick={onBack}>
          Menu
        </button>
      </div>

      <div className="sezioni-metriche">
        <MetricsSection title="Sessione">
          <Metric label="Giro" value={formattaProgressoGiro(latestLap)} />
          <Metric label="Posizione" value={latestLap.position || '-'} />
        </MetricsSection>

        <MetricsSection title="Distanze">
          <Metric label="Davanti" value={formattaDistacco(distaccoDavantiGara(latestLap.gap_ahead_ms, racePosition))} />
          <Metric label="Dietro" value={formattaDistacco(latestLap.gap_behind_ms)} />
        </MetricsSection>

        <MetricsSection title="Ambiente">
          <Metric label="Aria" value={numeroMetrica(latestLap.air_temp_C, ' C')} />
          <Metric label="Asfalto" value={numeroMetrica(latestLap.road_temp_C, ' C')} />
        </MetricsSection>

        <MetricsSection title="Gomme">
          <Metric label="Temp gomme" value={tyreTemperature === null ? '-' : `${tyreTemperature.toFixed(1)} C`} />
          <Metric label="Stint gomme" value={numeroMetrica(latestLap.tyre_age_laps, '', 0)} />
          <Metric label="Temp freni" value={brakeTemperature === null ? '-' : `${brakeTemperature.toFixed(0)} C`} />
        </MetricsSection>

        <MetricsSection title="Ritmo">
          <Metric label="Giro migliore" value={bestLap ? formattaTempoGiro(bestLap) : '-'} />
          <Metric label="Giro precedente" value={formattaTempoGiro(latestLap.lap_time_ms)} />
          <Metric
            label="Delta prec."
            value={formattaDeltaGiro(delta)}
            tone={delta?.deltaMs > 0 ? 'negativo' : delta?.deltaMs < 0 ? 'positivo' : ''}
          />
        </MetricsSection>
      </div>

      <div className="sezioni-grafici">
        {chartSections.map((section) => (
          <ChartsSection
            key={section.titolo}
            labels={labels}
            section={section}
          />
        ))}
      </div>

      <section className="pannello-consigli">
        <div className="colonna-consigli">
          <div className="intestazione-strategia">
            <div>
              <p className="etichetta-sezione">Conclusioni strategiche</p>
              <p className="testo-strategia-secondario">Stato della vettura e indicazioni per il prossimo giro.</p>
            </div>
          </div>
          <StrategyOverview
            fallbackText="Nessun dato strategico disponibile."
            lap={latestLap}
            tyreTemperature={tyreTemperature}
          />
        </div>

        {live && (
          <div className="colonna-consigli">
            <div className="intestazione-ai">
              <div>
                <p className="etichetta-sezione">Ingegnere AI</p>
                <p className="testo-ai-secondario">Analisi rapida sugli ultimi giri.</p>
              </div>
              <button type="button" className="azione-primaria" disabled={aiLoading} onClick={onRequestAi}>
                {aiLoading ? 'Analisi...' : 'Consiglio AI'}
              </button>
            </div>

            {aiError && <p className="testo-errore errore-compatto">{aiError}</p>}
            {aiAdvice ? <AiAdvice advice={aiAdvice} /> : <p className="testo-ai-secondario">Nessun consiglio richiesto.</p>}
          </div>
        )}
      </section>
    </section>
  )
}

function bestLapTime(laps) {
  const times = laps
    .map((lap) => numeroONullo(lap.lap_time_ms))
    .filter((time) => time !== null && time > 0)

  return times.length ? Math.min(...times) : null
}

export default TelemetryDashboard
