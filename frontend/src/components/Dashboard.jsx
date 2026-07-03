import { useEffect, useRef } from 'react'
import {
  CategoryScale,
  Chart,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
} from 'chart.js'

Chart.register(CategoryScale, LinearScale, LineController, LineElement, PointElement)

function formatLapTime(ms) {
  const value = Number(ms)
  if (!Number.isFinite(value) || value <= 0) return '-'
  const minutes = Math.floor(value / 60000)
  const seconds = ((value % 60000) / 1000).toFixed(3).padStart(6, '0')
  return `${minutes}:${seconds}`
}

function averageTyre(lap) {
  const tyres = lap?.avg_tyre_core_C || {}
  const values = [tyres.fl, tyres.fr, tyres.rl, tyres.rr].map(Number).filter(Number.isFinite)
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function Dashboard({ isLive, laps, session, onBack }) {
  const fuelCanvas = useRef(null)
  const tyreCanvas = useRef(null)

  const lastLap = laps.at(-1) || session?.latest_lap || {}
  const bestLap = laps
    .map((lap) => Number(lap.lap_time_ms))
    .filter((time) => time > 0)
    .sort((a, b) => a - b)[0]
  const tyre = averageTyre(lastLap)

  useEffect(() => {
    const labels = laps.map((lap) => `G${lap.lap_number || '-'}`)
    const fuelChart = new Chart(fuelCanvas.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Fuel residuo',
            data: laps.map((lap) => lap.fuel_left_L),
            borderColor: '#ef0712',
            backgroundColor: 'rgba(239, 7, 18, 0.18)',
            fill: true,
            tension: 0.35,
          },
        ],
      },
      options: chartOptions(),
    })

    const tyreChart = new Chart(tyreCanvas.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Temperatura media gomme',
            data: laps.map(averageTyre),
            borderColor: '#ffffff',
            backgroundColor: 'rgba(255, 255, 255, 0.10)',
            fill: true,
            tension: 0.35,
          },
        ],
      },
      options: chartOptions(),
    })

    return () => {
      fuelChart.destroy()
      tyreChart.destroy()
    }
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

      <div className="metrics">
        <Metric label="Ultimo giro" value={lastLap.lap_number || '-'} />
        <Metric label="Best lap" value={bestLap ? formatLapTime(bestLap) : '-'} />
        <Metric
          label="Fuel"
          value={Number.isFinite(Number(lastLap.fuel_left_L)) ? `${Number(lastLap.fuel_left_L).toFixed(1)} L` : '-'}
        />
        <Metric label="Gomme" value={tyre === null ? '-' : `${tyre.toFixed(1)} C`} />
      </div>

      <div className="chart-grid">
        <article className="chart-panel">
          <h2>Trend carburante</h2>
          <div className="chart-body">
            <canvas ref={fuelCanvas}></canvas>
          </div>
        </article>
        <article className="chart-panel">
          <h2>Temperatura gomme</h2>
          <div className="chart-body">
            <canvas ref={tyreCanvas}></canvas>
          </div>
        </article>
      </div>

      <section className="insight-panel">
        <div>
          <p className="eyebrow">Conclusioni</p>
          <p>{lastLap.strategy_advice || 'Nessun dato sessione disponibile.'}</p>
        </div>
        {isLive && <button className="primary-action">Consiglio AI</button>}
      </section>
    </section>
  )
}

function Metric({ label, value }) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function chartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#fff' } },
    },
    scales: {
      x: { ticks: { color: '#a8a8b0' }, grid: { color: 'rgba(255,255,255,0.08)' } },
      y: { ticks: { color: '#a8a8b0' }, grid: { color: 'rgba(255,255,255,0.08)' } },
    },
  }
}

export default Dashboard
