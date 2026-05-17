resource "aws_cognito_user_pool" "analytics_dashboard_users" {
  name                     = "analytics_dashboard_users"
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }

  schema {
    attribute_data_type      = "String"
    developer_only_attribute = false
    mutable                  = false
    name                     = "email"
    required                 = true

    string_attribute_constraints {
      min_length = "5"
      max_length = "2048"
    }
  }

  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  mfa_configuration = "off"
}

resource "aws_cognito_user_pool_client" "client" {
  name            = "analytics_dashboard_cognito_client"
user_pool_id = aws_cognito_user_pool.analytics_dashboard_users.id
  generate_secret = false
}

variable "google_client_id" {
  description = "Client ID di Google OAuth"
  type        = string
  sensitive   = true
}

variable "google_client_secret" {
  description = "Client Secret di Google OAuth"
  type        = string
  sensitive   = true
}

resource "aws_cognito_identity_provider" "google_provider" {
  user_pool_id = aws_cognito_user_pool.analytics_dashboard_users.id
  provider_name = "Google"
  provider_type = "Google"

  provider_details = {
    authorize_scopes = "email openid profile"
    client_id        = var.google_client_id
    client_secret    = var.google_client_secret
  }

  attribute_mapping = {
    email    = "email"
    username = "sub"
  }
}