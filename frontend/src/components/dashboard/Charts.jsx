import { useEffect, useRef } from 'react'
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
import { haDati } from '../../utils/chartData.js'

Chart.register(CategoryScale, LinearScale, LineController, LineElement, PointElement, Filler, Tooltip, Legend)
Chart.defaults.font.family = "'Barlow Condensed', 'Arial Narrow', sans-serif"

export function ChartsSection({ labels, section }) {
  return (
    <section className="sezione-grafici">
      <h2>{section.titolo}</h2>
      <div className="griglia-grafici">
        {section.gruppi.map((group) => (
          <ChartPanel key={group.titolo} group={group} labels={labels} />
        ))}
      </div>
    </section>
  )
}

function ChartPanel({ group, labels }) {
  return (
    <article className="pannello-grafico">
      <h2>{group.titolo}</h2>
      <div className="corpo-grafico">
        <LineChart
          datasets={group.datasets.filter(haDati)}
          labels={labels}
          reverseYAxis={group.invertiAsseY}
        />
      </div>
    </article>
  )
}

function LineChart({ datasets, labels, reverseYAxis = false }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || chartRef.current) return undefined

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: { labels: [], datasets: [] },
      options: chartOptions(reverseYAxis),
    })

    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [reverseYAxis])

  useEffect(() => {
    if (!chartRef.current) return

    chartRef.current.data.labels = labels
    chartRef.current.data.datasets = datasets.map((dataset) => ({
      ...dataset,
      borderWidth: 2,
      fill: false,
      pointRadius: 2,
      spanGaps: true,
      tension: 0.35,
    }))
    chartRef.current.update('none')
  }, [datasets, labels])

  return <canvas ref={canvasRef}></canvas>
}

function chartOptions(reverseYAxis) {
  return {
    responsive: true,
    animation: false,
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
        reverse: reverseYAxis,
        ticks: { color: '#a8a8b0' },
        grid: { color: 'rgba(255,255,255,0.08)' },
      },
    },
  }
}
