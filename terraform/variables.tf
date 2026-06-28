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
