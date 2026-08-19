# Frontend ACC-Telemetry

Il frontend è una single-page application React/Vite organizzata per responsabilità.

## Struttura

```text
src/
├── app/          configurazione dell'applicazione e router
├── pages/        schermate associate alle rotte
├── components/   componenti grafici riutilizzabili
├── context/      stato condiviso dell'accesso alla dashboard
├── hooks/        logica React per sessioni, live e AI
├── services/     chiamate HTTP e configurazione runtime
├── styles/       stili globali e della dashboard
├── utils/        trasformazione e formattazione dei dati
└── main.jsx      ingresso dell'applicazione
```

Il flusso dei dati segue questa direzione:

```text
pagina -> hook -> servizio -> API Gateway
pagina <- hook <- servizio <- API Gateway
```

I componenti della dashboard ricevono i dati tramite props e non effettuano direttamente chiamate HTTP.

## Rotte

Il progetto usa un hash router, compatibile con l'hosting statico S3/CloudFront senza regole di riscrittura aggiuntive.

```text
#/                    accesso
#/menu                menu principale
#/sessions            elenco sessioni
#/sessions/:sessionId dashboard storica
#/live                dashboard live
```

Le rotte interne sono protette dal controllo delle credenziali nello stato React. Le credenziali non vengono salvate in `localStorage` o `sessionStorage`: dopo un refresh è quindi necessario ripetere l'accesso.

## Modalità locale e pubblica

La presenza di `public/runtime-config.json` identifica la postazione pilota. Se il file non è disponibile, l'applicazione mostra l'accesso dell'ingegnere.

Il build pubblico esclude intenzionalmente tutta la cartella `public`:

```bash
npm run build
```

Il build locale include la configurazione runtime:

```bash
npm run build:local
```

## Comandi

```bash
npm install
npm run dev
npm run lint
npm run build:local
npm run build
npm run preview
```
