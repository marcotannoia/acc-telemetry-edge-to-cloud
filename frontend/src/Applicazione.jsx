import { useEffect, useState } from 'react'
import './stiliApplicazione.css' 
import Accesso from './componenti/Accesso.jsx'
import Dashboard from './componenti/Dashboard.jsx'
import ListaSessioni from './componenti/ListaSessioni.jsx'
import Menu from './componenti/Menu.jsx'
import { chiamaApi, urlApiPredefinito } from './servizi/api.js'
import { leggiConfigurazioneRuntime } from './servizi/configurazioneRuntime.js'

function messaggioErrore(errore) {
  return errore instanceof Error ? errore.message : 'Errore sconosciuto'
}

function payloadAccesso(credenziali) {
  return {
    station_code: credenziali.codicePostazione,
    access_code: credenziali.codiceAccesso,
  }
}

async function leggiSessioniDaApi(credenziali, urlApi) {
  const dati = await chiamaApi({
    action: 'list_sessions',
    ...payloadAccesso(credenziali),
    limit: 300,
  }, urlApi)
  return [...(dati.sessions || [])].sort((a, b) =>
    String(b.last_timestamp || '').localeCompare(String(a.last_timestamp || '')),
  )
}

async function leggiGiriDaApi(credenziali, urlApi, sessione) {
  const dati = await chiamaApi({
    action: 'get_session_laps',
    ...payloadAccesso(credenziali),
    session_id: sessione.session_id,
    track: sessione.track,
  }, urlApi)

  return dati.laps || []
}

function Applicazione() {
  const [vista, impostaVista] = useState('accesso') // cosi permetto il refresh della pagina andando a cambiare il frontend in base a cosa voglio
  const [, impostaStato] = useState('Riconosco la postazione') // lo stato resta interno e non viene mostrato nell'interfaccia
  const [configurazione, impostaConfigurazione] = useState(null) //per capire idutente e urlapi
  const [modalitaAccesso, impostaModalitaAccesso] = useState('caricamento')
  const [erroreAccesso, impostaErroreAccesso] = useState('')
  const [caricamentoAccesso, impostaCaricamentoAccesso] = useState(false)
  const [codiceGenerato, impostaCodiceGenerato] = useState(null)
  const [credenzialiDashboard, impostaCredenzialiDashboard] = useState(null)
  const [urlApi, impostaUrlApi] = useState(urlApiPredefinito)

  const [sessioni, impostaSessioni] = useState([])
  const [sessioneSelezionata, impostaSessioneSelezionata] = useState(null)
  const [giri, impostaGiri] = useState([])
  const [liveAttivo, impostaLiveAttivo] = useState(false)

  const [consiglioAi, impostaConsiglioAi] = useState(null)
  const [caricamentoAi, impostaCaricamentoAi] = useState(false)
  const [erroreAi, impostaErroreAi] = useState('')

  async function caricaConfigurazione() { //carico i 3 parametri 
    try {
      impostaStato('Leggo configurazione locale')
      const configurazioneRuntime = await leggiConfigurazioneRuntime()
      impostaConfigurazione(configurazioneRuntime)
      impostaModalitaAccesso('pilota')
      impostaUrlApi(configurazioneRuntime.urlApi)
      impostaStato('Postazione pilota riconosciuta')
    } catch {
      impostaConfigurazione(null)
      impostaModalitaAccesso('ingegnere')
      impostaUrlApi(urlApiPredefinito)
      impostaStato('Accesso ingegnere')
    }
  }

  async function caricaSessioni() { // carico le sessioni
    const sessioniOrdinate = await leggiSessioniDaApi(credenzialiDashboard, urlApi)
    impostaSessioni(sessioniOrdinate)
    return sessioniOrdinate
  }

  async function caricaGiri(sessione) { //chiamo i giri di una specifica sessione
    return leggiGiriDaApi(credenzialiDashboard, urlApi, sessione)
  }

  useEffect(() => { // useeffect: esegue il codice che avviene dopo aver renderizzato la pagine
    caricaConfigurazione() // carica la configurazione all'inizio
  }, [])

  useEffect(() => { //gestisce gli aggiornamenti real time
    if (!liveAttivo || vista !== 'cruscotto' || !sessioneSelezionata) return undefined

    const intervallo = window.setInterval(async () => {
      try {
        const sessioniOrdinate = await leggiSessioniDaApi(credenzialiDashboard, urlApi) // quando clicco su Live
        impostaSessioni(sessioniOrdinate)
        const sessioneRecente = sessioniOrdinate[0] || sessioneSelezionata //prendo la recente, o se non e cambiata la mantengo

        if (sessioneRecente.session_id !== sessioneSelezionata.session_id) { // vedo se e cambiata
          impostaSessioneSelezionata(sessioneRecente)
          impostaErroreAi('')
          impostaConsiglioAi(null)
        }

        const giriAggiornati = await leggiGiriDaApi(credenzialiDashboard, urlApi, sessioneRecente)
        impostaGiri(giriAggiornati)
        impostaStato(`Live aggiornata - ${giriAggiornati.length} giri`)
      } catch (errore) {
        impostaStato(`Live non aggiornata: ${messaggioErrore(errore)}`)
      }
    }, 5000) //ogni 5 secondi

    return () => window.clearInterval(intervallo) // quando smetto l'effect resetto tutto
  }, [credenzialiDashboard, liveAttivo, sessioneSelezionata, urlApi, vista]) // sono le dipendenze, aggiorno l'effect quando cambia uno di queste

  async function generaCodiceAccesso(codicePostazione) {
    if (!configurazione) return

    impostaCaricamentoAccesso(true)
    impostaErroreAccesso('')
    impostaStato('Genero il codice di accesso')

    try {
      const dati = await chiamaApi({
        action: 'create_dashboard_access',
        user_id: configurazione.idUtente,
        station_code: codicePostazione,
      }, urlApi)
      const credenziali = {
        codicePostazione: dati.station_code,
        codiceAccesso: dati.access_code,
      }
      impostaCodiceGenerato(credenziali)
      impostaCredenzialiDashboard(credenziali)
      impostaStato('Codici pronti')
    } catch (errore) {
      impostaErroreAccesso(messaggioErrore(errore))
      impostaStato('Creazione codici non riuscita')
    } finally {
      impostaCaricamentoAccesso(false)
    }
  }

  async function accediComeIngegnere(codicePostazione, codiceAccesso) {
    impostaCaricamentoAccesso(true)
    impostaErroreAccesso('')
    impostaStato('Verifico i codici')

    try {
      const credenziali = { codicePostazione, codiceAccesso }
      await chiamaApi({
        action: 'authenticate_dashboard',
        ...payloadAccesso(credenziali),
      }, urlApi)
      impostaCredenzialiDashboard(credenziali)
      impostaVista('menu')
      impostaStato('Accesso ingegnere effettuato')
    } catch (errore) {
      impostaErroreAccesso(messaggioErrore(errore))
      impostaStato('Accesso non riuscito')
    } finally {
      impostaCaricamentoAccesso(false)
    }
  }

  function entraComePilota() {
    if (!codiceGenerato) return
    impostaVista('menu')
    impostaStato('Accesso pilota effettuato')
  }

  async function apriStorico() { // lista sessioni
    impostaLiveAttivo(false)
    impostaVista('sessioni')

    try {
      await caricaSessioni()
    } catch (errore) {
      impostaSessioni([])
      impostaStato(`Sessioni non disponibili: ${messaggioErrore(errore)}`)
    }
  }

  async function apriLive() { // live
    impostaLiveAttivo(true)

    try {
      const sessioniOrdinate = await caricaSessioni()
      const sessioneRecente = sessioniOrdinate[0]

      if (!sessioneRecente) {
        impostaLiveAttivo(false)
        impostaStato('Nessuna sessione disponibile')
        return
      }

      impostaSessioneSelezionata(sessioneRecente)
      impostaErroreAi('')
      impostaConsiglioAi(null)

      const giriLive = await caricaGiri(sessioneRecente)
      impostaGiri(giriLive)
      impostaStato(`Live avviata - ${giriLive.length} giri`)
      impostaVista('cruscotto')
    } catch (errore) {
      impostaLiveAttivo(false)
      impostaStato(`Live non disponibile: ${messaggioErrore(errore)}`)
    }
  }

  async function apriSessione(sessione) {
    impostaLiveAttivo(false)
    impostaSessioneSelezionata(sessione)
    impostaErroreAi('')
    impostaConsiglioAi(null)

    try {
      impostaGiri(await caricaGiri(sessione))
      impostaVista('cruscotto')
    } catch (errore) {
      impostaGiri([])
      impostaStato(`Sessione non disponibile: ${messaggioErrore(errore)}`)
    }
  }

  async function chiediIngegnereAi() {
    if (!sessioneSelezionata) return

    impostaCaricamentoAi(true)
    impostaErroreAi('')
    impostaStato('Analisi AI in corso')

    try {
      const dati = await chiamaApi({
        action: 'ai_insight',
        ...payloadAccesso(credenzialiDashboard),
        session_id: sessioneSelezionata.session_id,
        track: sessioneSelezionata.track,
        driver: sessioneSelezionata.driver,
        limit: 80,
        question: (
          'Analizza gli ultimi giri live. Rispondi con priorita, rischio principale, '
          + 'azione consigliata e dato da monitorare nei prossimi giri.'
        ),
      }, urlApi)

      const consiglio = {
        generatoIl: new Date().toISOString(),
        giriAnalizzati: dati.laps_analyzed,
        modello: dati.model,
        domanda: dati.question,
        testo: dati.ai_engineer_insight,
      }

      impostaConsiglioAi(consiglio)
      impostaStato('Consiglio AI aggiornato')
    } catch (errore) {
      impostaErroreAi(messaggioErrore(errore))
      impostaStato('Consiglio AI non disponibile')
    } finally {
      impostaCaricamentoAi(false)
    }
  }

  return (
    <main className="applicazione">
      {vista === 'accesso' && (
        <Accesso
          caricamento={caricamentoAccesso}
          codiceGenerato={codiceGenerato}
          errore={erroreAccesso}
          modalita={modalitaAccesso}
          quandoAccedi={accediComeIngegnere}
          quandoEntraPilota={entraComePilota}
          quandoGenera={generaCodiceAccesso}
        />
      )}

      {vista === 'menu' && <Menu quandoStorico={apriStorico} quandoLive={apriLive} />}

      {vista === 'sessioni' && (
        <ListaSessioni sessioni={sessioni} quandoIndietro={() => impostaVista('menu')} quandoApri={apriSessione} />
      )}

      {vista === 'cruscotto' && (
        <Dashboard
          caricamentoAi={caricamentoAi}
          consiglioAi={consiglioAi}
          erroreAi={erroreAi}
          giri={giri}
          liveAttivo={liveAttivo}
          quandoChiediAi={chiediIngegnereAi}
          quandoIndietro={() => impostaVista('menu')}
          sessione={sessioneSelezionata}
        />
      )}
    </main>
  )
}

export default Applicazione
