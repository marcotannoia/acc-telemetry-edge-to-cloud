import json
import os
import urllib.error
import urllib.request
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError
from strategy import StrategyEvaluator


TABLE_NAME = os.environ.get("DYNAMO_TABLE", "analytics_dashboard_dynamo")
DEFAULT_USER_ID = os.environ.get("DEFAULT_USER_ID", "personal-user")
OPENAI_SECRET_ARN = os.environ.get("OPENAI_API_KEY_SECRET_ARN", "")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4.1-mini")
OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"

dynamodb = boto3.resource("dynamodb")
secretsmanager = boto3.client("secretsmanager")
table = dynamodb.Table(TABLE_NAME)

# -- FUNZIONI DI CONTROLLO PROTOCOLLI -- 

def _response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "OPTIONS,POST",
        },
        "body": json.dumps(body, ensure_ascii=False),
    }


def _parse_event(event):
    if isinstance(event, dict) and "body" in event:
        body = event.get("body") or {}
        if isinstance(body, str):
            return json.loads(body) if body else {}
        return body
    return event or {}


def _clean_text(value): # serve per pulire la formattazione di acc
    if not isinstance(value, str):
        return value
    return value.replace("\u0000", "").strip()


def _to_dynamo_value(value): # convertiamo tutti i float in decimal per dynamo
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, dict):
        return {key: _to_dynamo_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_to_dynamo_value(item) for item in value]
    return value


def _to_json_value(value): # qui facciamo il cotnrario, prendiamo la risposta decimale la convertiamo in json
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    if isinstance(value, dict):
        return {key: _to_json_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_to_json_value(item) for item in value]
    return value

# ----------
# -- ACQUISIZIONE GIRO --
def _lap_number(lap):
    try:
        return int(lap.get("lap_number", -1))
    except (TypeError, ValueError):
        return -1


def _is_lap_record(item):
    return item.get("record_type") in (None, "", "lap")

# -- ACQUISIZIONE GIRI SEZIONE

def _latest_lap_sequence(laps):
    sequence = []
    for lap in laps:
        sequence.append(lap)
        if _lap_number(lap) <= 1:
            break
    return sequence

# -- ACQUISIZIONE GIRI SESSIONE -- 

def _event_user_id(event, payload):
    authorizer = event.get("requestContext", {}).get("authorizer", {}) if isinstance(event, dict) else {}
    claims = authorizer.get("claims") or authorizer.get("jwt", {}).get("claims", {})
    return payload.get("user_id") or claims.get("sub") or claims.get("username") or DEFAULT_USER_ID


def get_recent_laps(user_id=None, driver=None, track=None, session_id=None, limit= None , search_limit=30): # SERCH_LIMIT: indica quante pull di dati ottengo ad ogni query
    if not user_id and not driver:
        return []

    laps = []
    start_key = None

    try:
        while True:
            query_args = {
                "ScanIndexForward": False, # ordinati dal piu recente
                "Limit": search_limit,
            }
            if user_id:
                query_args["IndexName"] = "user-timestamp-index"
                query_args["KeyConditionExpression"] = Key("user_id").eq(user_id)
            else:
                query_args["KeyConditionExpression"] = Key("driver").eq(driver)
            if start_key:
                query_args["ExclusiveStartKey"] = start_key

            response = table.query(**query_args)  

            page_laps = response.get("Items", []) # prende i giri 
            page_laps = [lap for lap in page_laps if _is_lap_record(lap)]
            if session_id:
                page_laps = [lap for lap in page_laps if lap.get("session_id") == session_id]
            if track:
                page_laps = [lap for lap in page_laps if lap.get("track") == track]

            laps.extend(page_laps)
            if session_id and any(_lap_number(lap) <= 1 for lap in laps):
                break
            if not session_id and limit is not None and len(laps) >= limit:
                break

            start_key = response.get("LastEvaluatedKey")
            if not start_key:
                break
    except ClientError as error:
        print("Storico giri non disponibile:", error.response["Error"]["Message"])
        return []

    if session_id:
        laps = _latest_lap_sequence(laps)

    selected_laps = laps if limit is None else laps[:limit]
    return list(reversed(selected_laps))


def enrich_lap_with_strategy(lap):
    session_id = lap.get("session_id")
    recent_laps = get_recent_laps(
        user_id=lap.get("user_id"),
        driver=lap.get("driver"),
        track=lap.get("track"),
        session_id=session_id,
        limit=None if session_id else 4,
        search_limit=120,
    )
    strategy_window = max(len(recent_laps) + 1, 5) if session_id else 5
    strategy = StrategyEvaluator(last_laps=strategy_window)
    strategy.load_history(recent_laps)
    lap.update(strategy.add_lap(lap))
    return lap


def health_check():
    return _response(200, {
        "message": "Lambda online.",
        "dynamo_table": TABLE_NAME,
        "default_user_id": DEFAULT_USER_ID,
        "openai_secret_configured": bool(OPENAI_SECRET_ARN),
        "openai_model": OPENAI_MODEL,
    })


def _live_state_key(user_id):
    return {
        "driver": f"LIVE#{user_id or DEFAULT_USER_ID}",
        "timestamp": "current",
    }


def save_live_state(payload):
    user_id = payload.get("user_id") or DEFAULT_USER_ID
    key = _live_state_key(user_id)
    state = dict(payload)
    state.pop("action", None)
    state.pop("user_id", None)

    state["record_type"] = "live_state"
    state["live_user_id"] = user_id
    state["live_updated_at"] = state.get("timestamp")
    state["driver_name"] = _clean_text(state.get("driver"))
    state["track"] = _clean_text(state.get("track"))
    state["driver"] = key["driver"]
    state["timestamp"] = key["timestamp"]

    try:
        table.put_item(Item=_to_dynamo_value(state))
    except ClientError as error:
        print("Errore scrittura live state:", error.response["Error"]["Message"])
        return _response(500, {"message": "Errore durante il salvataggio dello stato live."})

    return _response(200, {"message": "Stato live aggiornato."})


def get_live_state(payload):
    user_id = payload.get("user_id") or DEFAULT_USER_ID
    session_id = payload.get("session_id")

    try:
        response = table.get_item(Key=_live_state_key(user_id))
    except ClientError as error:
        print("Live state non disponibile:", error.response["Error"]["Message"])
        return _response(500, {"message": "Errore durante la lettura dello stato live."})

    state = response.get("Item")
    if not state:
        return _response(200, {"live_state": None})

    state = _to_json_value(state)
    state.pop("driver", None)
    state.pop("timestamp", None)
    state.pop("record_type", None)
    state.pop("live_user_id", None)

    if session_id and state.get("session_id") != session_id:
        return _response(200, {"live_state": None})

    return _response(200, {"live_state": state})


def save_lap(payload):
    lap = dict(payload)
    lap["record_type"] = "lap"
    lap["user_id"] = lap.get("user_id") or DEFAULT_USER_ID
    lap["driver"] = _clean_text(lap.get("driver"))
    lap["track"] = _clean_text(lap.get("track"))
    lap = enrich_lap_with_strategy(lap)

    try:
        table.put_item(Item=_to_dynamo_value(lap))
    except ClientError as error:
        print("Errore scrittura DynamoDB:", error.response["Error"]["Message"])
        return _response(500, {"message": "Errore durante il salvataggio del giro."})

    print(
        "Giro salvato:",
        json.dumps({
            "driver": lap.get("driver"),
            "track": lap.get("track"),
            "lap_number": lap.get("lap_number"),
            "lap_time_ms": lap.get("lap_time_ms"),
        }),
    )
    return _response(200, {"message": "Giro salvato correttamente.", "lap": _to_json_value(lap)})


def list_sessions(payload):
    user_id = payload.get("user_id") or DEFAULT_USER_ID
    laps = get_recent_laps(user_id=user_id, limit=int(payload.get("limit", 300)), search_limit=120)
    sessions = {}

    for lap in laps:
        session_id = lap.get("session_id") or "sessione_sconosciuta"
        summary = sessions.setdefault(session_id, {
            "session_id": session_id,
            "track": lap.get("track"),
            "driver": lap.get("driver"),
            "session_type": lap.get("session_type"),
            "session_started_at": lap.get("session_started_at"),
            "first_lap": _lap_number(lap),
            "last_lap": _lap_number(lap),
            "lap_count": 0,
            "last_timestamp": lap.get("timestamp"),
            "latest_lap": {},
        })
        lap_number = _lap_number(lap)
        summary["first_lap"] = min(summary["first_lap"], lap_number)
        summary["last_lap"] = max(summary["last_lap"], lap_number)
        summary["lap_count"] += 1
        summary["last_timestamp"] = lap.get("timestamp") or summary["last_timestamp"]
        summary["latest_lap"] = compact_lap(lap)

    return _response(200, {
        "user_id": user_id,
        "sessions": list(sessions.values()),
    })


def get_session_laps(payload):
    user_id = payload.get("user_id") or DEFAULT_USER_ID
    session_id = payload.get("session_id")

    if not session_id:
        return _response(400, {"message": "Parametro session_id obbligatorio."})

    laps = get_recent_laps(
        user_id=user_id,
        track=payload.get("track"),
        session_id=session_id,
        limit=None,
        search_limit=120,
    )
    return _response(200, {
        "user_id": user_id,
        "session_id": session_id,
        "laps": _to_json_value(laps),
    })


def read_openai_api_key():
    if not OPENAI_SECRET_ARN:
        raise RuntimeError("OPENAI_API_KEY_SECRET_ARN non configurato sulla Lambda.")

    secret = secretsmanager.get_secret_value(SecretId=OPENAI_SECRET_ARN)
    secret_string = secret.get("SecretString", "")

    try:
        secret_json = json.loads(secret_string)
        api_key = secret_json.get("OPENAI_API_KEY") or secret_json.get("api_key")
    except json.JSONDecodeError:
        api_key = secret_string

    if not api_key:
        raise RuntimeError("Secret OpenAI vuoto o in formato non valido.")

    return api_key.strip()


def compact_lap(lap):
    lap = _to_json_value(lap)
    return {
        "user_id": lap.get("user_id"),
        "lap_number": lap.get("lap_number"),
        "session_id": lap.get("session_id"),
        "session_type": lap.get("session_type"),
        "lap_time_ms": lap.get("lap_time_ms"),
        "is_valid_lap": lap.get("is_valid_lap"),
        "sector_times_ms": lap.get("sector_times_ms"),
        "max_speed_kmh": lap.get("max_speed_kmh"),
        "min_speed_kmh": lap.get("min_speed_kmh"),
        "avg_gas_percent": lap.get("avg_gas_percent"),
        "avg_brake_percent": lap.get("avg_brake_percent"),
        "max_rpm": lap.get("max_rpm"),
        "max_g_force": lap.get("max_g_force"),
        "fuel_left_L": lap.get("fuel_left_L"),
        "fuel_consumed_L": lap.get("fuel_consumed_L"),
        "fuel_per_km_L": lap.get("fuel_per_km_L"),
        "fuel_laps_possible": lap.get("fuel_laps_possible"),
        "avg_tyre_core_C": lap.get("avg_tyre_core_C"),
        "avg_tyre_inner_C": lap.get("avg_tyre_inner_C"),
        "avg_tyre_middle_C": lap.get("avg_tyre_middle_C"),
        "avg_tyre_outer_C": lap.get("avg_tyre_outer_C"),
        "avg_tyre_wear": lap.get("avg_tyre_wear"),
        "tyre_wear_available": lap.get("tyre_wear_available"),
        "avg_brake_temp_C": lap.get("avg_brake_temp_C"),
        "mfd_tyre_pressure": lap.get("mfd_tyre_pressure"),
        "slip_events_by_sector": lap.get("slip_events_by_sector"),
        "max_slip_by_sector": lap.get("max_slip_by_sector"),
        "max_slip_by_tyre": lap.get("max_slip_by_tyre"),
        "tyre_age_laps": lap.get("tyre_age_laps"),
        "air_temp_C": lap.get("air_temp_C"),
        "road_temp_C": lap.get("road_temp_C"),
        "track_grip_status": lap.get("track_grip_status"),
        "remaining_laps": lap.get("remaining_laps"),
        "position": lap.get("position"),
        "gap_ahead_ms": lap.get("gap_ahead_ms"),
        "gap_behind_ms": lap.get("gap_behind_ms"),
        "strategy_push_level": lap.get("strategy_push_level"),
        "strategy_warning": lap.get("strategy_warning"),
        "strategy_advice": lap.get("strategy_advice"),
    }


def extract_openai_text(response_body):
    if response_body.get("output_text"):
        return response_body["output_text"]

    texts = []
    for item in response_body.get("output", []):
        for content in item.get("content", []):
            text = content.get("text")
            if text:
                texts.append(text)
    return "\n".join(texts).strip()


def ask_openai_engineer(driver, track, question, laps):
    api_key = read_openai_api_key()
    context = {
        "driver": driver,
        "track": track,
        "engineer_question": question,
        "recent_laps": [compact_lap(lap) for lap in laps],
    }

    request_body = {
        "model": OPENAI_MODEL,
        "input": [
            {
                "role": "system",
                "content": (
                    "Sei un assistente per un ingegnere di pista in Assetto Corsa "
                    "Competizione. Usa solo i dati forniti, non inventare telemetria "
                    "mancante, distingui fatti osservati e ipotesi, e rispondi in italiano. "
                    "Usa un formato chiaro con frasi brevi: Priorita, Rischio, Azione, Monitoraggio."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(context, ensure_ascii=False),
            },
        ],
        "max_output_tokens": 700,
    }

    request = urllib.request.Request(
        OPENAI_RESPONSES_URL,
        data=json.dumps(request_body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            response_body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8")
        raise RuntimeError(f"OpenAI API error {error.code}: {detail[:500]}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"OpenAI API non raggiungibile: {error.reason}") from error

    text = extract_openai_text(response_body)
    if not text:
        raise RuntimeError("OpenAI non ha restituito testo utile.")
    return text


def handle_ai_insight(payload):
    user_id = payload.get("user_id") or DEFAULT_USER_ID
    driver = _clean_text(payload.get("driver"))
    track = _clean_text(payload.get("track"))
    session_id = payload.get("session_id")
    question = payload.get(
        "question",
        "Analizza gli ultimi giri e indica priorita', rischi e azione consigliata.",
    )
    limit = int(payload.get("limit", 80))

    if not user_id:
        return _response(400, {"message": "Parametro user_id obbligatorio."})

    laps = get_recent_laps(
        user_id=user_id,
        driver=driver,
        track=track,
        session_id=session_id,
        limit=limit,
        search_limit=max(limit * 3, 120),
    )
    if not laps:
        return _response(404, {"message": "Nessun giro trovato per la richiesta AI."})

    try:
        insight = ask_openai_engineer(driver, track, question, laps)
    except (RuntimeError, ClientError) as error:
        print("Errore AI insight:", str(error))
        return _response(502, {"message": "Analisi AI non disponibile.", "detail": str(error)})

    return _response(200, {
        "user_id": user_id,
        "driver": driver,
        "track": track,
        "session_id": session_id,
        "model": OPENAI_MODEL,
        "laps_analyzed": len(laps),
        "question": question,
        "ai_engineer_insight": insight,
    })


def handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method") if isinstance(event, dict) else None
    if method == "OPTIONS":
        return _response(204, {})

    payload = _parse_event(event)
    payload["user_id"] = _event_user_id(event, payload)

    if payload.get("action") == "health_check":
        return health_check()
    if payload.get("action") == "live_update":
        return save_live_state(payload)
    if payload.get("action") == "get_live_state":
        return get_live_state(payload)
    if payload.get("action") == "list_sessions":
        return list_sessions(payload)
    if payload.get("action") == "get_session_laps":
        return get_session_laps(payload)
    if payload.get("action") == "ai_insight":
        return handle_ai_insight(payload)

    return save_lap(payload)
