function Login({ config, error, onLogin, onReload }) {
  return (
    <section className="screen hero-screen">
      <h1 className="hero-title">ACC-Telemetry</h1>
      <p className="hero-subtitle">Benvenuto, effettua l'accesso.</p>

      <div className="panel">
        <p className="eyebrow">Benvenuto</p>
        <h2>Login</h2>

        {config && (
          <div className="runtime-info">
            <span>User ID</span>
            <strong>{config.userId}</strong>
            <span>Endpoint API</span>
            <strong>{config.apiUrl}</strong>
          </div>
        )}

        {error && <p className="error-text">{error}</p>}

        <div className="button-stack">
          <button type="button" className="primary-action full-action" disabled={!config} onClick={onLogin}>
            Entra
          </button>
          <button type="button" className="ghost-action full-action" onClick={onReload}>
            Ricarica configurazione
          </button>
        </div>
      </div>
    </section>
  )
}

export default Login
