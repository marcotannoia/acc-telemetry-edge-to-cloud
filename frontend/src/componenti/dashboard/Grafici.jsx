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
import { haDati } from '../../utilita/datiGrafici.js'

Chart.register(CategoryScale, LinearScale, LineController, LineElement, PointElement, Filler, Tooltip, Legend)

export function SezioneGrafici({ etichette, sezione }) {
  return (
    <section className="sezione-grafici">
      <h2>{sezione.titolo}</h2>
      <div className="griglia-grafici">
        {sezione.gruppi.map((gruppo) => (
          <PannelloGrafico key={gruppo.titolo} gruppo={gruppo} etichette={etichette} />
        ))}
      </div>
    </section>
  )
}

function PannelloGrafico({ gruppo, etichette }) {
  return (
    <article className="pannello-grafico">
      <h2>{gruppo.titolo}</h2>
      <div className="corpo-grafico">
        <GraficoLineare
          datasets={gruppo.datasets.filter(haDati)}
          etichette={etichette}
          invertiAsseY={gruppo.invertiAsseY}
        />
      </div>
    </article>
  )
}

function GraficoLineare({ datasets, etichette, invertiAsseY = false }) {
  const riferimentoCanvas = useRef(null)
  const riferimentoGrafico = useRef(null)

  useEffect(() => {
    if (!riferimentoCanvas.current || riferimentoGrafico.current) return undefined

    riferimentoGrafico.current = new Chart(riferimentoCanvas.current, {
      type: 'line',
      data: { labels: [], datasets: [] },
      options: opzioniGrafico(invertiAsseY),
    })

    return () => {
      riferimentoGrafico.current?.destroy()
      riferimentoGrafico.current = null
    }
  }, [invertiAsseY])

  useEffect(() => {
    if (!riferimentoGrafico.current) return

    riferimentoGrafico.current.data.labels = etichette
    riferimentoGrafico.current.data.datasets = datasets.map((dataset) => ({
      ...dataset,
      borderWidth: 2,
      fill: false,
      pointRadius: 2,
      spanGaps: true,
      tension: 0.35,
    }))
    riferimentoGrafico.current.update('none')
  }, [datasets, etichette])

  return <canvas ref={riferimentoCanvas}></canvas>
}

function opzioniGrafico(invertiAsseY) {
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
        reverse: invertiAsseY,
        ticks: { color: '#a8a8b0' },
        grid: { color: 'rgba(255,255,255,0.08)' },
      },
    },
  }
}
