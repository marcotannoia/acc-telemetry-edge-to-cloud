function splitAdvice(text = '') {
  return text
    .split(/\n+|\s+\|\s+/)
    .map((elemento) => elemento.replace(/^[-*]\s*/, '').replace(/\*\*/g, '').trim())
    .filter(Boolean)
}

function adviceByPattern(items, pattern) {
  return items.find((item) => pattern.test(item)) || ''
}

function metricValue(value, suffix, fallbackText) {
  const number = Number(value)
  if (Number.isFinite(number)) return `${number.toFixed(1)} ${suffix}`

  const fallbackValue = fallbackText.match(/-?\d+(?:[.,]\d+)?/)
  return fallbackValue ? `${fallbackValue[0].replace(',', '.')} ${suffix}` : '-'
}

function compactMetricText(text, fallbackText) {
  if (!text) return fallbackText
  return text.replace(/\s*\([^)]*\)\.?$/, '').replace(/\.$/, '')
}

function strategyStatus(pushLevel, warning) {
  const labels = {
    gestisci: 'Ritmo controllato',
    pista_non_pronta: 'Gestisci',
    qualifica_singola: 'Push per un giro',
    raffredda_gomme: 'Raffredda gomme',
    risparmia: 'Risparmia fuel',
    spingi: 'Puoi spingere',
  }

  return labels[pushLevel] || (warning ? 'Attenzione' : 'Situazione stabile')
}

function StrategyMetric({ description, icon, label, value }) {
  return (
    <article className="widget-strategia widget-strategia-metrica">
      <div className="intestazione-widget">
        <span>{label}</span>
        <span className="icona-widget" aria-hidden="true">{icon}</span>
      </div>
      <strong>{value}</strong>
      <p>{description}</p>
    </article>
  )
}

function StrategyDetail({ label, text }) {
  if (!text) return null

  return (
    <article className="widget-strategia widget-strategia-dettaglio">
      <span>{label}</span>
      <p>{text}</p>
    </article>
  )
}

export function StrategyOverview({ fallbackText, lap, tyreTemperature }) {
  const items = splitAdvice(lap?.strategy_advice)
  if (!items.length) return <p className="testo-ai-secondario">{fallbackText}</p>

  const tyre = adviceByPattern(items, /^Temperatura gomme\b/i)
  const fuel = adviceByPattern(items, /^Fuel\b/i)
  const range = adviceByPattern(items, /^Con questo consumo\b/i)
  const track = adviceByPattern(items, /^Pista\b/i)
  const slip = adviceByPattern(items, /^Slip\b/i)
  const tyreTrend = adviceByPattern(items, /^Temperature gomme\b/i)
  const strategy = adviceByPattern(items, /^Strategia:/i)
  const knownItems = new Set([tyre, fuel, range, track, slip, tyreTrend, strategy].filter(Boolean))
  const extraDetails = items.filter((item) => !knownItems.has(item))

  return (
    <div className="sintesi-strategica">
      <article className={`widget-strategia widget-strategia-principale ${lap?.strategy_warning ? 'widget-strategia-avviso' : ''}`}>
        <div>
          <span className="titolo-widget">Indicazione</span>
          <h2>{strategy.replace(/^Strategia:\s*/i, '') || 'Analisi strategica disponibile.'}</h2>
        </div>
        <div className="stato-strategia">
          <span>Stato</span>
          <strong>{strategyStatus(lap?.strategy_push_level, lap?.strategy_warning)}</strong>
        </div>
      </article>

      <div className="griglia-indicatori-strategia">
        <StrategyMetric
          description={compactMetricText(tyre, 'Temperatura non disponibile')}
          icon="°C"
          label="Gomme"
          value={metricValue(tyreTemperature, 'C', tyre)}
        />
        <StrategyMetric
          description={compactMetricText(fuel, 'Livello non disponibile')}
          icon="L"
          label="Carburante"
          value={metricValue(lap?.fuel_left_L, 'L', fuel)}
        />
        <StrategyMetric
          description="Stima sul consumo attuale"
          icon="G"
          label="Autonomia"
          value={metricValue(lap?.fuel_laps_possible, 'giri', range)}
        />
      </div>

      <div className="griglia-dettagli-strategia">
        <StrategyDetail label="Condizioni pista" text={track} />
        <StrategyDetail label="Punto di attenzione" text={slip} />
        <StrategyDetail label="Tendenza gomme" text={tyreTrend} />
        {extraDetails.map((item) => (
          <StrategyDetail key={item} label="Nota strategica" text={item} />
        ))}
      </div>
    </div>
  )
}

export function AiAdvice({ advice }) {
  const generatedAt = advice.generatedAt
  const lapsAnalyzed = advice.lapsAnalyzed
  const text = advice.text || ''
  const generationDate = generatedAt ? new Date(generatedAt).toLocaleString('it-IT') : ''
  const items = splitAdvice(text)

  return (
    <div className="risposta-ai">
      <p className="meta-ai">
        {generationDate}
        {lapsAnalyzed ? ` - ${lapsAnalyzed} giri analizzati` : ''}
      </p>

      {items.length ? (
        <ul className="lista-consigli">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="testo-ai-secondario">Risposta AI vuota.</p>
      )}
    </div>
  )
}
