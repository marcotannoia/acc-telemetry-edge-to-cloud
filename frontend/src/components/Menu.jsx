function Menu({ onHistory, onLive }) {
  return (
    <section className="screen hero-screen">
      <h1 className="hero-title">ACC-Telemetry</h1>

      <div className="button-stack">
        <button type="button" className="ghost-action" onClick={onHistory}>
          Lista Sessioni
        </button>
        <button type="button" className="primary-action" onClick={onLive}>
          Sessione Live
        </button>
      </div>
    </section>
  )
}

export default Menu
