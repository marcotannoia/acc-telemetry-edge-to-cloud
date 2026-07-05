import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'

Chart.register(CategoryScale, LinearScale, LineController, LineElement, PointElement, Filler, Tooltip, Legend)

// -- PARAMETRI PER I GRAFICI -- 

const wheels = ['fl', 'fr', 'rl', 'rr']
const sectors = ['1', '2', '3']

const wheelNames = {
  fl: 'Ant sx',
  fr: 'Ant dx',
  rl: 'Post sx',
  rr: 'Post dx',
}

const wheelColors = {
  fl: '#ef0712',
  fr: '#ffffff',
  rl: '#8b8b94',
  rr: '#ff5a5f',
}

const sectorColors = {
  1: '#ef0712',
  2: '#ffffff',
  3: '#8b8b94',
}

// -- FUNZIONI DI CONVERSIONI GENERICHE --

function formatLapTime(ms) { // trasforma il tempo del giro in formato leggibile 
  const value = Number(ms)
  if (!Number.isFinite(value) || value <= 0) return '-'
  const minutes = Math.floor(value / 60000) // ottengo i minuti interi
  const seconds = ((value % 60000) / 1000).toFixed(3).padStart(6, '0') // ottengo i secondi
  return `${minutes}:${seconds}`
}

function numberOrNull(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function secondsFromMs(value) {
  const number = numberOrNull(value)
  return number !== null && number > 0 ? number / 1000 : null
}

function lapSecondsFromMs(value) {
  const seconds = secondsFromMs(value)
  return seconds !== null && seconds > 20 && seconds < 600 ? seconds : null
}

function rawSectorTimeMs(lap, index) {
  const sectorTimes = lap?.sector_times_ms
  const sectorKey = String(index + 1)
  const rawValue = Array.isArray(sectorTimes)
    ? sectorTimes[index]
    : sectorTimes?.[index] ?? sectorTimes?.[sectorKey]
  const value = numberOrNull(rawValue)
  return value !== null && value > 0 ? value : null
}

function normalizedSectorTimesMs(lap) {
  const lapTime = numberOrNull(lap?.lap_time_ms)
  const sectorOne = rawSectorTimeMs(lap, 0)
  const sectorTwoRaw = rawSectorTimeMs(lap, 1)
  const sectorThreeRaw = rawSectorTimeMs(lap, 2)

  if (lapTime === null || sectorOne === null || sectorTwoRaw === null) {
    return [sectorOne, sectorTwoRaw, sectorThreeRaw]
  }

  const directSectorThree = lapTime - sectorOne - sectorTwoRaw
  const splitSectorThree = lapTime - sectorTwoRaw
  const sectorTwoLooksLikeSplit = (
    sectorTwoRaw > sectorOne
    && sectorTwoRaw < lapTime
    && (directSectorThree <= 10000 || sectorTwoRaw / lapTime > 0.5 || sectorOne + sectorTwoRaw > lapTime)
  )

  if (sectorTwoLooksLikeSplit) {
    return [
      sectorOne,
      sectorTwoRaw - sectorOne,
      sectorThreeRaw ?? splitSectorThree,
    ].map((value) => (value > 0 ? value : null))
  }

  return [
    sectorOne,
    sectorTwoRaw,
    sectorThreeRaw ?? directSectorThree,
  ].map((value) => (value > 0 ? value : null))
}

function sectorTimeMs(lap, index) {
  return normalizedSectorTimesMs(lap)[index] ?? null
}

function percentFromRatio(value) { // perche gli avg di brake e gas non sono %
  const number = numberOrNull(value)
  return number === null ? null : number * 100
}

function averageWheelMap(lap, field) {
  const values = wheels.map((wheel) => numberOrNull(lap?.[field]?.[wheel])).filter((value) => value !== null)
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function metricNumber(value, suffix = '', digits = 1) {
  const number = numberOrNull(value)
  return number === null ? '-' : `${number.toFixed(digits)}${suffix}`
}

function formatLapProgress(lap) {
  const lapNumber = numberOrNull(lap.lap_number)
  const totalLaps = numberOrNull(lap.number_of_laps)
  if (lapNumber === null) return '-'
  return totalLaps && totalLaps > 0 ? `${lapNumber} / ${totalLaps}` : String(lapNumber)
}

function lapDelta(laps) {
  const validLaps = laps
    .map((lap) => ({
      lapNumber: lap.lap_number,
      time: numberOrNull(lap.lap_time_ms),
    }))
    .filter((lap) => lap.time !== null && lap.time > 0)

  if (validLaps.length < 2) return null

  const current = validLaps.at(-1)
  const previous = validLaps.at(-2)
  return {
    deltaMs: current.time - previous.time,
    lapNumber: current.lapNumber,
    previousLapNumber: previous.lapNumber,
  }
}

function formatLapDelta(delta) {
  if (!delta) return '-'
  const seconds = Math.abs(delta.deltaMs) / 1000
  if (delta.deltaMs > 0) return `+${seconds.toFixed(3)} s`
  if (delta.deltaMs < 0) return `-${seconds.toFixed(3)} s`
  return '0.000 s'
}

function scalarDataset(laps, field, label, color, transform = numberOrNull) {
  return {
    label,
    borderColor: color,
    backgroundColor: `${color}22`,
    data: laps.map((lap) => transform(lap[field])),
  }
}

function wheelDatasets(laps, field, labelPrefix) {
  return wheels.map((wheel) => ({
    label: `${labelPrefix} ${wheelNames[wheel]}`,
    borderColor: wheelColors[wheel],
    backgroundColor: `${wheelColors[wheel]}22`,
    data: laps.map((lap) => numberOrNull(lap?.[field]?.[wheel])),
  }))
}

function sectorDatasets(laps, field, labelPrefix) {
  return sectors.map((sector) => ({
    label: `${labelPrefix} S${sector}`,
    borderColor: sectorColors[sector],
    backgroundColor: `${sectorColors[sector]}22`,
    data: laps.map((lap) => numberOrNull(lap?.[field]?.[sector])),
  }))
}

function hasData(dataset) {
  return dataset.data.some((value) => value !== null)
}

function splitAdvice(text) {
  if (!text) return []
  return text
    .split(/\n+|\s+\|\s+/)
    .map((item) => item.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
}

function cleanMarkdown(text) {
  return text.replace(/\*\*/g, '').replace(/\*/g, '').trim()
}

function parseAiSections(text) {
  const sections = {
    priority: { title: 'Priorita', items: [] },
    risk: { title: 'Rischio principale', items: [] },
    action: { title: 'Azione consigliata', items: [] },
    monitor: { title: 'Monitoraggio', items: [] },
    facts: { title: 'Dati osservati', items: [] },
    notes: { title: 'Ipotesi e note', items: [] },
  }
  let currentKey = 'notes'

  function sectionKey(label) {
    const lowerLabel = label.toLowerCase()
    if (lowerLabel.includes('prior')) return 'priority'
    if (lowerLabel.includes('rischio')) return 'risk'
    if (lowerLabel.includes('azione')) return 'action'
    if (lowerLabel.includes('monitor') || lowerLabel.includes('dato da monitorare')) return 'monitor'
    if (lowerLabel.includes('fatto') || lowerLabel.includes('osserv')) return 'facts'
    if (lowerLabel.includes('ipotes') || lowerLabel.includes('secondario')) return 'notes'
    return ''
  }

  splitAdvice(text).forEach((rawItem) => {
    const item = rawItem.trim()
    const match = item.match(/^\*{0,2}([^:*]+):\*{0,2}\s*(.*)$/)
    const label = cleanMarkdown(match?.[1] || '')
    const body = cleanMarkdown(match?.[2] || item)
    const key = sectionKey(label) || sectionKey(body)

    if (key && !match && body.length < 42 && !/[.!?]/.test(body)) {
      currentKey = key
      return
    }

    if (key && body.toLowerCase() === cleanMarkdown(label).toLowerCase()) {
      currentKey = key
      return
    }

    if (key && match) {
      currentKey = key
      if (body) sections[key].items.push(body)
      return
    }

    if (body) sections[currentKey].items.push(body)
  })

  return Object.values(sections).filter((section) => section.items.length)
}

function Dashboard({
  aiError,
  aiInsight,
  aiLoading,
  isLive,
  laps,
  onAskAi,
  onBack,
  session,
}) {
  const [expandedChart, setExpandedChart] = useState(null)
  const labels = useMemo(() => laps.map((lap) => `G${lap.lap_number || '-'}`), [laps])
  const lastLap = laps.at(-1) || session?.latest_lap || {}
  const bestLap = laps
    .map((lap) => Number(lap.lap_time_ms))
    .filter((time) => time > 0)
    .sort((a, b) => a - b)[0]

  const tyreCore = averageWheelMap(lastLap, 'avg_tyre_core_C')
  const brakeTemp = averageWheelMap(lastLap, 'avg_brake_temp_C')
  const delta = lapDelta(laps)

  const chartSections = useMemo(() => {
    const sections = [
      {
        title: 'Ritmo',
        groups: [
          {
            title: 'Tempi giro',
            datasets: [
              scalarDataset(laps, 'lap_time_ms', 'Giro s', '#ef0712', lapSecondsFromMs),
              scalarDataset(laps, 'best_time_ms', 'Migliore s', '#ffffff', lapSecondsFromMs),
            ],
          },
          {
            title: 'Settori',
            datasets: sectors.map((sector, index) => ({
              label: `Settore ${sector} s`,
              borderColor: sectorColors[sector],
              backgroundColor: `${sectorColors[sector]}22`,
              data: laps.map((lap) => secondsFromMs(sectorTimeMs(lap, index))),
            })),
          },
        ],
      },
      {
        title: 'Carburante e guida',
        groups: [
          {
            title: 'Carburante',
            datasets: [
              scalarDataset(laps, 'fuel_left_L', 'Fuel residuo L', '#ef0712'),
              scalarDataset(laps, 'fuel_consumed_L', 'Fuel consumato L', '#ffffff'),
              scalarDataset(laps, 'fuel_laps_possible', 'Giri possibili', '#8b8b94'),
            ],
          },
          {
            title: 'Velocita',
            datasets: [
              scalarDataset(laps, 'max_speed_kmh', 'Max km/h', '#ef0712'),
              scalarDataset(laps, 'min_speed_kmh', 'Min km/h', '#ffffff'),
            ],
          },
          {
            title: 'G-force',
            datasets: [scalarDataset(laps, 'max_g_force', 'Max G', '#ef0712')],
          },
          {
            title: 'Pedali e RPM',
            datasets: [
              scalarDataset(laps, 'avg_gas_percent', 'Gas medio %', '#ef0712', percentFromRatio),
              scalarDataset(laps, 'avg_brake_percent', 'Freno medio %', '#ffffff', percentFromRatio),
              scalarDataset(laps, 'max_rpm', 'RPM max / 1000', '#8b8b94', (value) => {
                const rpm = numberOrNull(value)
                return rpm === null ? null : rpm / 1000
              }),
            ],
          },
        ],
      },
      {
        title: 'Gomme e freni',
        groups: [
          {
            title: 'Temperatura gomme',
            datasets: wheelDatasets(laps, 'avg_tyre_core_C', 'Core'),
          },
          {
            title: 'Temperature freni',
            datasets: wheelDatasets(laps, 'avg_brake_temp_C', 'Freno'),
          },
          {
            title: 'Stint gomme',
            datasets: [
              scalarDataset(laps, 'tyre_age_laps', 'Giri gomme', '#ef0712'),
              scalarDataset(laps, 'remaining_laps', 'Giri rimanenti', '#ffffff'),
            ],
          },
        ],
      },
      {
        title: 'Slip',
        groups: [
          {
            title: 'Slip gomme',
            datasets: wheelDatasets(laps, 'max_slip_by_tyre', 'Slip'),
          },
          {
            title: 'Slip per settore',
            datasets: sectorDatasets(laps, 'max_slip_by_sector', 'Max slip'),
          },
          {
            title: 'Eventi slip',
            datasets: sectorDatasets(laps, 'slip_events_by_sector', 'Eventi'),
          },
        ],
      },
    ]

    return sections
      .map((section) => ({
        ...section,
        groups: section.groups.filter((group) => group.datasets.some(hasData)),
      }))
      .filter((section) => section.groups.length)
  }, [laps])

  return (
    <section className="screen">
      <div className="page-head">
        <div>
          <p className="eyebrow">{isLive ? 'Live' : 'Storico'}</p>
          <h1>{session?.track || 'Sessione'}</h1>
        </div>
        <button type="button" className="ghost-action" onClick={onBack}>
          Menu
        </button>
      </div>

      <div className="metric-sections">
        <MetricSection title="Sessione">
          <Metric label="Giro" value={formatLapProgress(lastLap)} />
          <Metric label="Posizione" value={lastLap.position || '-'} />
        </MetricSection>

        <MetricSection title="Ambiente">
          <Metric label="Aria" value={metricNumber(lastLap.air_temp_C, ' C')} />
          <Metric label="Asfalto" value={metricNumber(lastLap.road_temp_C, ' C')} />
        </MetricSection>

        <MetricSection title="Gomme">
          <Metric label="Temp gomme" value={tyreCore === null ? '-' : `${tyreCore.toFixed(1)} C`} />
          <Metric label="Stint gomme" value={metricNumber(lastLap.tyre_age_laps, '', 0)} />
          <Metric label="Temp freni" value={brakeTemp === null ? '-' : `${brakeTemp.toFixed(0)} C`} />
        </MetricSection>

        <MetricSection title="Ritmo">
          <Metric label="Giro migliore" value={bestLap ? formatLapTime(bestLap) : '-'} />
          <Metric label="Giro precedente" value={formatLapTime(lastLap.lap_time_ms)} />
          <Metric
            label="Delta prec."
            value={formatLapDelta(delta)}
            tone={delta?.deltaMs > 0 ? 'bad' : delta?.deltaMs < 0 ? 'good' : ''}
          />
        </MetricSection>
      </div>

      <div className="chart-sections">
        {chartSections.map((section) => (
          <ChartSection
            key={section.title}
            labels={labels}
            section={section}
            onExpand={(group) => setExpandedChart(group)}
          />
        ))}
      </div>

      <section className="insight-panel">
        <div className="insight-column">
          <p className="eyebrow">Conclusioni strategiche</p>
          <AdviceList text={lastLap.strategy_advice} fallback="Nessun dato strategico disponibile." />
        </div>

        {isLive && (
          <div className="insight-column">
            <div className="ai-head">
              <div>
                <p className="eyebrow">Ingegnere AI</p>
                <p className="ai-muted">Il consiglio resta salvato durante gli aggiornamenti live.</p>
              </div>
              <button type="button" className="primary-action" disabled={aiLoading} onClick={onAskAi}>
                {aiLoading ? 'Analisi...' : 'Consiglio AI'}
              </button>
            </div>

            {aiError && <p className="error-text compact-error">{aiError}</p>}
            {aiInsight ? <AiInsight insight={aiInsight} /> : <p className="ai-muted">Nessun consiglio richiesto.</p>}
          </div>
        )}
      </section>

      {expandedChart && (
        <div className="chart-modal" role="dialog" aria-modal="true" aria-label={expandedChart.title}>
          <article className="chart-modal-panel">
            <div className="chart-modal-head">
              <h2>{expandedChart.title}</h2>
              <button type="button" className="ghost-action close-action" onClick={() => setExpandedChart(null)}>
                Chiudi
              </button>
            </div>
            <div className="chart-body chart-body-expanded">
              <LineChart
                datasets={expandedChart.datasets.filter(hasData)}
                labels={labels}
                reverseY={expandedChart.reverseY}
              />
            </div>
          </article>
        </div>
      )}
    </section>
  )
}

function MetricSection({ children, title }) {
  return (
    <section className="metric-section">
      <h2>{title}</h2>
      <div className="metric-grid">{children}</div>
    </section>
  )
}

function Metric({ label, tone, value }) {
  return (
    <article className={`metric ${tone ? `metric-${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function ChartSection({ labels, onExpand, section }) {
  return (
    <section className="chart-section">
      <h2>{section.title}</h2>
      <div className="chart-grid">
        {section.groups.map((group) => (
          <ChartPanel key={group.title} group={group} labels={labels} onExpand={() => onExpand(group)} />
        ))}
      </div>
    </section>
  )
}

function ChartPanel({ group, labels, onExpand }) {
  return (
    <article className="chart-panel">
      <h2>{group.title}</h2>
      <div className="chart-body">
        <LineChart datasets={group.datasets.filter(hasData)} labels={labels} reverseY={group.reverseY} />
      </div>
      <button type="button" className="expand-action" aria-label={`Ingrandisci ${group.title}`} onClick={onExpand}>
        <span className="expand-glyph" aria-hidden="true"></span>
      </button>
    </article>
  )
}

function LineChart({ datasets, labels, reverseY = false }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current) return undefined

    const chart = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: datasets.map((dataset) => ({
          ...dataset,
          borderWidth: 2,
          fill: false,
          pointRadius: 2,
          spanGaps: true,
          tension: 0.35,
        })),
      },
      options: chartOptions(reverseY),
    })

    return () => chart.destroy()
  }, [datasets, labels, reverseY])

  return <canvas ref={canvasRef}></canvas>
}

function AdviceList({ fallback, text }) {
  const items = splitAdvice(text)
  if (!items.length) return <p className="ai-muted">{fallback}</p>

  return (
    <ul className="advice-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

function AiInsight({ insight }) {
  const generatedAt = insight.generatedAt ? new Date(insight.generatedAt).toLocaleString('it-IT') : ''
  const sections = parseAiSections(insight.text)

  return (
    <div className="ai-answer">
      <p className="ai-meta">
        {generatedAt}
        {insight.lapsAnalyzed ? ` - ${insight.lapsAnalyzed} giri analizzati` : ''}
      </p>
      {sections.length ? (
        <div className="ai-section-grid">
          {sections.map((section) => (
            <article className="ai-section" key={section.title}>
              <h3>{section.title}</h3>
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      ) : (
        <p className="ai-muted">Risposta AI vuota.</p>
      )}
    </div>
  )
}

function chartOptions(reverseY) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#fff', boxWidth: 14 } },
      tooltip: { intersect: false, mode: 'index' },
    },
    scales: {
      x: {
        ticks: { color: '#a8a8b0' },
        grid: { color: 'rgba(255,255,255,0.08)' },
      },
      y: {
        reverse: reverseY,
        ticks: { color: '#a8a8b0' },
        grid: { color: 'rgba(255,255,255,0.08)' },
      },
    },
  }
}

export default Dashboard
