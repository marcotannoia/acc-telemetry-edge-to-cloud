import {
  coloriRuote,
  coloriSettori,
  millisecondiASecondi,
  nomiRuote,
  numeroONullo,
  ruote,
  secondiGiroDaMs,
  settori,
  tempoSettoreMs,
} from './telemetryFormatters.js'

function dataset(giri, campo, etichetta, colore, trasforma = numeroONullo) {
  return {
    label: etichetta,
    borderColor: colore,
    backgroundColor: `${colore}22`,
    data: giri.map((giro) => trasforma(giro[campo])),
  }
}

function datasetRuote(giri, campo, prefissoEtichetta) {
  return ruote.map((ruota) => ({
    label: `${prefissoEtichetta} ${nomiRuote[ruota]}`,
    borderColor: coloriRuote[ruota],
    backgroundColor: `${coloriRuote[ruota]}22`,
    data: giri.map((giro) => numeroONullo(giro?.[campo]?.[ruota])),
  }))
}

export function haDati(dataset) {
  return dataset.data.some((valore) => valore !== null)
}

export function creaSezioniGrafici(giri) {
  return [
    {
      titolo: 'Ritmo',
      gruppi: [
        {
          titolo: 'Tempi giro',
          datasets: [
            dataset(giri, 'lap_time_ms', 'Giro s', '#ef0712', secondiGiroDaMs),
            dataset(giri, 'best_time_ms', 'Migliore s', '#ffffff', secondiGiroDaMs),
          ],
        },
        {
          titolo: 'Settori',
          datasets: settori.map((settore, indice) => ({
            label: `Settore ${settore} s`,
            borderColor: coloriSettori[settore],
            backgroundColor: `${coloriSettori[settore]}22`,
            data: giri.map((giro) => millisecondiASecondi(tempoSettoreMs(giro, indice))),
          })),
        },
      ],
    },
    {
      titolo: 'Auto',
      gruppi: [
        {
          titolo: 'Carburante',
          datasets: [
            dataset(giri, 'fuel_left_L', 'Fuel residuo L', '#ef0712'),
            dataset(giri, 'fuel_consumed_L', 'Fuel consumato L', '#ffffff'),
          ],
        },
        {
          titolo: 'Velocita',
          datasets: [
            dataset(giri, 'max_speed_kmh', 'Max km/h', '#ef0712'),
            dataset(giri, 'min_speed_kmh', 'Min km/h', '#ffffff'),
          ],
        },
        {
          titolo: 'Temperatura gomme',
          datasets: datasetRuote(giri, 'avg_tyre_core_C', 'Core'),
        },
        {
          titolo: 'Temperature freni',
          datasets: datasetRuote(giri, 'avg_brake_temp_C', 'Freno'),
        },
      ],
    },
  ]
    .map((sezione) => ({
      ...sezione,
      gruppi: sezione.gruppi.filter((gruppo) => gruppo.datasets.some(haDati)),
    }))
    .filter((sezione) => sezione.gruppi.length)
}
