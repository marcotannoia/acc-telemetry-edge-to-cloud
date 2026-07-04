# ACC-Telemetry

Web app per leggere la telemetria live di Assetto Corsa Competizione, salvarla su AWS e visualizzarla da una dashboard React.

Il progetto non e' plug-and-play con l'account AWS dell'autore. Chi clona la repo deve creare la propria infrastruttura: Lambda, IoT Core, DynamoDB, Cognito, API Gateway e, se vuole usare l'analisi AI, una propria API key OpenAI salvata in AWS Secrets Manager.

## Architettura

- `analytics_backend/`: script Python locale. Legge ACC dalla shared memory, fa login con Cognito, genera la configurazione runtime del frontend e pubblica i giri su AWS IoT Core via MQTT.
- `frontend/`: dashboard React/Vite. Legge `frontend/public/runtime-config.json`, mostra sessioni/storico/live e interroga la Lambda via API Gateway.
- `terraform/`: infrastruttura AWS. Crea Cognito, IoT Core, certificato dispositivo, Lambda, DynamoDB, regola IoT e API HTTP opzionale per il frontend locale.
- `requirements.txt`: dipendenze Python locali.

## Prerequisiti

- Windows con Assetto Corsa Competizione installato.
- Python 3.12+ consigliato.
- Node.js e npm.
- Terraform.
- AWS CLI configurata con un account AWS personale.
- Un utente/ruolo AWS con permessi per creare Cognito, IoT Core, Lambda, DynamoDB, API Gateway, IAM, S3 e Secrets Manager.
- OpenAI API key solo se si vuole usare il pulsante di analisi AI.

Verifica AWS:

```powershell
aws sts get-caller-identity
```

La regione usata dal progetto e' `eu-south-1`, configurata in `terraform/provider.tf`. Se vuoi un'altra regione, cambiala prima di applicare Terraform.

## 1. Clona e prepara il progetto

```powershell
git clone <URL_DELLA_REPO>
cd Tesi_Telemetry

python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

cd frontend
npm install
cd ..
```

## 2. Configura Terraform per il tuo account AWS

Prima di lanciare Terraform, scegli nomi tuoi. Alcune risorse AWS devono essere uniche.

1. Apri `terraform/s3.tf` e cambia il nome del bucket:

```hcl
bucket = "acc-telemetry-<tuo-nome>-<qualcosa-di-unico>"
```

2. Crea `terraform/terraform.tfvars`:

```hcl
name = "acc-telemetry-<tuo-nome>"

# Deve essere unico nella regione AWS.
cognito_domain_prefix = "acc-telemetry-<tuo-nome>-<numero-o-data>"

# Utile come fallback lato Lambda. Il vero user_id arrivera' dal login Cognito.
telemetry_user_id = "personal-user"

# Necessario se vuoi usare il frontend locale contro la Lambda in cloud.
enable_test_frontend_api = true

test_frontend_cors_allowed_origins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173"
]

# Lascia vuoto se non usi l'analisi AI.
openai_api_key_secret_arn = ""
openai_model = "gpt-4.1-mini"
```

Non committare `terraform.tfvars`: e' ignorato da `.gitignore`.

## 3. Crea l'infrastruttura AWS

```powershell
cd terraform
terraform init
terraform plan
terraform apply
```

Alla fine salva gli output principali:

```powershell
terraform output cognito_client_id
terraform output cognito_domain
terraform output iot_endpoint
terraform output test_frontend_api_url
```

Se `test_frontend_api_url` e' `null`, significa che `enable_test_frontend_api` e' ancora `false`.

## 4. Salva i certificati IoT sul tuo PC

Lo script Python usa mutual TLS con AWS IoT Core. Devi salvare il certificato e la chiave generati da Terraform dentro `analytics_backend/`.

Da `terraform/`:

```powershell
terraform output -raw device_certificate | Set-Content -NoNewline -Encoding ascii ..\analytics_backend\device-certificate.pem.crt
terraform output -raw device_private_key | Set-Content -NoNewline -Encoding ascii ..\analytics_backend\device-private.pem.key
```

Scarica anche la root CA Amazon e salvala come:

```text
analytics_backend/AmazonRootCA1.pem
```

URL root CA:

```text
https://www.amazontrust.com/repository/AmazonRootCA1.pem
```

Questi file sono credenziali: non committarli.

## 5. Configura Cognito per il tuo login

Chi clona la repo non puo' usare il Cognito dell'autore. Cognito vive dentro un account AWS specifico: dominio Hosted UI, client id, utenti e `sub` utente sono tutti legati al tuo account.

Terraform crea:

- User Pool Cognito: `analytics_dashboard_users`
- App client senza client secret
- Hosted UI domain
- Callback locale: `http://localhost:8765/callback`

Crea almeno un utente nel tuo User Pool:

1. Vai su AWS Console.
2. Apri Cognito.
3. Entra nel pool `analytics_dashboard_users`.
4. Crea un utente con la tua email.
5. Completa il primo login e imposta una password definitiva quando Cognito lo chiede.

Poi crea `analytics_backend/.env`:

```env
COGNITO_CLIENT_ID=<output cognito_client_id>
COGNITO_DOMAIN=<output cognito_domain>
COGNITO_REDIRECT_URI=http://localhost:8765/callback
```

Esempio:

```env
COGNITO_CLIENT_ID=abc123example
COGNITO_DOMAIN=acc-telemetry-mario-20260704.auth.eu-south-1.amazoncognito.com
COGNITO_REDIRECT_URI=http://localhost:8765/callback
```

Anche `.env` e' ignorato da `.gitignore`.

## 6. Inserisci i tuoi endpoint nel backend locale

Nel codice attuale ci sono due valori hardcoded in `analytics_backend/test_realtime.py`. Sostituiscili con gli output del tuo Terraform:

```python
IOT_ENDPOINT = "<output iot_endpoint>"
FRONTEND_API_URL = "<output test_frontend_api_url>"
```

`IOT_ENDPOINT` serve per pubblicare su AWS IoT Core. `FRONTEND_API_URL` viene scritto in `frontend/public/runtime-config.json`, cosi' React sa quale API Gateway chiamare.

Nel frontend esiste anche un fallback in `frontend/src/services/api.js`:

```js
export const defaultApiUrl = '<output test_frontend_api_url>'
```

Normalmente viene usato il valore generato in `runtime-config.json`, ma conviene aggiornare anche il fallback per non lasciare endpoint dell'autore.

## 7. Configura OpenAI, se vuoi l'analisi AI

La dashboard funziona anche senza OpenAI. In quel caso lascia `openai_api_key_secret_arn = ""` e il pulsante AI non avra' una risposta utile.

Se vuoi abilitarla, crea un secret nel tuo account AWS:

```powershell
aws secretsmanager create-secret `
  --name acc-telemetry-openai `
  --secret-string '{"OPENAI_API_KEY":"<LA_TUA_OPENAI_API_KEY>"}' `
  --region eu-south-1
```

Copia l'ARN restituito e mettilo in `terraform/terraform.tfvars`:

```hcl
openai_api_key_secret_arn = "arn:aws:secretsmanager:eu-south-1:<account-id>:secret:acc-telemetry-openai-xxxxxx"
```

Poi riapplica Terraform:

```powershell
cd terraform
terraform apply
```

## 8. Avvia frontend e backend

Terminale 1, frontend:

```powershell
cd frontend
npm run dev -- --host 127.0.0.1
```

Apri:

```text
http://127.0.0.1:5173
```

All'inizio il frontend puo' dire che manca `runtime-config.json`. E' normale finche' non fai partire il backend.

Terminale 2, backend:

```powershell
.\venv\Scripts\Activate.ps1
python .\analytics_backend\test_realtime.py
```

Il backend:

1. apre il browser sulla Hosted UI Cognito;
2. ti fa fare login con il tuo utente Cognito;
3. recupera il tuo `user_id` Cognito;
4. genera `frontend/public/runtime-config.json`;
5. si collega ad AWS IoT Core;
6. legge ACC e invia un payload ogni volta che completi un giro.

Dopo il login, torna nel frontend e clicca `Ricarica configurazione`, poi `Entra`.

## 9. Test rapido dell'API

Prima di girare in ACC puoi controllare che API Gateway e Lambda rispondano:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "<output test_frontend_api_url>" `
  -ContentType "application/json" `
  -Body '{"action":"health_check","user_id":"test"}'
```

Se risponde `Lambda online.`, la parte API e' raggiungibile.

## 10. Come capire se tutto funziona

1. Il backend stampa `Connesso in sicurezza al Cloud!`.
2. ACC e' avviato e lo script non stampa errori di shared memory.
3. Dopo un giro completato, il backend stampa che il payload e' stato inviato ad AWS.
4. In DynamoDB compaiono item nella tabella `analytics_dashboard_dynamo`.
5. Nel frontend, storico e live mostrano la sessione collegata al tuo `user_id`.

## Troubleshooting

- `Login Cognito non configurato`: manca `analytics_backend/.env` oppure `COGNITO_CLIENT_ID`/`COGNITO_DOMAIN` sono sbagliati.
- `redirect_uri mismatch`: il callback in Cognito deve essere esattamente `http://localhost:8765/callback`, oppure devi cambiare sia Terraform sia `.env`.
- Il browser non trova `runtime-config.json`: avvia prima `analytics_backend/test_realtime.py`, completa il login e poi ricarica il frontend.
- Errore MQTT/TLS: controlla `IOT_ENDPOINT`, `device-certificate.pem.crt`, `device-private.pem.key`, `AmazonRootCA1.pem` e che il client id resti `AccTelemetryEdge`.
- API bloccata da CORS: assicurati che `enable_test_frontend_api = true` e che `test_frontend_cors_allowed_origins` includa `http://127.0.0.1:5173`.
- Nessuna sessione nel frontend: devi completare almeno un giro in ACC e usare lo stesso `user_id` generato dal login Cognito.
- Terraform fallisce sul bucket S3: il nome bucket e' gia' preso; cambialo in `terraform/s3.tf`.
- AI non disponibile: manca il secret OpenAI oppure `openai_api_key_secret_arn` non e' stato riapplicato con Terraform.

## Pulizia risorse AWS

Quando vuoi eliminare l'infrastruttura creata nel tuo account:

```powershell
cd terraform
terraform destroy
```

Controlla comunque in AWS Console che non restino risorse create manualmente, per esempio secret OpenAI o utenti Cognito.

## File sensibili da non committare

Sono gia' ignorati da `.gitignore`, ma vanno trattati come segreti:

- `analytics_backend/.env`
- `analytics_backend/device-certificate.pem.crt`
- `analytics_backend/device-private.pem.key`
- `analytics_backend/AmazonRootCA1.pem`
- `frontend/public/runtime-config.json`
- `terraform/terraform.tfvars`
- `terraform/*.tfstate`
