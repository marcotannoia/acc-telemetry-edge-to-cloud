import json
import os
import boto3
from decimal import Decimal
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Key
from strategy import StrategyEvaluator

# Inizializza il client DynamoDB
dynamodb = boto3.resource('dynamodb')
TABLE_NAME = os.environ.get('DYNAMO_TABLE', 'analytics_dashboard_dynamo')
table = dynamodb.Table(TABLE_NAME)

def convert_floats_to_decimals(obj):
    """Funzione ricorsiva per convertire i float in Decimal per DynamoDB"""
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: convert_floats_to_decimals(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [convert_floats_to_decimals(v) for v in obj]
    return obj


def get_recent_laps(driver, track=None, limit=4, search_limit=20):
    if not driver:
        return []

    try:
        response = table.query(
            KeyConditionExpression=Key("driver").eq(driver),
            ScanIndexForward=False,
            Limit=search_limit
        )
        laps = response.get("Items", [])
        if track:
            laps = [lap for lap in laps if lap.get("track") == track]
        return list(reversed(laps[:limit]))
    except ClientError as e:
        print("Storico giri non disponibile:", e.response["Error"]["Message"])
        return []

def handler(event, context):
    """
    Questa Lambda viene invocata da AWS IoT Core ogni volta che viene pubblicato
    un messaggio sul topic 'AccTelemetryEdge/telemetry/laps'.
    """
    print("Ricevuto payload di telemetria da AWS IoT Core:", json.dumps(event))
    
    # 1. Pulizia dai caratteri \u0000 (null bytes) nel nome del pilota
   # 1. Pulizia stringhe dai caratteri \u0000 (null bytes)
    if 'driver' in event and isinstance(event['driver'], str):
        event['driver'] = event['driver'].replace('\u0000', '').strip()
        
    if 'track' in event and isinstance(event['track'], str):
        event['track'] = event['track'].replace('\u0000', '').strip()

    # 2. Calcolo strategia cloud
    recent_laps = get_recent_laps(event.get("driver"), event.get("track"))
    strategy = StrategyEvaluator()
    strategy.load_history(recent_laps)
    event.update(strategy.add_lap(event))
        
    # 3. FIX TYPE: Converti tutti i float in Decimal
    event_clean = convert_floats_to_decimals(event)
    
    try:
        # Estrai i dati per il log locale
        lap_time = event_clean.get('lap_time_ms', 'lap time')
        lap_number = event_clean.get('lap_number', 'Unknown lap number')
        
        # Prepara l'elemento da salvare usando l'oggetto pulito e convertito
        response = table.put_item(Item=event_clean)
        
        print(f"Salvataggio completato, giro:  {lap_time} al giro: {lap_number}")
        return {
            'statusCode': 200,
            'body': json.dumps('Dati del giro salvati correttamente su DynamoDB!')
        }
        
    except ClientError as e:
        print("Errore durante la scrittura su DynamoDB:", e.response['Error']['Message'])
        return {
            'statusCode': 500,
            'body': json.dumps(f"Errore interno: {e.response['Error']['Message']}")
        }
