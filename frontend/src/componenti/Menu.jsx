function Menu({ quandoStorico, quandoLive }) {
  return (
    <section className="schermata schermata-centrata">
      <h1 className="titolo-principale">ACC-Telemetry</h1>

      <div className="pila-bottoni">
        <button type="button" className="azione-secondaria" onClick={quandoStorico}>
          Lista Sessioni
        </button>
        <button type="button" className="azione-primaria" onClick={quandoLive}>
          Sessione Live
        </button>
      </div>
    </section>
  )
}

export default Menu
