export function MetricsSection({ children, title }) {
  return (
    <section className="sezione-metriche">
      <h2>{title}</h2>
      <div className="griglia-metriche">{children}</div>
    </section>
  )
}

export function Metric({ label, tone = '', value }) {
  return (
    <article className={`metrica ${tone ? `metrica-${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}
