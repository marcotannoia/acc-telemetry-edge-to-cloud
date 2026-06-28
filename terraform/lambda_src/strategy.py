from collections import deque


LAST_LAPS_TO_CHECK = 5
HOT_TEMP_DELTA_C = 5.0 # soglia per valutare il trend della temperatura gomme
QUALI_LAP_MARGIN = 1.0 #lo introduco per un margine di sicurezza nel calcolo dei giri xrimanenti


def _to_float(value, default=0.0): #funzione di conversione float per dynamo
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _average(values): # funzione avg 
    numbers = [_to_float(value) for value in values if value is not None]
    return sum(numbers) / len(numbers) if numbers else 0.0


def _average_tyres(avg_tyre_core): #funzione di rappresentazione avg tyre core
    if not isinstance(avg_tyre_core, dict):
        return _to_float(avg_tyre_core)

    return _average([
        avg_tyre_core.get("fl"),
        avg_tyre_core.get("fr"),
        avg_tyre_core.get("rl"),
        avg_tyre_core.get("rr"),
    ])

#--- STATUS TEMPERATURA INTERNA GOMME --

def tyre_core_status(lap):  
    avg_temp = _average_tyres(lap.get("avg_tyre_core_C", {}))

    if avg_temp <= 0:
        return "non_disponibile", avg_temp
    if avg_temp < 70:
        return "freddo", avg_temp
    if avg_temp < 90:
        return "ottimale", avg_temp
    if avg_temp < 100:
        return "caldo", avg_temp
    return "estremamente_caldo", avg_temp

#--- CONSIGLI TEMPERATURA INTERNA GOMME -- 

def tyre_advice(lap):
    status, avg_temp = tyre_core_status(lap)

    messages = {
        "non_disponibile": "Temperatura gomme non disponibile.",
        "freddo": f"Gomme fredde ({avg_temp:.1f} C): scalda meglio prima di spingere.",
        "ottimale": f"Temperatura gomme ottimale ({avg_temp:.1f} C).",
        "caldo": f"Gomme calde ({avg_temp:.1f} C): guida piu' pulita in uscita curva.",
        "estremamente_caldo": f"Gomme troppo calde ({avg_temp:.1f} C): raffreddare il ritmo.",
    }
    return messages[status]

# -- STATUS GRIP -- 
def grip_status(lap):
    raw_grip = lap.get("track_grip_status")
    if raw_grip is None:
        return "non_disponibile"

    text = str(raw_grip).lower()
    if "optimum" in text:
        return "ottimo"
    if "fast" in text:
        return "buono"
    if "green" in text or "greasy" in text:
        return "medio"
    if "damp" in text or "wet" in text or "flooded" in text:
        return "basso"

    value = _to_float(raw_grip)
    if value > 0.8:
        return "ottimo"
    if value > 0.5:
        return "buono"
    if value > 0.2:
        return "medio"
    return "basso"

# -- CONSIGLI GRIP --
def grip_advice(lap):
    status = grip_status(lap)

    messages = {
        "non_disponibile": "Grip pista non disponibile.",
        "ottimo": "Pista in ottime condizioni: il pilota puo' spingere.",
        "buono": "Pista buona: si puo' spingere con margine.",
        "medio": "Grip medio: aumentare il margine in frenata.",
        "basso": "Grip basso: evitare input bruschi e sorpassi rischiosi.",
    }
    return messages[status]

# -- STATUS FUEL INIZIALE -- 

def fuel_status(lap):
    fuel_left = _to_float(lap.get("fuel_left_L"))
    fuel_start = _to_float(lap.get("fuel_start_L"))

    if fuel_start <= 0:
        return "non_disponibile", fuel_left, 0.0

    fuel_ratio = fuel_left / fuel_start
    if fuel_ratio < 0.20:
        return "critico", fuel_left, fuel_ratio
    if fuel_ratio < 0.50:
        return "medio", fuel_left, fuel_ratio
    return "ok", fuel_left, fuel_ratio

# --  PLANS PER LA STRATEGIA DEL CARBURANTE --

def fuel_plan(lap):
    fuel_left = _to_float(lap.get("fuel_left_L"))
    fuel_per_km = _to_float(lap.get("fuel_per_km_L"))
    track_length_km = _to_float(lap.get("track_length_km"))
    remaining_laps = _to_float(lap.get("remaining_laps"), None)

    if fuel_left <= 0 or fuel_per_km <= 0 or track_length_km <= 0:
        return {
            "status": "non_disponibile",
            "laps_possible": 0.0,
            "message": "Previsione fuel non disponibile: mancano consumo o lunghezza pista.",
        }

    fuel_per_lap = fuel_per_km * track_length_km
    laps_possible = fuel_left / fuel_per_lap if fuel_per_lap > 0 else 0.0

    if remaining_laps is None: # se non so quanti giri mancano 
        return {
            "status": "ok",
            "laps_possible": round(laps_possible, 2),
            "message": f"Con questo consumo puoi fare circa {laps_possible:.1f} giri.",
        }

    if laps_possible < remaining_laps:
        status = "risparmia"
        message = (
            f"Fuel insufficiente: puoi fare {laps_possible:.1f} giri, "
            f"ma ne restano {remaining_laps:.0f}."
        )
    elif laps_possible <= remaining_laps + QUALI_LAP_MARGIN: # in realta vale anche per la gara
        status = "giro_qualifica"
        message = (
            f"Fuel al limite: {laps_possible:.1f} giri possibili su "
            f"{remaining_laps:.0f} rimanenti."
        )
    else:
        status = "spingi"
        message = (
            f"Fuel sufficiente: {laps_possible:.1f} giri possibili "
            f"su {remaining_laps:.0f} rimanenti."
        )

    return {
        "status": status,
        "laps_possible": round(laps_possible, 2),
        "message": message,
    }

# -- CONSIGLI SUL FUEL STATUS -- 

def fuel_advice(lap):
    status, fuel_left, _ = fuel_status(lap)

    if status == "non_disponibile":
        return "Fuel iniziale non disponibile."
    if status == "critico":
        return f"Fuel critico ({fuel_left:.1f} L): valutare rientro o lift and coast."
    if status == "medio":
        return f"Fuel sotto meta' serbatoio ({fuel_left:.1f} L): monitorare il consumo."
    return f"Fuel ok ({fuel_left:.1f} L)."

# -- CONTEGGIO NUMERO DI SLITTAMENTO PER SETTORE 

def slip_advice(lap):
    events = lap.get("slip_events_by_sector", {})
    if not isinstance(events, dict) or not events:
        return "Slip non disponibile."

    sector, count = max(events.items(), key=lambda item: _to_float(item[1]))
    if _to_float(count) <= 0:
        return "Nessuno slittamento rilevante nel giro."

    max_by_sector = lap.get("max_slip_by_sector", {})
    max_slip = _to_float(max_by_sector.get(str(sector)))
    return (
        f"Slip concentrato nel settore {sector}: {int(_to_float(count))} eventi, "
        f"picco {max_slip:.1f}."
    )

# -- TREND TEMPERATURE ULTIMI 5 GIRI -- 

def tyre_temperature_trend_advice(lap_history, last_laps=LAST_LAPS_TO_CHECK): # questa e la functiom che mi crea la necessita di avere una classes
    valid_laps = [
        lap for lap in lap_history
        if lap.get("is_valid_lap") is True and _to_float(lap.get("lap_time_ms")) > 0
    ][-last_laps:] # prende solamente gli ultimi 5 giri da lap history

    if len(valid_laps) < last_laps:
        return f"Dati temperatura insufficienti: servono almeno {last_laps} giri validi."

    lap_temps = [_average_tyres(lap.get("avg_tyre_core_C", {})) for lap in valid_laps]
    avg_temp = _average(lap_temps)
    temp_delta = lap_temps[-1] - lap_temps[0] # confronto il primo dei 5 giri con quello attuale

    if abs(temp_delta) < HOT_TEMP_DELTA_C:
        return (
            f"Temperature gomme stabili negli ultimi {last_laps} giri "
            f"(media {avg_temp:.1f} C)."
        )

    if temp_delta > 0:
        return (
            f"Temperature gomme in crescita negli ultimi {last_laps} giri "
            f"(+{temp_delta:.1f} C): gestire sliding e trazione."
        )

    return (
        f"Temperature gomme in calo negli ultimi {last_laps} giri "
        f"({temp_delta:.1f} C): valutare warm-up o ritmo piu' aggressivo."
    )

# -- STRATEGIA FINALE -- 

def driving_strategy(lap):
    tyre_status_value, _ = tyre_core_status(lap)
    track_status = grip_status(lap)
    tank_status, _, _ = fuel_status(lap)
    plan = fuel_plan(lap)

    if plan["status"] == "risparmia":
        return {
            "push_level": "risparmia",
            "warning": True,
            "summary": "Il fuel previsto non copre i giri rimanenti.",
            "compromises": ["Lift and coast nelle zone veloci.", "Evitare difese aggressive."],
        }

    if tyre_status_value in ("caldo", "estremamente_caldo"):
        return {
            "push_level": "raffredda_gomme",
            "warning": True,
            "summary": "Il limite principale sono le temperature gomme.",
            "compromises": ["Ridurre sliding in uscita curva.", "Evitare cordoli aggressivi."],
        }

    if track_status in ("medio", "basso"):
        return {
            "push_level": "pista_non_pronta",
            "warning": True,
            "summary": "La pista non consente ancora un push pulito.",
            "compromises": ["Aumentare margine in frenata.", "Evitare manovre ad alto rischio."],
        }

    if tyre_status_value == "ottimale" and track_status in ("ottimo", "buono") and tank_status != "critico":
        if plan["status"] == "giro_qualifica":
            return {
                "push_level": "qualifica_singola",
                "warning": True,
                "summary": "Condizioni buone, ma fuel al limite: push massimo per un giro.",
                "compromises": ["Spingere un solo giro.", "Poi tornare in gestione carburante."],
            }

        return {
            "push_level": "spingi",
            "warning": False,
            "summary": "Fuel, grip e gomme sono favorevoli.",
            "compromises": ["Monitorare il settore piu' caldo e gli eventi di slip."],
        }

    return {
        "push_level": "gestisci",
        "warning": False,
        "summary": "Situazione mista: ritmo controllato e rivalutazione al prossimo giro.",
        "compromises": ["Monitorare fuel, grip e temperatura gomme."],
    }



class StrategyEvaluator:
    def __init__(self, last_laps=LAST_LAPS_TO_CHECK):
        self.last_laps = last_laps
        self.lap_history = deque(maxlen=last_laps)

    def load_history(self, laps):
        for lap in laps[-self.last_laps:]:
            self.lap_history.append(lap)

    def add_lap(self, lap):
        self.lap_history.append(lap)

        plan = fuel_plan(lap)
        strategy = driving_strategy(lap)
        advice = [
            tyre_advice(lap),
            fuel_advice(lap),
            plan["message"],
            grip_advice(lap),
            slip_advice(lap),
            tyre_temperature_trend_advice(list(self.lap_history), self.last_laps),
            f"Strategia: {strategy['summary']}",
        ]

        return {
            "strategy_advice": " | ".join(advice),
            "strategy_warning": strategy["warning"],
            "strategy_push_level": strategy["push_level"],
            "strategy_compromises": strategy["compromises"],
            "fuel_laps_possible": plan["laps_possible"],
            "fuel_strategy_status": plan["status"],
        }
