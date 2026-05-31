from collections import deque


# -- SOGLIE STRATEGIA --
LAST_LAPS_TO_CHECK = 5
HOT_TEMP_DELTA_C = 2.0
QUALI_LAP_MARGIN = 1.0


def _to_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _media_valori(valori):
    valori_validi = [_to_float(valore) for valore in valori if valore is not None]
    if not valori_validi:
        return 0.0
    return sum(valori_validi) / len(valori_validi)


def _media_gomme(avg_tyre_core):
    if not isinstance(avg_tyre_core, dict):
        return _to_float(avg_tyre_core)

    return _media_valori([
        avg_tyre_core.get("fl"),
        avg_tyre_core.get("fr"),
        avg_tyre_core.get("rl"),
        avg_tyre_core.get("rr"),
    ])


# -- SEZIONE GESTIONE TYRE CORE --
def tyre_core_status(lap_payload):
    temp_media = _media_gomme(lap_payload.get("avg_tyre_core_C", {}))

    if temp_media <= 0:
        return "non_disponibile", temp_media
    elif temp_media < 70:
        return "freddo", temp_media
    elif 70 <= temp_media < 90:
        return "ottimale", temp_media
    elif 90 <= temp_media < 100:
        return "caldo", temp_media
    else:
        return "estremamente_caldo", temp_media


def check_tyre_core(lap_payload):
    stato_gomme, temp_media = tyre_core_status(lap_payload)

    if stato_gomme == "non_disponibile":
        return "Temperatura gomme non disponibile."
    elif stato_gomme == "freddo":
        return f"Gomme fredde ({temp_media:.1f} C): scalda meglio le gomme prima di spingere."
    elif stato_gomme == "ottimale":
        return f"Temperatura gomme ottimale ({temp_media:.1f} C)."
    elif stato_gomme == "caldo":
        return f"Gomme calde ({temp_media:.1f} C): guida piu' pulita e riduci lo stress in uscita curva."
    else:
        return f"Gomme estremamente calde ({temp_media:.1f} C): rallenta e raffredda il ritmo."


# -- SEZIONE GESTIONE GRIP --
def grip_status(lap_payload):
    track_grip_status = lap_payload.get("track_grip_status")

    if track_grip_status is None:
        return "non_disponibile"

    grip_text = str(track_grip_status).lower()
    if "optimum" in grip_text:
        return "ottimo"
    elif "fast" in grip_text:
        return "buono"
    elif "green" in grip_text or "greasy" in grip_text:
        return "medio"
    elif "damp" in grip_text or "wet" in grip_text or "flooded" in grip_text:
        return "basso"

    grip_value = _to_float(track_grip_status)
    if grip_value > 0.8:
        return "ottimo"
    elif 0.5 < grip_value <= 0.8:
        return "buono"
    elif 0.2 < grip_value <= 0.5:
        return "medio"
    else:
        return "basso"


def grip(lap_payload):
    stato_grip = grip_status(lap_payload)

    if stato_grip == "non_disponibile":
        return "Grip pista non disponibile."
    elif stato_grip == "ottimo":
        return "Pista in ottime condizioni: puoi spingere."
    elif stato_grip == "buono":
        return "Pista in buone condizioni: puoi spingere, ma senza esagerare."
    elif stato_grip == "medio":
        return "Pista in condizioni medie: guida con margine."
    else:
        return "Pista con poco grip: evita movimenti bruschi."


# -- SEZIONE GESTIONE FUEL --
def fuel_status(lap_payload):
    fuel_left = _to_float(lap_payload.get("fuel_left_L"))
    fuel_start = _to_float(lap_payload.get("fuel_start_L"))

    if fuel_start <= 0:
        return "non_disponibile", fuel_left, 0.0

    fuel_percent = fuel_left / fuel_start

    if fuel_percent < 0.20:
        return "critico", fuel_left, fuel_percent
    elif 0.20 <= fuel_percent < 0.50:
        return "medio", fuel_left, fuel_percent
    else:
        return "ok", fuel_left, fuel_percent


def fuel_level(lap_payload):
    stato_fuel, fuel_left, _ = fuel_status(lap_payload)

    if stato_fuel == "non_disponibile":
        return "Fuel iniziale non disponibile."
    elif stato_fuel == "critico":
        return f"Fuel critico ({fuel_left:.1f} L): valuta il rientro ai box."
    elif stato_fuel == "medio":
        return f"Fuel sotto meta' serbatoio ({fuel_left:.1f} L): controlla consumo e strategia."
    else:
        return f"Fuel ok ({fuel_left:.1f} L)."


def fuel_prediction(lap_payload):
    fuel_left = _to_float(lap_payload.get("fuel_left_L"))
    fuel_per_km = _to_float(lap_payload.get("fuel_per_km_L"))
    track_length_km = _to_float(lap_payload.get("track_length_km"))
    remaining_laps = _to_float(lap_payload.get("remaining_laps"), None)

    if fuel_left <= 0 or fuel_per_km <= 0 or track_length_km <= 0:
        return {
            "status": "non_disponibile",
            "laps_possible": 0.0,
            "message": "Previsione fuel non disponibile: servono consumo e lunghezza pista."
        }

    fuel_per_lap = fuel_per_km * track_length_km
    laps_possible = fuel_left / fuel_per_lap if fuel_per_lap > 0 else 0.0

    if remaining_laps is None:
        return {
            "status": "ok",
            "laps_possible": round(laps_possible, 2),
            "message": f"Con questo consumo puoi fare circa {laps_possible:.1f} giri."
        }

    if laps_possible < remaining_laps:
        return {
            "status": "risparmia",
            "laps_possible": round(laps_possible, 2),
            "message": (
                f"Fuel insufficiente: puoi fare {laps_possible:.1f} giri, "
                f"ma ne restano {remaining_laps:.0f}. Risparmia carburante."
            )
        }
    elif laps_possible <= remaining_laps + QUALI_LAP_MARGIN:
        return {
            "status": "giro_qualifica",
            "laps_possible": round(laps_possible, 2),
            "message": (
                f"Fuel al limite: puoi fare {laps_possible:.1f} giri su {remaining_laps:.0f} rimanenti. "
                "Puoi spingere solo per un giro, poi devi gestire."
            )
        }
    else:
        return {
            "status": "spingi",
            "laps_possible": round(laps_possible, 2),
            "message": (
                f"Fuel sufficiente: puoi fare {laps_possible:.1f} giri "
                f"e ne restano {remaining_laps:.0f}. Puoi spingere."
            )
        }


def _sector_tyre_temp(lap_payload, sector):
    avg_tyre_core = lap_payload.get("avg_tyre_core_C", {})
    if not isinstance(avg_tyre_core, dict):
        return _to_float(avg_tyre_core)

    tyres_by_sector = {
        1: ["fl", "fr"],
        2: ["fr", "rr"],
        3: ["rl", "rr"],
    }

    return _media_valori(avg_tyre_core.get(tyre) for tyre in tyres_by_sector[sector])


# -- SEZIONE GESTIONE SETTORI --
def sector_temperature_advice(lap_history, last_laps=LAST_LAPS_TO_CHECK):
    valid_laps = [
        lap for lap in lap_history
        if lap.get("is_valid_lap") is True and _to_float(lap.get("lap_time_ms")) > 0
    ][-last_laps:]

    if len(valid_laps) < last_laps:
        return "Dati settori insufficienti: servono almeno 5 giri validi."

    avg_sector_temps = {}
    for sector in (1, 2, 3):
        sector_temps = [_sector_tyre_temp(lap, sector) for lap in valid_laps]
        avg_sector_temps[sector] = _media_valori(sector_temps)

    hottest_sector = max(avg_sector_temps, key=avg_sector_temps.get)
    coolest_sector_temp = min(avg_sector_temps.values())
    temp_delta = avg_sector_temps[hottest_sector] - coolest_sector_temp

    if temp_delta < HOT_TEMP_DELTA_C:
        return "Temperature settori bilanciate negli ultimi 5 giri."

    return (
        f"Settore {hottest_sector} piu' caldo negli ultimi {last_laps} giri "
        f"({avg_sector_temps[hottest_sector]:.1f} C): rallenta nel settore {hottest_sector}."
    )


# -- SEZIONE FUSIONE STRATEGIA --
def hybrid_strategy(lap_payload):
    stato_gomme, _ = tyre_core_status(lap_payload)
    stato_grip = grip_status(lap_payload)
    stato_fuel, _, _ = fuel_status(lap_payload)
    fuel_plan = fuel_prediction(lap_payload)

    compromessi = []
    condizioni_pista_ok = stato_grip in ("ottimo", "buono")
    gomme_veloci = stato_gomme == "ottimale"

    if fuel_plan["status"] == "risparmia":
        compromessi.append("Lift and coast nelle zone veloci.")
        compromessi.append("Evita difese aggressive se aumentano il consumo.")
        return {
            "push_level": "risparmia",
            "warning": True,
            "summary": "Non conviene spingere: il fuel previsto non copre i giri rimanenti.",
            "compromises": compromessi
        }

    if gomme_veloci and condizioni_pista_ok and fuel_plan["status"] == "giro_qualifica":
        compromessi.append("Spingere massimo un giro.")
        compromessi.append("Dopo il push lap tornare in gestione carburante.")
        return {
            "push_level": "qualifica_singola",
            "warning": True,
            "summary": "Condizioni ottime, ma fuel al limite: puoi tentare un giro da qualifica.",
            "compromises": compromessi
        }

    if gomme_veloci and condizioni_pista_ok and stato_fuel != "critico":
        if fuel_plan["status"] == "spingi":
            compromessi.append("Controlla solo il settore piu' caldo negli ultimi giri.")
            return {
                "push_level": "spingi",
                "warning": False,
                "summary": "Fuel, grip e gomme sono favorevoli: il pilota puo' spingere.",
                "compromises": compromessi
            }

        return {
            "push_level": "gestisci",
            "warning": False,
            "summary": "Buone condizioni, ma manca margine fuel chiaro: spingi con attenzione.",
            "compromises": ["Non prolungare lo stint in modalita' push."]
        }

    if stato_gomme in ("caldo", "estremamente_caldo"):
        compromessi.append("Riduci aggressivita' in uscita curva.")
        compromessi.append("Evita cordoli e sliding nelle curve lunghe.")
        return {
            "push_level": "raffredda_gomme",
            "warning": True,
            "summary": "Il limite principale sono le gomme: meglio raffreddarle prima di attaccare.",
            "compromises": compromessi
        }

    if stato_grip in ("medio", "basso"):
        compromessi.append("Aumenta margine in frenata.")
        compromessi.append("Evita sorpassi a rischio se la pista non e' pronta.")
        return {
            "push_level": "pista_non_pronta",
            "warning": True,
            "summary": "Fuel e gomme possono anche essere buoni, ma la pista non permette un push pulito.",
            "compromises": compromessi
        }

    return {
        "push_level": "gestisci",
        "warning": False,
        "summary": "Situazione mista: ritmo controllato e rivalutazione al prossimo giro.",
        "compromises": ["Monitorare fuel, grip e temperatura gomme prima di autorizzare il push."]
    }


class StrategyEvaluator:
    def __init__(self, last_laps=LAST_LAPS_TO_CHECK):
        self.last_laps = last_laps
        self.lap_history = deque(maxlen=last_laps)

    def load_history(self, lap_history):
        for lap in lap_history[-self.last_laps:]:
            self.lap_history.append(lap)

    def add_lap(self, lap_payload):
        self.lap_history.append(lap_payload)

        hybrid = hybrid_strategy(lap_payload)
        fuel_plan = fuel_prediction(lap_payload)
        advices = [
            check_tyre_core(lap_payload),
            fuel_level(lap_payload),
            fuel_plan["message"],
            grip(lap_payload),
            sector_temperature_advice(list(self.lap_history), self.last_laps),
            f"Strategia: {hybrid['summary']}",
        ]

        return {
            "strategy_advice": " | ".join(advices),
            "strategy_warning": hybrid["warning"],
            "strategy_push_level": hybrid["push_level"],
            "strategy_compromises": hybrid["compromises"],
            "fuel_laps_possible": fuel_plan["laps_possible"],
            "fuel_strategy_status": fuel_plan["status"],
        }
