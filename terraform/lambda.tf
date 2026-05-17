# 1. Ruolo IAM per la Lambda (Assume Role)
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

# 2. Policy IAM (Permessi blindati e specifici)
resource "aws_iam_role_policy" "lambda_execution_policy" {
  name = "lambda_execution_policy"
  role = aws_iam_role.analytics_dashboard_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Permesso di sola lettura esclusivo per il bucket della telemetria
        Action = [
          "s3:GetObject"
        ]
        Effect   = "Allow"
        Resource = "${aws_s3_bucket.analytics_dashboard_s3.arn}/*"
      },
      {
        # Permesso di scrittura esclusivo per la tabella DynamoDB della tesi
        Action = [
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:GetItem"
        ]
        Effect   = "Allow"
        Resource = aws_dynamodb_table.analytics_dashboard_dynamo.arn
      },
      {
        # Permessi base per generare log e poter debuggare il codice
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
  source_file = "${path.module}/analytics_dashboard.py"
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
  timeout = 30 # Alzato a 30s perché il parsing dei file .ld raw può richiedere qualche secondo

  environment {
    variables = {
      ENVIRONMENT  = "production"
      DYNAMO_TABLE = aws_dynamodb_table.analytics_dashboard_dynamo.name
    }
  }
}

# 5. Permesso fondamentale: autorizza S3 a chiamare questa Lambda
resource "aws_lambda_permission" "allow_bucket" {
  statement_id  = "AllowExecutionFromS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.analytics_dashboard_lambda.arn
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.analytics_dashboard_s3.arn
}

# 6. L'Innesco: S3 attiva la Lambda solo quando viene creato un nuovo file
resource "aws_s3_bucket_notification" "bucket_terraform_notification" {
  bucket = aws_s3_bucket.analytics_dashboard_s3.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.analytics_dashboard_lambda.arn
    events              = ["s3:ObjectCreated:*"]
    # filter_suffix     = ".ld" # Scommenta questa riga se vuoi che si attivi SOLO con i file .ld di Assetto Corsa
  }

  # Terraform deve prima creare il permesso (blocco 5) e poi la notifica, altrimenti va in crash
  depends_on = [aws_lambda_permission.allow_bucket] 
}