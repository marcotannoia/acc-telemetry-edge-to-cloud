# ACC-Telemetry

WebApp per leggere, salvare e visualizzare la telemetria di Assetto Corsa Competizione.

## Struttura

- `analytics_backend/`: codice Python che legge ACC in locale, fa il login Cognito e invia la telemetria verso AWS.
- `frontend/`: interfaccia React/Vite usata dall'ingegnere di pista per vedere sessioni, live e grafici.
- `terraform/`: infrastruttura AWS, cioe Cognito, IoT, Lambda, DynamoDB e API Gateway.
- `requirements.txt`: dipendenze Python.

## Avvio locale

Installa le dipendenze Python:

```powershell
pip install -r requirements.txt
```

Avvia il frontend:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev -- --host 127.0.0.1
```

Avvia il backend locale:

```powershell
cd ..
.\venv\Scripts\python.exe .\analytics_backend\test_realtime.py
```

Dopo il login Cognito locale, il backend genera `frontend/public/runtime-config.json`.
Il frontend legge quel file per recuperare automaticamente `user_id` ed endpoint API.

## Build frontend

```powershell
cd frontend
npm.cmd run build
```
