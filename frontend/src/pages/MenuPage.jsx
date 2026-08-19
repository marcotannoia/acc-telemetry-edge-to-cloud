import { useNavigate } from 'react-router-dom'

function MenuPage() {
  const navigate = useNavigate()

  return (
    <section className="schermata schermata-centrata">
      <h1 className="titolo-principale">ACC-Telemetry</h1>

      <div className="pila-bottoni">
        <button type="button" className="azione-secondaria" onClick={() => navigate('/sessions')}>
          Lista Sessioni
        </button>
        <button type="button" className="azione-primaria" onClick={() => navigate('/live')}>
          Sessione Live
        </button>
      </div>
    </section>
  )
}

export default MenuPage
