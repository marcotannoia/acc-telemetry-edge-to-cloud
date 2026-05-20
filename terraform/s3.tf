resource "aws_s3_bucket" "analytics_dashboard_s3" {
  bucket = "analytics-dashboard-s3-acc-milano"
}

resource "aws_s3_bucket_server_side_encryption_configuration" "s3_encryption" {
  bucket = aws_s3_bucket.analytics_dashboard_s3.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}