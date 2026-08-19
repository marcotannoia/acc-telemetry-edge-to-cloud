function splitAdvice(text = '') {
  return text
    .split(/\n+|\s+\|\s+/)
    .map((elemento) => elemento.replace(/^[-*]\s*/, '').replace(/\*\*/g, '').trim())
    .filter(Boolean)
}

export function AdviceList({ fallbackText, text }) {
  const items = splitAdvice(text)
  if (!items.length) return <p className="testo-ai-secondario">{fallbackText}</p>

  return (
    <ul className="lista-consigli">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

export function AiAdvice({ advice }) {
  const generatedAt = advice.generatedAt
  const lapsAnalyzed = advice.lapsAnalyzed
  const text = advice.text || ''
  const generationDate = generatedAt ? new Date(generatedAt).toLocaleString('it-IT') : ''
  const items = splitAdvice(text)

  return (
    <div className="risposta-ai">
      <p className="meta-ai">
        {generationDate}
        {lapsAnalyzed ? ` - ${lapsAnalyzed} giri analizzati` : ''}
      </p>

      {items.length ? (
        <ul className="lista-consigli">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="testo-ai-secondario">Risposta AI vuota.</p>
      )}
    </div>
  )
}
