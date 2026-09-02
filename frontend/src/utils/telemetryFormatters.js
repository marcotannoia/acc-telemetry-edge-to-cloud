export const ruote = ['fl', 'fr', 'rl', 'rr']
export const settori = ['1', '2', '3']

export const nomiRuote = {
  fl: 'Ant sx',
  fr: 'Ant dx',
  rl: 'Post sx',
  rr: 'Post dx',
}

export const coloriRuote = {
  fl: '#0dd7f2',
  fr: '#ffffff',
  rl: '#74858a',
  rr: '#087f91',
}

export const coloriSettori = {
  1: '#0dd7f2',
  2: '#ffffff',
  3: '#74858a',
}

export function numeroONullo(valore) {
  const numero = Number(valore)
  return Number.isFinite(numero) ? numero : null
}

export function millisecondiASecondi(valore) {
  const numero = numeroONullo(valore)
  return numero !== null && numero > 0 ? numero / 1000 : null
}

export function formattaTempoGiro(ms) {
  const valore = numeroONullo(ms)
  if (valore === null || valore <= 0) return '-'

  const minuti = Math.floor(valore / 60000)
  const secondi = ((valore % 60000) / 1000).toFixed(3).padStart(6, '0')
  return `${minuti}:${secondi}`
}

export function formattaDistacco(valore) {
  const numero = numeroONullo(valore)
  if (numero === null || numero === 0 || Math.abs(numero) >= 2147483647) return '-'
  return (Math.abs(numero) / 1000).toFixed(3)
}

export function distaccoDavantiGara(valore, posizione) {
  const posizioneGara = numeroONullo(posizione)
  return posizioneGara !== null && posizioneGara <= 1 ? null : valore
}

export function secondiGiroDaMs(valore) {
  const secondi = millisecondiASecondi(valore)
  return secondi !== null && secondi > 20 && secondi < 600 ? secondi : null
}

export function tempoSettoreMs(giro, indice) {
  const tempiSettori = giro?.sector_times_ms
  const chiaveSettore = String(indice + 1)
  const valoreGrezzo = Array.isArray(tempiSettori)
    ? tempiSettori[indice]
    : tempiSettori?.[indice] ?? tempiSettori?.[chiaveSettore]
  const valore = numeroONullo(valoreGrezzo)

  return valore !== null && valore > 0 ? valore : null
}

export function mediaMappaRuote(giro, campo, trasforma = numeroONullo) {
  const valori = ruote
    .map((ruota) => trasforma(giro?.[campo]?.[ruota]))
    .filter((valore) => valore !== null)

  return valori.length ? valori.reduce((somma, valore) => somma + valore, 0) / valori.length : null
}

export function numeroMetrica(valore, suffisso = '', decimali = 1) {
  const numero = numeroONullo(valore)
  return numero === null ? '-' : `${numero.toFixed(decimali)}${suffisso}`
}

export function formattaProgressoGiro(giro) {
  const numeroGiro = numeroONullo(giro?.lap_number)
  const totaleGiri = numeroONullo(giro?.number_of_laps)

  if (numeroGiro === null) return '-'
  return totaleGiri && totaleGiri > 0 ? `${numeroGiro} / ${totaleGiri}` : String(numeroGiro)
}

export function deltaGiro(giri) {
  const giriValidi = giri
    .map((giro) => ({ numeroGiro: giro.lap_number, tempo: numeroONullo(giro.lap_time_ms) }))
    .filter((giro) => giro.tempo !== null && giro.tempo > 0)

  if (giriValidi.length < 2) return null

  const attuale = giriValidi.at(-1)
  const precedente = giriValidi.at(-2)

  return {
    deltaMs: attuale.tempo - precedente.tempo,
    numeroGiro: attuale.numeroGiro,
    numeroGiroPrecedente: precedente.numeroGiro,
  }
}

export function formattaDeltaGiro(delta) {
  if (!delta) return '-'

  const secondi = Math.abs(delta.deltaMs) / 1000
  if (delta.deltaMs > 0) return `+${secondi.toFixed(3)} s`
  if (delta.deltaMs < 0) return `-${secondi.toFixed(3)} s`
  return '0.000 s'
}
