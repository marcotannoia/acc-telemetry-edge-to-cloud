import json

def lambda_handler(event, context):
    print("Codice provvisorio - In attesa del codice definitivo di telemetria")
    return {
        'statusCode': 200,
        'body': json.dumps('Setup infrastruttura completato!')
    }