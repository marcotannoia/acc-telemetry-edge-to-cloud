# 1. Ruolo IAM per la Lambda
data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "analytics_dashboard_lambda_role" {
  name               = "analytics_dashboard_lambda_role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

# 2. Policy IAM: DynamoDB, log e Secret OpenAI opzionale
resource "aws_iam_role_policy" "lambda_execution_policy" {
  name = "lambda_execution_policy"
  role = aws_iam_role.analytics_dashboard_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [
        {
          Action = [
            "dynamodb:PutItem",
            "dynamodb:UpdateItem",
            "dynamodb:GetItem",
            "dynamodb:Query"
          ]
          Effect = "Allow"
          Resource = [
            aws_dynamodb_table.analytics_dashboard_dynamo.arn,
            "${aws_dynamodb_table.analytics_dashboard_dynamo.arn}/index/*",
            aws_dynamodb_table.analytics_dashboard_access.arn
          ]
        },
        {
          Action = [
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents"
          ]
          Effect   = "Allow"
          Resource = "arn:aws:logs:*:*:*"
        }
      ],
      var.openai_api_key_secret_arn == "" ? [] : [
        {
          Action   = ["secretsmanager:GetSecretValue"]
          Effect   = "Allow"
          Resource = var.openai_api_key_secret_arn
        }
      ]
    )
  })
}

# 3. Zippaggio del codice sorgente Python
data "archive_file" "analytics_dashboard_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda_src"
  output_path = "${path.module}/analytics_backend.zip"
}

# 4. Creazione della Funzione Lambda
resource "aws_lambda_function" "analytics_dashboard_lambda" {
  filename         = data.archive_file.analytics_dashboard_zip.output_path
  function_name    = "analytics_dashboard_lambda"
  role             = aws_iam_role.analytics_dashboard_lambda_role.arn
  handler          = "analytics_dashboard.handler"
  source_code_hash = data.archive_file.analytics_dashboard_zip.output_base64sha256

  runtime = "python3.12"
  timeout = 30

  environment {
    variables = {
      DYNAMO_TABLE              = aws_dynamodb_table.analytics_dashboard_dynamo.name
      DASHBOARD_ACCESS_TABLE    = aws_dynamodb_table.analytics_dashboard_access.name
      DEFAULT_USER_ID           = var.telemetry_user_id
      OPENAI_API_KEY_SECRET_ARN = var.openai_api_key_secret_arn
      OPENAI_MODEL              = var.openai_model
    }
  }
}

# 5. API HTTP opzionale per testare la Lambda da un frontend locale
resource "aws_apigatewayv2_api" "analytics_dashboard_test" {
  count         = var.enable_test_frontend_api ? 1 : 0
  name          = "analytics-dashboard-test-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_headers = ["content-type"]
    allow_methods = ["POST", "OPTIONS"]
    allow_origins = var.test_frontend_cors_allowed_origins
    max_age       = 3600
  }
}

resource "aws_apigatewayv2_integration" "analytics_dashboard_test_lambda" {
  count                  = var.enable_test_frontend_api ? 1 : 0
  api_id                 = aws_apigatewayv2_api.analytics_dashboard_test[0].id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.analytics_dashboard_lambda.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "analytics_dashboard_test_post" {
  count     = var.enable_test_frontend_api ? 1 : 0
  api_id    = aws_apigatewayv2_api.analytics_dashboard_test[0].id
  route_key = "POST /"
  target    = "integrations/${aws_apigatewayv2_integration.analytics_dashboard_test_lambda[0].id}"
}

resource "aws_apigatewayv2_stage" "analytics_dashboard_test" {
  count       = var.enable_test_frontend_api ? 1 : 0
  api_id      = aws_apigatewayv2_api.analytics_dashboard_test[0].id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "allow_test_api" {
  count         = var.enable_test_frontend_api ? 1 : 0
  statement_id  = "AllowExecutionFromTestHttpApi"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.analytics_dashboard_lambda.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.analytics_dashboard_test[0].execution_arn}/*/*"
}

output "test_frontend_api_url" {
  value       = var.enable_test_frontend_api ? aws_apigatewayv2_stage.analytics_dashboard_test[0].invoke_url : null
  description = "Endpoint HTTP API da incollare nel frontend/index.html per test locali."
}

# 6. Permesso per permettere a IoT Core di invocare la Lambda
resource "aws_lambda_permission" "allow_iot" {
  statement_id  = "AllowExecutionFromIoTCore"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.analytics_dashboard_lambda.function_name
  principal     = "iot.amazonaws.com"
  source_arn    = aws_iot_topic_rule.telemetry_rule.arn
}

# 7. L'Innesco (La Regola IoT): Intercetta MQTT e lancia la Lambda
resource "aws_iot_topic_rule" "telemetry_rule" {
  name    = "acc_telemetry_to_lambda"
  enabled = true
  # Modifica qui per ascoltare il topic autorizzato dalla policy della Thing
  sql         = "SELECT * FROM 'AccTelemetryEdge/telemetry/laps'"
  sql_version = "2016-03-23"

  lambda {
    function_arn = aws_lambda_function.analytics_dashboard_lambda.arn
  }
}
