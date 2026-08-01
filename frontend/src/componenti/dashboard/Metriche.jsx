export function SezioneMetriche({ children, titolo }) {
  return (
    <section className="sezione-metriche">
      <h2>{titolo}</h2>
      <div className="griglia-metriche">{children}</div>
    </section>
  )
}

export function Metrica({ etichetta, tono = '', valore }) {
  return (
    <article className={`metrica ${tono ? `metrica-${tono}` : ''}`}>
      <span>{etichetta}</span>
      <strong>{valore}</strong>
    </article>
  )
}
