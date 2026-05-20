  data "aws_caller_identity" "current" {}
  data "aws_region" "current" {}

  resource "aws_iot_policy" "iot_device" {
    name = join("-", [var.name, "device-policy"])

    policy = jsonencode({
      "Version" : "2012-10-17",
      "Statement" : [
        {
          "Effect" : "Allow",
          "Action" : [
            "iot:Publish",
            "iot:Receive"
          ],
          "Resource" : [
            "arn:aws:iot:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:topic/$${iot:Connection.Thing.ThingName}/*",
          ]
        },
        {
          "Effect" : "Allow",
          "Action" : "iot:Subscribe",
          "Resource" : [
            "arn:aws:iot:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:topicfilter/$aws/things/$${iot:Connection.Thing.ThingName}/shadow/*",
          ]
        },
        {
          "Condition" : {
            "Bool" : {
              "iot:Connection.Thing.IsAttached" : [
                "true"
              ]
            }
          },
          "Effect" : "Allow",
          "Action" : "iot:Connect",
          "Resource" : "*"
        }
      ]
    })
  }

  resource "aws_iot_policy" "provisioning" {
    name = join("-", [var.name, "provisioning-policy"])

    policy = jsonencode({
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Action": [
            "iot:CreateCertificateFromCsr",
            "iot:RegisterThing"
          ],
          "Resource": "*"
        }
      ]
    })
  }

  # Create a self-signed provisioning certificate
  resource "tls_private_key" "provisioning" {
    algorithm = "RSA"
    rsa_bits  = 2048
  }

  resource "tls_self_signed_cert" "provisioning" {
    private_key_pem = tls_private_key.provisioning.private_key_pem

    subject {
      common_name = "IoT Provisioning"
    }

    validity_period_hours = 8760 # 365 days

    allowed_uses = [
      "key_encipherment",
      "digital_signature",
      "server_auth",
    ]
  }

  # Add the provisioning certificate and attach the provisioning policy
  resource "aws_iot_certificate" "iot_fleet_provisioning" {
    certificate_pem = tls_self_signed_cert.provisioning.cert_pem
    active          = true
  }

  resource "aws_iot_policy_attachment" "iot_fleet_provisioning_certificate" {
    policy = aws_iot_policy.provisioning.name
    target = aws_iot_certificate.iot_fleet_provisioning.arn
  }


# Ottiene l'endpoint IoT Core del tuo account AWS
data "aws_iot_endpoint" "core" {
  endpoint_type = "iot:Data-ATS"
}

# Genera un certificato sicuro gestito da AWS per il tuo PC (Edge)
resource "aws_iot_certificate" "edge_device" {
  active = true
}


  output "iot_endpoint" {
  value       = data.aws_iot_endpoint.core.endpoint_address
  description = "Copia questo valore nel campo endpoint dello script Python"
}

output "device_certificate" {
  value       = aws_iot_certificate.edge_device.certificate_pem
  sensitive   = true
  description = "Salva questo output nel file device-certificate.pem.crt"
}

output "device_private_key" {
  value       = aws_iot_certificate.edge_device.private_key
  sensitive   = true
  description = "Salva questo output nel file device-private.pem.key"
}

# 1. Crea l'Oggetto IoT (Thing) con lo stesso nome del client_id usato in Python
resource "aws_iot_thing" "edge_device" {
  name = "AccTelemetryEdge"
}

# 2. Attacca la policy del dispositivo al certificato del tuo PC
resource "aws_iot_policy_attachment" "edge_device_policy" {
  policy = aws_iot_policy.iot_device.name
  target = aws_iot_certificate.edge_device.arn
}

# 3. Attacca il certificato alla Thing (Soddisfa la condizione IsAttached = true)
resource "aws_iot_thing_principal_attachment" "edge_device_principal" {
  principal = aws_iot_certificate.edge_device.arn
  thing     = aws_iot_thing.edge_device.name
}