export function CenteredMessage({ error = false, message, title = 'ACC-Telemetry' }) {
  return (
    <section className="schermata schermata-centrata">
      <p className="etichetta-sezione">{title}</p>
      <h1 className={error ? 'titolo-messaggio testo-errore' : 'titolo-messaggio'}>{message}</h1>
    </section>
  )
}
