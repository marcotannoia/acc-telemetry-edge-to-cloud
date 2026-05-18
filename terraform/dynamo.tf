resource "aws_dynamodb_table" "analytics_dashboard_dynamo" {
  name         = "analytics_dashboard_dynamo"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "driver"
  range_key    = "SessionId"

  attribute {
    name = "driver"
    type = "S"
  }

  attribute {
    name = "SessionId"
    type = "S"
  }
}