import os
import time
import json
from datetime import datetime
from pyaccsharedmemory import accSharedMemory  
from awscrt import io, mqtt
from awsiot import mqtt_connection_builder
from cognito_auth import login_cognito_user

SLIP_THRESHOLD = 4.0 # soglia slip
IOT_ENDPOINT = "a2r71e9visju80-ats.iot.eu-south-1.amazonaws.com"
FRONTEND_API_URL = "https://iu9g1sfq9j.execute-api.eu-south-1.amazonaws.com/"


def write_frontend_runtime_config(user_id):
    """Scrive la configurazione che React legge all'avvio."""
    repo_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    public_dir = os.path.join(repo_dir, "frontend", "public")
    os.makedirs(public_dir, exist_ok=True)

    config_path = os.path.join(public_dir, "runtime-config.json")
    config = {
        "user_id": user_id,
        "api_url": FRONTEND_API_URL,
        "iot_endpoint": IOT_ENDPOINT,
    }

    with open(config_path, "w", encoding="utf-8") as config_file:
        json.dump(config, config_file, indent=2)

    print(f"Configurazione frontend aggiornata: {config_path}")

# setup della comunicazione mqtt
def setup_mqtt_connection():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    cert_path = os.path.join(script_dir, "device-certificate.pem.crt") 
    key_path = os.path.join(script_dir, "device-private.pem.key") #chiave segreta del certificato
    ca_path = os.path.join(script_dir, "AmazonRootCA1.pem") #questa serve al client per controllare se il server aws sia vero
    event_loop_group = io.EventLoopGroup(1) #serve per creare cicli di comunicazione, uso un solo thread
    host_resolver = io.DefaultHostResolver(event_loop_group) # trasforma endpoint in ip reale
    client_bootstrap = io.ClientBootstrap(event_loop_group, host_resolver) # prende quell ip e quel thread e crea un client 

    print(f"Inizializzazione TLS... Connessione a: {IOT_ENDPOINT}")

    mqtt_connection = mqtt_connection_builder.mtls_from_path(
        endpoint=IOT_ENDPOINT,
        cert_filepath=cert_path,
        pri_key_filepath=key_path,
        client_bootstrap=client_bootstrap,
        ca_filepath=ca_path,
        client_id="AccTelemetryEdge",
        clean_session=False,
        keep_alive_secs=30
    )

    connect_future = mqtt_connection.connect()
    connect_future.result()
    print("Connesso in sicurezza al Cloud!")
#certificato = badge da fattorino: “io sono autorizzato come AccTelemetryEdge”
#chiave privata = prova segreta che quel badge è davvero tuo
#AWS IoT policy = regole su cosa puoi consegnare e dove
#topic MQTT = indirizzo/citofono dove lasci la pizza
#AWS IoT Core = portineria che controlla badge e autorizzazioni
    return mqtt_connection



def start_local_test():
    user_id = login_cognito_user()
    write_frontend_runtime_config(user_id)
    asm = accSharedMemory()
    mqtt_conn = setup_mqtt_connection()

    last_completed_lap = -1
    tyre_stint_laps = 0
    was_in_pit = False
    last_tyre_set = None
    last_session_signature = None
    session_id = None
    session_started_at = None

 # -- INIZIALIZZAZIONE DATI GIRO   
    current_lap_data = { 
        "fuel_start": 0,
        "max_g_force": 0,
        "max_speed": 0,
        "min_speed": 999,
        "temps_core": {"fl": [], "fr": [], "rl": [], "rr": []},
        "temps_tyre_inner": {"fl": [], "fr": [], "rl": [], "rr": []},
        "temps_tyre_middle": {"fl": [], "fr": [], "rl": [], "rr": []},
        "temps_tyre_outer": {"fl": [], "fr": [], "rl": [], "rr": []},
        "temps_brake": {"fl": [], "fr": [], "rl": [], "rr": []},
        "tyre_core": {"fl": [], "fr": [], "rl": [], "rr": []},
        "gas_percent": [], 
        "brake_percent": [],
        "rpm": [],
        "best_time": 0,
        "sector_times": [0, 0, 0],
        "slip_events_by_sector": {"1": 0, "2": 0, "3": 0},
        "max_slip_by_sector": {"1": 0.0, "2": 0.0, "3": 0.0},
        "max_slip_by_tyre": {"fl": 0.0, "fr": 0.0, "rl": 0.0, "rr": 0.0},
        "last_sector": 0
    }
#------------------------------

    print("Sensore Telemetria Avviato. In attesa di ACC...")

    try:
        while True:
            sm = asm.read_shared_memory()
            if sm is None:
                time.sleep(0.05)  # LETTURA DATI OGNI 50ms
                continue

 #         -- ESTRAZIONE DATI SM ---
            physics = sm.Physics
            graphics = sm.Graphics
            static = sm.Static
#.          ----------------

        
#         -- INIZIALIZZAZIONE SM DATI --

            air_temp = physics.air_temp
            gap_ahead = graphics.gap_ahead
            gap_behind = graphics.gap_behind
            brake = physics.brake
            session_type = graphics.session_type.name if hasattr(graphics.session_type, 'name') else "UNKNOWN" #hasattr perche non so in che forma mi comunica il type
            penalty = graphics.penalty.name if hasattr(graphics.penalty, 'name') else "None"  # idem per la penalita
            is_valid_lap = graphics.is_valid_lap
            completed_laps = graphics.completed_lap
            num_laps = graphics.number_of_laps
            position = graphics.position
            session_index = getattr(graphics, "session_index", None)
            current_tyre_set = getattr(graphics, "current_tyre_set", None) #vedo se e un dato disponibile
            strategy_tyre_set = getattr(graphics, "strategy_tyre_set", None)
            mfd_tyre_set = getattr(graphics, "mfd_tyre_set", None)
            slip_fl = physics.wheel_slip.front_left
            slip_fr = physics.wheel_slip.front_right
            slip_rl = physics.wheel_slip.rear_left
            slip_rr = physics.wheel_slip.rear_right

#---------- ALGORITMO DI CONTROLLO FIRMA --
            session_signature = (static.player_name, static.track, session_type, session_index)
            lap_counter_reset = (
                last_completed_lap > 0
                and completed_laps >= 0
                and completed_laps < last_completed_lap
            )
            if session_signature != last_session_signature or lap_counter_reset: # se ce stato un cambio 
                session_started_at = datetime.now().strftime("%Y%m%d%H%M%S") # salvo il timestamp
                session_id = "_".join(
                    str(value).replace("\u0000", "").strip().replace(" ", "-")
                    for value in (*session_signature, session_started_at)
                )
                last_session_signature = session_signature
                if lap_counter_reset:
                    last_completed_lap = 0

            # -- casistica di pit -> reset eta gomme
            in_pit = graphics.is_in_pit if hasattr(graphics, 'is_in_pit') else False
            tyre_set_changed = (
                current_tyre_set is not None
                and last_tyre_set is not None
                and current_tyre_set != last_tyre_set
            )
            if tyre_set_changed or (was_in_pit and not in_pit): #was_in_pit indica in generale se sono stato ai pit al giro precedente
                tyre_stint_laps = 0
            if current_tyre_set is not None:
                last_tyre_set = current_tyre_set
            was_in_pit = in_pit


#--- AGGIORNAMENTO SETTORI IN TEMPO REALE ---
            current_sector = graphics.current_sector_index
            if current_sector != current_lap_data["last_sector"]: # leggo dati ogni 50ms, cosi vedo se dall'ultima lettura ho avuto un cambio settore 
                prev_sector = current_lap_data["last_sector"] # salvo quel settore come precedente 
                if 0 <= prev_sector <= 2:
                    current_lap_data["sector_times"][prev_sector] = graphics.last_sector_time # salvo il tempo di quel settore 
                current_lap_data["last_sector"] = current_sector # aggiorno il settore 
#-------- SEZIONE DI REGISTRAZIONE REAL TIME PARAMETRI ------------------

#----------- FUEL: OGNI GIRO AGGIORNA IL FUEL START  -- 
            if current_lap_data["fuel_start"] == 0 and physics.fuel > 0:
                current_lap_data["fuel_start"] = physics.fuel

#----------- MAX SPEED: OGNI GIRO AGGIORNA LA MAX SPEED -- 
            speed = physics.speed_kmh
            if speed > current_lap_data["max_speed"]: 
                current_lap_data["max_speed"] = speed
            if 0 < speed < current_lap_data["min_speed"]: 
                current_lap_data["min_speed"] = speed

#------------ GAS, BRAKE %: OGNI 50ms una %-- 
            if physics.gas > 0: current_lap_data["gas_percent"].append(physics.gas) #append perche nel payload gas_percent e una lista
            if physics.brake > 0: current_lap_data["brake_percent"].append(physics.brake)
            current_lap_data["rpm"].append(physics.rpm)

#------------ G-FORCE MAX: AGGIORNO AD OGNI GIRO --
            g_force = (physics.g_force.x**2 + physics.g_force.z**2)**0.5 # calcolo vettore z con pitagora
            if g_force > current_lap_data["max_g_force"]: 
                current_lap_data["max_g_force"] = g_force
                
#------------- SOLO CKECK SULLA VALIDITA DEL BEST TIME-- 
            best_time = graphics.best_time
            if best_time > 0 and (current_lap_data["best_time"] == 0 or best_time < current_lap_data["best_time"]):
                current_lap_data["best_time"] = best_time

#------------TEMPS CORE: OGNI 50ms -- 

            current_lap_data["temps_core"]["fl"].append(physics.tyre_core_temp.front_left) #temps core sarebbe una litsa
            current_lap_data["temps_core"]["fr"].append(physics.tyre_core_temp.front_right)
            current_lap_data["temps_core"]["rl"].append(physics.tyre_core_temp.rear_left)
            current_lap_data["temps_core"]["rr"].append(physics.tyre_core_temp.rear_right)

            current_lap_data["temps_tyre_inner"]["fl"].append(physics.tyre_temp_inner.front_left)
            current_lap_data["temps_tyre_inner"]["fr"].append(physics.tyre_temp_inner.front_right)
            current_lap_data["temps_tyre_inner"]["rl"].append(physics.tyre_temp_inner.rear_left)
            current_lap_data["temps_tyre_inner"]["rr"].append(physics.tyre_temp_inner.rear_right)

            current_lap_data["temps_tyre_middle"]["fl"].append(physics.tyre_temp_middle.front_left)
            current_lap_data["temps_tyre_middle"]["fr"].append(physics.tyre_temp_middle.front_right)
            current_lap_data["temps_tyre_middle"]["rl"].append(physics.tyre_temp_middle.rear_left)
            current_lap_data["temps_tyre_middle"]["rr"].append(physics.tyre_temp_middle.rear_right)

            current_lap_data["temps_tyre_outer"]["fl"].append(physics.tyre_temp_outer.front_left)
            current_lap_data["temps_tyre_outer"]["fr"].append(physics.tyre_temp_outer.front_right)
            current_lap_data["temps_tyre_outer"]["rl"].append(physics.tyre_temp_outer.rear_left)
            current_lap_data["temps_tyre_outer"]["rr"].append(physics.tyre_temp_outer.rear_right)
#------------ TEMPS BRAKE: ogni 50ms --

            current_lap_data["temps_brake"]["fl"].append(physics.brake_temp.front_left)
            current_lap_data["temps_brake"]["fr"].append(physics.brake_temp.front_right)
            current_lap_data["temps_brake"]["rl"].append(physics.brake_temp.rear_left)
            current_lap_data["temps_brake"]["rr"].append(physics.brake_temp.rear_right)

#------------PSI RUOTE                   -- 
            mfd_pressure = {
                "fl": round(graphics.mfd_tyre_pressure.front_left, 2),
                "fr": round(graphics.mfd_tyre_pressure.front_right, 2),
                "rl": round(graphics.mfd_tyre_pressure.rear_left, 2),
                "rr": round(graphics.mfd_tyre_pressure.rear_right, 2)
            }

#-------------MAX SLIP: CHECK SU SLITTAMENTO OGNI 50MS -- 
            current_lap_data["max_slip_by_tyre"]["fl"] = max(current_lap_data["max_slip_by_tyre"]["fl"], slip_fl)
            current_lap_data["max_slip_by_tyre"]["fr"] = max(current_lap_data["max_slip_by_tyre"]["fr"], slip_fr)
            current_lap_data["max_slip_by_tyre"]["rl"] = max(current_lap_data["max_slip_by_tyre"]["rl"], slip_rl)
            current_lap_data["max_slip_by_tyre"]["rr"] = max(current_lap_data["max_slip_by_tyre"]["rr"], slip_rr)

   #-------------- CONTROLLO SLITTAMENTO  ---------------------
            slip_warnings = []

            if speed > 30.0 and brake == 0: # cioe se sta a + di 30kmh e non sta frenando 
                if slip_fl > SLIP_THRESHOLD: slip_warnings.append(f"Ant-Sx ({slip_fl:.1f})")
                if slip_fr > SLIP_THRESHOLD: slip_warnings.append(f"Ant-Dx ({slip_fr:.1f})")
                if slip_rl > SLIP_THRESHOLD: slip_warnings.append(f"Post-Sx ({slip_rl:.1f})")
                if slip_rr > SLIP_THRESHOLD: slip_warnings.append(f"Post-Dx ({slip_rr:.1f})")

            if slip_warnings: # se la lista non e vuota 
                if 0 <= current_sector <= 2: 
                    sector_key = str(current_sector + 1)
                    max_slip = max(slip_fl, slip_fr, slip_rl, slip_rr)
                    current_lap_data["slip_events_by_sector"][sector_key] += 1
                    current_lap_data["max_slip_by_sector"][sector_key] = max(
                        current_lap_data["max_slip_by_sector"][sector_key],
                        max_slip
                    )
                print(f"\n⚠️ SLITTAMENTO RILEVATO: {', '.join(slip_warnings)}")

#------------STIMA GIRO: dato fornito dalla sm

            est_lap_ms = graphics.estimated_lap_time
            if 0 < est_lap_ms < 2147483647:
                 minutes = int(est_lap_ms // 60000)
                 seconds = int((est_lap_ms % 60000) // 1000)
                 est_lap_str = f"{minutes:02d}:{seconds:02d}"
            else:
                est_lap_str = "N/A"

#------------- RECAP TERMINALE 

            flag_str = "YEL" if graphics.global_yellow else "GRN"
            valid_str = "VAL" if is_valid_lap else "INV"
            live_status = (
                f"[{flag_str}|{valid_str}] L:{graphics.completed_lap} Est:{est_lap_str} | Sec:{current_sector+1} | "
                f"V:{speed:.0f} G:{current_lap_data['max_g_force']:.1f} | "
                f"Ty:[{physics.tyre_core_temp.front_left:.0f} {physics.tyre_core_temp.front_right:.0f} {physics.tyre_core_temp.rear_left:.0f} {physics.tyre_core_temp.rear_right:.0f}]"
            ) 
            print(f"\r{live_status:<120}", end='', flush=True)

#-------------- TRIGGER FINE GIRO 
            if graphics.completed_lap > last_completed_lap and graphics.completed_lap != -1:
                print(f"\n\n[!] GIRO {graphics.completed_lap} COMPLETATO! Elaborazione...")
                
                tyre_stint_laps += 1 
                fuel_consumed = current_lap_data["fuel_start"] - physics.fuel
                track_length_m = getattr(static, 'track_spline_length', getattr(static, 'trackSPlineLength', 0))
                track_length_km = track_length_m / 1000.0 if track_length_m > 0 else 1.0
                remaining_laps = max(num_laps - graphics.completed_lap, 0) if num_laps > 0 else None
                track_grip_status = getattr(graphics, "track_grip_status", None)

#----------------CALCOLO AVG 
                avg_core = {k: round(sum(v)/len(v), 2) for k, v in current_lap_data["temps_core"].items() if v}
                avg_tyre_inner = {k: round(sum(v)/len(v), 2) for k, v in current_lap_data["temps_tyre_inner"].items() if v}
                avg_tyre_middle = {k: round(sum(v)/len(v), 2) for k, v in current_lap_data["temps_tyre_middle"].items() if v}
                avg_tyre_outer = {k: round(sum(v)/len(v), 2) for k, v in current_lap_data["temps_tyre_outer"].items() if v}
                avg_brake = {k: round(sum(v)/len(v), 2) for k, v in current_lap_data["temps_brake"].items() if v}
                avg_gas = sum(current_lap_data["gas_percent"]) / len(current_lap_data["gas_percent"]) if current_lap_data["gas_percent"] else 0
                avg_brake_pedal = sum(current_lap_data["brake_percent"]) / len(current_lap_data["brake_percent"]) if current_lap_data["brake_percent"] else 0
                max_rpm = max(current_lap_data["rpm"]) if current_lap_data["rpm"] else 0
                fuel_per_km = fuel_consumed / track_length_km if fuel_consumed > 0 else 0

                # COSTRUZIONE DEL PAYLOAD
                payload = {
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "user_id": user_id,
                    "session_id": session_id,
                    "session_started_at": session_started_at,
                    "session_index": session_index,
                    "track": static.track,
                    "driver": static.player_name, 
                    "session_type": session_type, 
                    "lap_number": graphics.completed_lap,
                    "is_valid_lap": is_valid_lap,
                    "penalty": penalty,
                    "lap_time_ms": graphics.last_time, 
                    "best_time_ms": current_lap_data["best_time"],
                    "sector_times_ms": current_lap_data["sector_times"], 
                    "max_speed_kmh": round(current_lap_data["max_speed"], 2),
                    "min_speed_kmh": round(current_lap_data["min_speed"], 2),
                    "avg_gas_percent": round(avg_gas, 3),
                    "avg_brake_percent": round(avg_brake_pedal, 3),
                    "max_rpm": int(max_rpm),
                    "fuel_start_L": round(current_lap_data["fuel_start"], 3),
                    "fuel_consumed_L": round(fuel_consumed, 3),
                    "fuel_per_km_L": round(fuel_per_km, 3),
                    "track_length_km": round(track_length_km, 3),
                    "max_g_force": round(current_lap_data["max_g_force"], 2),
                    "avg_tyre_core_C": avg_core,
                    "avg_tyre_inner_C": avg_tyre_inner,
                    "avg_tyre_middle_C": avg_tyre_middle,
                    "avg_tyre_outer_C": avg_tyre_outer,
                    "avg_brake_temp_C": avg_brake,
                    "slip_events_by_sector": current_lap_data["slip_events_by_sector"],
                    "max_slip_by_sector": {
                        k: round(v, 2) for k, v in current_lap_data["max_slip_by_sector"].items()
                    },
                    "max_slip_by_tyre": {
                        k: round(v, 2) for k, v in current_lap_data["max_slip_by_tyre"].items()
                    },
                    "tyre_age_laps": tyre_stint_laps,
                    "current_tyre_set": current_tyre_set,
                    "strategy_tyre_set": strategy_tyre_set,
                    "mfd_tyre_set": mfd_tyre_set,
                    "mfd_tyre_pressure": mfd_pressure,
                    "air_temp_C": round(air_temp, 2),
                    "road_temp_C": round(physics.road_temp, 2) if hasattr(physics, 'road_temp') else None,
                    "track_grip_status": str(track_grip_status) if track_grip_status is not None else None,
                    "number_of_laps": num_laps, 
                    "remaining_laps": remaining_laps,
                    "position": position,
                    "gap_ahead_ms": gap_ahead,
                    "gap_behind_ms": gap_behind,
                    "fuel_left_L": round(physics.fuel, 3)
                }

                topic = "AccTelemetryEdge/telemetry/laps" 
                
                try:
                    mqtt_conn.publish(
                        topic=topic,
                        payload=json.dumps(payload),
                        qos=mqtt.QoS.AT_LEAST_ONCE
                    )
                    print(f"-> Payload del giro {graphics.completed_lap} inviato ad AWS!\n")
                    print(f"-> Tempi Settori: {current_lap_data['sector_times']}\n")
                    print("-> Analisi strategica demandata alla Lambda cloud.\n")
                except Exception as e:
                    print(f"-> Errore critico invio MQTT: {e}\n")

                current_lap_data = {
                    "fuel_start": physics.fuel, 
                    "max_g_force": 0, "max_speed": 0, "min_speed": 999,
                    "temps_core": {"fl": [], "fr": [], "rl": [], "rr": []},
                    "temps_tyre_inner": {"fl": [], "fr": [], "rl": [], "rr": []},
                    "temps_tyre_middle": {"fl": [], "fr": [], "rl": [], "rr": []},
                    "temps_tyre_outer": {"fl": [], "fr": [], "rl": [], "rr": []},
                    "temps_brake": {"fl": [], "fr": [], "rl": [], "rr": []},
                    "gas_percent": [], "brake_percent": [], "rpm": [],
                    "best_time": current_lap_data["best_time"],
                    "sector_times": [0, 0, 0],
                    "slip_events_by_sector": {"1": 0, "2": 0, "3": 0},
                    "max_slip_by_sector": {"1": 0.0, "2": 0.0, "3": 0.0},
                    "max_slip_by_tyre": {"fl": 0.0, "fr": 0.0, "rl": 0.0, "rr": 0.0},
                    "last_sector": 0
                }
            
            last_completed_lap = graphics.completed_lap
            time.sleep(0.02) 

    except KeyboardInterrupt:
        print("\n\nArresto del sensore...")
        asm.close()

if __name__ == "__main__":
    start_local_test()
