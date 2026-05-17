resource "aws_dynamodb_table" "analytics_dashboard_dynamo" {
  name         = "analytics_dashboard_dynamo"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "UserId"
  range_key    = "SessionId"

  attribute {
    name = "UserId"
    type = "S"
  }

  attribute {
    name = "SessionId"
    type = "S"
  }
}