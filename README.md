# ACC-Telemetry

ACC-Telemetry e' una web app per leggere, salvare e visualizzare la telemetria di Assetto Corsa Competizione.

L'obiettivo e' dare a un pilota o a un ingegnere di pista una dashboard semplice da consultare durante una sessione: giri, ritmo, temperature, carburante, slip, settori e indicazioni strategiche vengono raccolti automaticamente e mostrati in modo ordinato.

## Cosa Fa

La web app trasforma i dati live di ACC in una vista leggibile e utile per prendere decisioni durante una sessione.

- legge la telemetria locale di Assetto Corsa Competizione;
- invia i dati giro per giro al cloud;
- salva lo storico delle sessioni;
- mostra una dashboard live aggiornata;
- aggiorna gap e settori live a 1 Hz senza salvare ogni tick nello storico;
- permette di consultare sessioni passate;
- calcola indicatori utili per gomme, carburante, grip e ritmo;
- puo' generare un consiglio strategico tramite AI, se configurata.

## Funzionalita Principali

### Login e Sessione Utente

Il sistema associa la telemetria a un utente autenticato. In questo modo ogni pilota vede le proprie sessioni e il proprio storico.

### Dashboard Live

Durante una sessione, la dashboard mostra i dati aggiornati degli ultimi giri:

- tempo sul giro;
- tempi settore;
- validita' del giro;
- velocita' massima e minima;
- temperatura gomme;
- temperatura freni;
- pressione gomme MFD;
- consumo carburante;
- giri stimati rimanenti;
- posizione e gap live;
- tempi settore live con delta rispetto a giro precedente e giro migliore;
- eventi di slip per settore.

### Storico Sessioni

Le sessioni vengono salvate e possono essere rilette in seguito. La web app permette di aprire una sessione passata e analizzare i giri raccolti.

### Strategia

Il backend arricchisce ogni giro con indicazioni sintetiche:

- stato gomme;
- stato carburante;
- grip pista;
- rischio di overheating;
- eventi di sliding;
- suggerimento sul livello di push.

### AI Engineer

Se e' configurata una API key OpenAI, la dashboard puo' chiedere un commento strategico sugli ultimi giri della sessione. L'AI usa solo i dati disponibili e restituisce priorita', rischio principale, azione consigliata e dato da monitorare.

## Architettura

Il progetto e' composto da tre parti principali:

```text
Assetto Corsa Competizione
        |
        v
Python Edge Backend
        |
        v
AWS IoT Core -> Lambda -> DynamoDB
        |
        v
React Dashboard
```

### Backend Locale

Il backend Python gira sul PC dove e' aperto ACC. Legge la shared memory del gioco, prepara un payload a ogni giro completato e lo pubblica su AWS IoT Core.

### Cloud Backend

La parte cloud riceve i payload, li salva su DynamoDB e li espone alla dashboard tramite Lambda e API Gateway.

### Frontend

Il frontend e' una dashboard React/Vite pensata per consultare live e storico in modo rapido.

## Dati Raccolti

La telemetria include dati provenienti dalle mappe fisiche, grafiche e statiche di ACC.

Esempi:

- track e driver;
- session type;
- lap number;
- lap time e best time;
- sector times;
- gas e brake medi;
- RPM massimo;
- fuel start, fuel left e fuel consumed;
- tyre core temperature;
- tyre inner/middle/outer temperature;
- brake temperature;
- MFD tyre pressure;
- slip per gomma e per settore;
- air temperature e road temperature;
- track grip;
- posizione e distacchi.

## Stack Tecnologico

- Python per il backend locale;
- AWS IoT Core per ricevere la telemetria;
- AWS Lambda per elaborazione e API;
- DynamoDB per lo storico;
- Cognito per autenticazione utente;
- React e Vite per il frontend;
- Chart.js per i grafici;
- Terraform per descrivere l'infrastruttura cloud.

## Struttura Repository

```text
analytics_backend/       Backend locale Python e login Cognito
frontend/                Dashboard React/Vite
terraform/               Infrastruttura AWS e codice Lambda
requirements.txt         Dipendenze Python del backend
```

## Stato Del Progetto

Il progetto nasce come lavoro di tesi e prototipo funzionale per analisi telemetrica in ACC.

La parte centrale e' gia' presente:

- lettura dati ACC;
- invio MQTT verso AWS;
- salvataggio giri;
- storico sessioni;
- dashboard live;
- analisi strategica automatica;
- integrazione opzionale con AI.

## Nota

La repository non contiene credenziali, certificati, API key o configurazioni cloud personali. La web app e' pensata per essere collegata a un ambiente AWS privato.
