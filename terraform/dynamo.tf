resource "aws_dynamodb_table" "analytics_dashboard_dynamo" {
  name         = "analytics_dashboard_dynamo"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "driver"
  range_key    = "timestamp" # <--- Usa il timestamp per non sovrascrivere i giri

  attribute {
    name = "driver"
    type = "S"
  }

  attribute {
    name = "timestamp" # <--- Deve coincidere con la range_key
    type = "S"
  }
}