function dividiConsigli(testo = '') {
  return testo
    .split(/\n+|\s+\|\s+/)
    .map((elemento) => elemento.replace(/^[-*]\s*/, '').replace(/\*\*/g, '').trim())
    .filter(Boolean)
}

export function ListaConsigli({ testoFallback, testo }) {
  const elementi = dividiConsigli(testo)
  if (!elementi.length) return <p className="testo-ai-secondario">{testoFallback}</p>

  return (
    <ul className="lista-consigli">
      {elementi.map((elemento) => (
        <li key={elemento}>{elemento}</li>
      ))}
    </ul>
  )
}

export function ConsiglioAi({ consiglio }) {
  const generatoIl = consiglio.generatoIl || consiglio.generatedAt
  const giriAnalizzati = consiglio.giriAnalizzati ?? consiglio.lapsAnalyzed
  const testo = consiglio.testo || consiglio.text || ''
  const dataGenerazione = generatoIl ? new Date(generatoIl).toLocaleString('it-IT') : ''
  const elementi = dividiConsigli(testo)

  return (
    <div className="risposta-ai">
      <p className="meta-ai">
        {dataGenerazione}
        {giriAnalizzati ? ` - ${giriAnalizzati} giri analizzati` : ''}
      </p>

      {elementi.length ? (
        <ul className="lista-consigli">
          {elementi.map((elemento) => (
            <li key={elemento}>{elemento}</li>
          ))}
        </ul>
      ) : (
        <p className="testo-ai-secondario">Risposta AI vuota.</p>
      )}
    </div>
  )
}
