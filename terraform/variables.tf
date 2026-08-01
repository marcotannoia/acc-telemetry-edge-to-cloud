variable "name" {
  description = "Il nome base per il progetto"
  type        = string
  default     = "acc-telemetry"
}

variable "openai_api_key_secret_arn" {
  description = "ARN del secret AWS Secrets Manager che contiene la OpenAI API key. Lascia vuoto per disabilitare l'analisi AI on demand."
  type        = string
  default     = ""
}

variable "openai_model" {
  description = "Modello OpenAI usato solo quando il frontend richiede action=ai_insight."
  type        = string
  default     = "gpt-4.1-mini"
}

variable "enable_test_frontend_api" {
  description = "Abilita un HTTP API pubblico minimale per testare la Lambda dal frontend locale. Tienilo false quando non serve."
  type        = bool
  default     = false
}

variable "test_frontend_cors_allowed_origins" {
  description = "Origin browser autorizzati per il frontend di test locale."
  type        = list(string)
  default = [
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost:5173",
    "http://127.0.0.1:5173"
  ]
}

variable "telemetry_user_id" {
  description = "Identificativo Cognito dell'utente proprietario della telemetria MQTT. Per uso personale puo' essere il sub Cognito o un alias stabile."
  type        = string
  default     = "personal-user"
}

variable "cognito_domain_prefix" {
  description = "Prefisso globale del dominio Cognito Hosted UI. Deve essere unico nella regione AWS."
  type        = string
  default     = "acc-telemetry-dashboard"
}

variable "existing_edge_device_certificate_arn" {
  description = "ARN di un certificato IoT edge gia esistente da conservare. Lascia vuoto solo per crearne uno nuovo."
  type        = string
  default     = ""
}

variable "existing_provisioning_certificate_arn" {
  description = "ARN di un certificato IoT di provisioning gia esistente da conservare. Lascia vuoto solo per crearne uno nuovo."
  type        = string
  default     = ""
}
