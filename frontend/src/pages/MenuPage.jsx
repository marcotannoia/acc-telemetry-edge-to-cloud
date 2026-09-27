import { useNavigate } from 'react-router-dom'

function MenuPage() {
  const navigate = useNavigate()

  return (
    <section className="schermata schermata-centrata schermata-menu">
      <h1 className="titolo-principale">Analisi<span> telemetrica.</span></h1>

      <div className="pila-bottoni">
        <button
          type="button"
          className="azione-secondaria azione-contorno-accento"
          onClick={() => navigate('/sessions')}
        >
          Sessioni archiviate
        </button>
        <button type="button" className="azione-primaria" onClick={() => navigate('/live')}>
          Sessione live
        </button>
      </div>
    </section>
  )
}

export default MenuPage
