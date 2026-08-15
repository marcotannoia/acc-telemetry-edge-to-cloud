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

  attribute {
    name = "user_id"
    type = "S"
  }

  global_secondary_index {
    name            = "user-timestamp-index"
    hash_key        = "user_id"
    range_key       = "timestamp"
    projection_type = "ALL"
  }
}

resource "aws_dynamodb_table" "analytics_dashboard_access" {
  name         = "analytics_dashboard_access"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "station_code"

  attribute {
    name = "station_code"
    type = "S"
  }

  server_side_encryption {
    enabled = true
  }
}
