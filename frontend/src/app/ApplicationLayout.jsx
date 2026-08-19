import { Link, Outlet } from 'react-router-dom'
import { useDashboardSession } from '../hooks/useDashboardSession.js'

export default function ApplicationLayout() {
  const { isAuthenticated } = useDashboardSession()

  return (
    <main className="applicazione">
      <header className="intestazione-sito">
        <Link className="marchio" to={isAuthenticated ? '/menu' : '/'}>
          ACC<span>Telemetry</span>
        </Link>
      </header>

      <div className="contenuto-app">
        <Outlet />
      </div>

      <footer className="footer-sito" aria-label="Contatti Marco Tannoia">
        <div className="contatti-footer">
          <a
            className="icona-contatto icona-gmail"
            href="mailto:marco.tannoia@gmail.com"
            aria-label="Invia una email a Marco Tannoia"
            title="marco.tannoia@gmail.com"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M3 6.5h18v11H3z" />
              <path d="m3.5 7 8.5 7 8.5-7" />
            </svg>
          </a>
          <a
            className="icona-contatto icona-linkedin"
            href="https://www.linkedin.com/in/marco-tannoia-6b87361ba?utm_source=share_via&utm_content=profile&utm_medium=member_ios"
            aria-label="Profilo LinkedIn di Marco Tannoia"
            rel="noreferrer"
            target="_blank"
            title="LinkedIn - Marco Tannoia"
          >
            <span aria-hidden="true">in</span>
          </a>
        </div>
      </footer>
    </main>
  )
}
