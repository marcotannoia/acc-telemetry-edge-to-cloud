import os
import time
import json
from datetime import datetime
import sys
from pyaccsharedmemory import accSharedMemory  
from awscrt import io, mqtt
from awsiot import mqtt_connection_builder

# Soglia abbassata per rilevare i micro-slittamenti su asfalto
SLIP_THRESHOLD = 4.0 

def setup_mqtt_connection():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    cert_path = os.path.join(script_dir, "device-certificate.pem.crt")
    key_path = os.path.join(script_dir, "device-private.pem.key")
    ca_path = os.path.join(script_dir, "AmazonRootCA1.pem")
    iot_endpoint = "a2r71e9visju80-ats.iot.eu-south-1.amazonaws.com"
    event_loop_group = io.EventLoopGroup(1)
    host_resolver = io.DefaultHostResolver(event_loop_group)
    client_bootstrap = io.ClientBootstrap(event_loop_group, host_resolver)

    print(f"Inizializzazione TLS... Connessione a: {iot_endpoint}")

    mqtt_connection = mqtt_connection_builder.mtls_from_path(
        endpoint=iot_endpoint,
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

    return mqtt_connection
 
def start_local_test():
    asm = accSharedMemory()
    mqtt_conn = setup_mqtt_connection()

    last_completed_lap = -1
    tyre_stint_laps = 0
    was_in_pit = False
    
    current_lap_data = {
        "fuel_start": 0,
        "max_g_force": 0,
        "max_speed": 0,
        "min_speed": 999,
        "temps_core": {"fl": [], "fr": [], "rl": [], "rr": []},
        "temps_brake": {"fl": [], "fr": [], "rl": [], "rr": []},
        "gas_percent": [], 
        "brake_percent": [],
        "rpm": [],
        "best_time": 0,
        "pad_life": {"fl": [], "fr": [], "rl": [], "rr": []},
        "sector_times": [0, 0, 0], # Novità: Array per i 3 settori
        "last_sector": 0
    }

    print("Sensore Telemetria Avviato. In attesa di ACC...")

    try:
        while True:
            sm = asm.read_shared_memory()
            if sm is None:
                time.sleep(0.05) # Polling veloce per non perdere cambi settore
                continue

            physics = sm.Physics
            graphics = sm.Graphics
            static = sm.Static
            
            # --- AGGIORNAMENTO SETTORI IN TEMPO REALE ---
            current_sector = graphics.current_sector_index
            if current_sector != current_lap_data["last_sector"]:
                prev_sector = current_lap_data["last_sector"]
                if 0 <= prev_sector <= 2:
                    current_lap_data["sector_times"][prev_sector] = graphics.last_sector_time
                current_lap_data["last_sector"] = current_sector

            # Dati vari
            air_temp = physics.air_temp
            gap_ahead = graphics.gap_ahead
            gap_behind = graphics.gap_behind
            brake = physics.brake
            
            # Estrazione Enums in formato stringa per JSON
            session_type = graphics.session_type.name if hasattr(graphics.session_type, 'name') else "UNKNOWN"
            penalty = graphics.penalty.name if hasattr(graphics.penalty, 'name') else "None"
            is_valid_lap = graphics.is_valid_lap
            
            completed_laps = graphics.completed_lap
            num_laps = graphics.number_of_laps
            position = graphics.position

            # 1. Gestione Pit Stop (Reset età gomme)
            in_pit = graphics.is_in_pit if hasattr(graphics, 'is_in_pit') else False
            if was_in_pit and not in_pit:
                tyre_stint_laps = 0
            was_in_pit = in_pit

            # 2. Registrazione Carburante
            if current_lap_data["fuel_start"] == 0 and physics.fuel > 0:
                current_lap_data["fuel_start"] = physics.fuel

            # 3. Velocità Max e Min
            speed = physics.speed_kmh
            if speed > current_lap_data["max_speed"]: 
                current_lap_data["max_speed"] = speed
            if 0 < speed < current_lap_data["min_speed"]: 
                current_lap_data["min_speed"] = speed

            # 4. Input e Motore
            if physics.gas > 0: current_lap_data["gas_percent"].append(physics.gas)
            if physics.brake > 0: current_lap_data["brake_percent"].append(physics.brake)
            current_lap_data["rpm"].append(physics.rpm)

            # 5. Forza G
            g_force = (physics.g_force.x**2 + physics.g_force.z**2)**0.5
            if g_force > current_lap_data["max_g_force"]: 
                current_lap_data["max_g_force"] = g_force
                
            # 6. Best Time
            best_time = graphics.best_time
            if best_time > 0 and (current_lap_data["best_time"] == 0 or best_time < current_lap_data["best_time"]):
                current_lap_data["best_time"] = best_time

            # 7. Temperature
            current_lap_data["temps_core"]["fl"].append(physics.tyre_core_temp.front_left)
            current_lap_data["temps_core"]["fr"].append(physics.tyre_core_temp.front_right)
            current_lap_data["temps_core"]["rl"].append(physics.tyre_core_temp.rear_left)
            current_lap_data["temps_core"]["rr"].append(physics.tyre_core_temp.rear_right)

            current_lap_data["temps_brake"]["fl"].append(physics.brake_temp.front_left)
            current_lap_data["temps_brake"]["fr"].append(physics.brake_temp.front_right)
            current_lap_data["temps_brake"]["rl"].append(physics.brake_temp.rear_left)
            current_lap_data["temps_brake"]["rr"].append(physics.brake_temp.rear_right)

            # Estrazione MFD Tyre Pressures
            mfd_pressure = {
                "fl": round(graphics.mfd_tyre_pressure.front_left, 2),
                "fr": round(graphics.mfd_tyre_pressure.front_right, 2),
                "rl": round(graphics.mfd_tyre_pressure.rear_left, 2),
                "rr": round(graphics.mfd_tyre_pressure.rear_right, 2)
            }

            # Valori Slip
            slip_fl = physics.wheel_slip.front_left
            slip_fr = physics.wheel_slip.front_right
            slip_rl = physics.wheel_slip.rear_left
            slip_rr = physics.wheel_slip.rear_right

            # Valori Pad Life
            padlife_fl = physics.pad_life.front_left if hasattr(physics, 'pad_life') else None
            padlife_fr = physics.pad_life.front_right if hasattr(physics, 'pad_life') else None
            padlife_rl = physics.pad_life.rear_left if hasattr(physics, 'pad_life') else None
            padlife_rr = physics.pad_life.rear_right if hasattr(physics, 'pad_life') else None

            # --- CONTROLLO SLITTAMENTO MIGLIORATO ---
            slip_warnings = []
            # Ignoriamo i falsi allarmi a bassa velocità (es. bloccati in ghiaia/erba) 
            # e consideriamo solo quando non stiamo frenando
            if speed > 30.0 and brake == 0:
                if slip_fl > SLIP_THRESHOLD: slip_warnings.append(f"Ant-Sx ({slip_fl:.1f})")
                if slip_fr > SLIP_THRESHOLD: slip_warnings.append(f"Ant-Dx ({slip_fr:.1f})")
                if slip_rl > SLIP_THRESHOLD: slip_warnings.append(f"Post-Sx ({slip_rl:.1f})")
                if slip_rr > SLIP_THRESHOLD: slip_warnings.append(f"Post-Dx ({slip_rr:.1f})")

            if slip_warnings:
                print(f"\n⚠️ SLITTAMENTO RILEVATO: {', '.join(slip_warnings)}")

            # 8. Feedback Visivo Dashboard
            est_lap_ms = graphics.estimated_lap_time
            if 0 < est_lap_ms < 2147483647:
                 minutes = int(est_lap_ms // 60000)
                 seconds = int((est_lap_ms % 60000) // 1000)
                 est_lap_str = f"{minutes:02d}:{seconds:02d}"
            else:
                est_lap_str = "N/A"

            flag_str = "YEL" if graphics.global_yellow else "GRN"
            valid_str = "VAL" if is_valid_lap else "INV"
            
            live_status = (
                f"[{flag_str}|{valid_str}] L:{graphics.completed_lap} Est:{est_lap_str} | Sec:{current_sector+1} | "
                f"V:{speed:.0f} G:{current_lap_data['max_g_force']:.1f} | "
                f"Ty:[{physics.tyre_core_temp.front_left:.0f} {physics.tyre_core_temp.front_right:.0f} {physics.tyre_core_temp.rear_left:.0f} {physics.tyre_core_temp.rear_right:.0f}]"
            )
            print(f"\r{live_status:<120}", end='', flush=True)

            # 9. Trigger Fine Giro
            if graphics.completed_lap > last_completed_lap and graphics.completed_lap != -1:
                print(f"\n\n[!] GIRO {graphics.completed_lap} COMPLETATO! Elaborazione...")
                
                tyre_stint_laps += 1 

                fuel_consumed = current_lap_data["fuel_start"] - physics.fuel
                track_length_m = getattr(static, 'track_spline_length', getattr(static, 'trackSPlineLength', 0))
                track_length_km = track_length_m / 1000.0 if track_length_m > 0 else 1.0
                fuel_per_km = fuel_consumed / track_length_km if fuel_consumed > 0 else 0

                avg_core = {k: round(sum(v)/len(v), 2) for k, v in current_lap_data["temps_core"].items() if v}
                avg_brake = {k: round(sum(v)/len(v), 2) for k, v in current_lap_data["temps_brake"].items() if v}
                
                avg_gas = sum(current_lap_data["gas_percent"]) / len(current_lap_data["gas_percent"]) if current_lap_data["gas_percent"] else 0
                avg_brake_pedal = sum(current_lap_data["brake_percent"]) / len(current_lap_data["brake_percent"]) if current_lap_data["brake_percent"] else 0
                max_rpm = max(current_lap_data["rpm"]) if current_lap_data["rpm"] else 0

                # COSTRUZIONE DEL PAYLOAD
                payload = {
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
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
                    "fuel_consumed_L": round(fuel_consumed, 3),
                    "fuel_per_km_L": round(fuel_per_km, 3),
                    "max_g_force": round(current_lap_data["max_g_force"], 2),
                    "avg_tyre_core_C": avg_core,
                    "avg_brake_temp_C": avg_brake,
                    "tyre_age_laps": tyre_stint_laps,
                    "mfd_tyre_pressure": mfd_pressure,
                    "air_temp_C": round(air_temp, 2),
                    "road_temp_C": round(physics.road_temp, 2) if hasattr(physics, 'road_temp') else None,
                    "pad_life_mm": {
                        "fl": round(padlife_fl, 2) if padlife_fl is not None else None,
                        "fr": round(padlife_fr, 2) if padlife_fr is not None else None,
                        "rl": round(padlife_rl, 2) if padlife_rl is not None else None,
                        "rr": round(padlife_rr, 2) if padlife_rr is not None else None
                    }, 
                    "number_of_laps": num_laps, 
                    "position": position
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
                except Exception as e:
                    print(f"-> Errore critico invio MQTT: {e}\n")

                # Reset del dizionario
                current_lap_data = {
                    "fuel_start": physics.fuel, 
                    "max_g_force": 0, "max_speed": 0, "min_speed": 999,
                    "temps_core": {"fl": [], "fr": [], "rl": [], "rr": []},
                    "temps_brake": {"fl": [], "fr": [], "rl": [], "rr": []},
                    "gas_percent": [], "brake_percent": [], "rpm": [],
                    "best_time": current_lap_data["best_time"],
                    "pad_life": {"fl": [], "fr": [], "rl": [], "rr": []},
                    "sector_times": [0, 0, 0],
                    "last_sector": 0
                }
            
            last_completed_lap = graphics.completed_lap
            time.sleep(0.02) 

    except KeyboardInterrupt:
        print("\n\nArresto del sensore...")
        asm.close()

if __name__ == "__main__":
    start_local_test()