resource "aws_cognito_user_pool" "analytics_dashboard_users" {
  name                     = "analytics_dashboard_users"
  auto_verified_attributes = ["email"]

  admin_create_user_config {
    allow_admin_create_user_only = true
  }

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

  mfa_configuration = "OFF"
}

resource "aws_cognito_user_pool_client" "client" {
  name                                 = "analytics_dashboard_cognito_client"
  user_pool_id                         = aws_cognito_user_pool.analytics_dashboard_users.id
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  callback_urls                        = ["http://localhost:8765/callback"]
  logout_urls                          = ["http://localhost:8765/logout"]
  supported_identity_providers         = ["COGNITO"]
  prevent_user_existence_errors        = "ENABLED"
}

resource "aws_cognito_user_pool_domain" "analytics_dashboard_domain" {
  domain       = var.cognito_domain_prefix
  user_pool_id = aws_cognito_user_pool.analytics_dashboard_users.id
}

output "cognito_client_id" {
  value       = aws_cognito_user_pool_client.client.id
  description = "Client ID da usare in COGNITO_CLIENT_ID per il login locale edge."
}

output "cognito_domain" {
  value       = "${aws_cognito_user_pool_domain.analytics_dashboard_domain.domain}.auth.${data.aws_region.current.name}.amazoncognito.com"
  description = "Dominio Hosted UI da usare in COGNITO_DOMAIN per il login locale edge."
}
