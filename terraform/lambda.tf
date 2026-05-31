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

# 2. Policy IAM (Permessi blindati: via S3, solo Dynamo e Log)
resource "aws_iam_role_policy" "lambda_execution_policy" {
  name = "lambda_execution_policy"
  role = aws_iam_role.analytics_dashboard_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:GetItem",
          "dynamodb:Query"
        ]
        Effect   = "Allow"
        Resource = aws_dynamodb_table.analytics_dashboard_dynamo.arn
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
    ]
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
  timeout = 10 # 10 secondi sono più che sufficienti per scrivere un JSON su Dynamo

  environment {
    variables = {
      DYNAMO_TABLE = aws_dynamodb_table.analytics_dashboard_dynamo.name
    }
  }
}

# 5. Permesso per permettere a IoT Core di invocare la Lambda
resource "aws_lambda_permission" "allow_iot" {
  statement_id  = "AllowExecutionFromIoTCore"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.analytics_dashboard_lambda.function_name
  principal     = "iot.amazonaws.com"
  source_arn    = aws_iot_topic_rule.telemetry_rule.arn
}

# 6. L'Innesco (La Regola IoT): Intercetta MQTT e lancia la Lambda
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
