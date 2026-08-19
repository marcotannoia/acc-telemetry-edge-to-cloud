export function CenteredMessage({ error = false, message, title = 'ACC-Telemetry' }) {
  return (
    <section className="schermata schermata-centrata">
      <h1 className="titolo-principale">{title}</h1>
      <p className={error ? 'testo-errore' : 'sottotitolo-accesso'}>{message}</p>
    </section>
  )
}
