import time
import json
from datetime import datetime
from pyaccsharedmemory import accSharedMemory
import sys

# --- SOGLIA DI SLITTAMENTO ---
# Modifica questo valore per rendere l'avviso più o meno sensibile
SLIP_THRESHOLD = 10
 
def start_local_test():
    asm = accSharedMemory()
    last_completed_lap = -1
    
    # Workaround per calcolare l'età delle gomme
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
        "best_time": 0
    }

    print("Sensore Telemetria Avviato. In attesa di ACC...")

    try:
        while True:
            sm = asm.read_shared_memory()
            if sm is None:
                time.sleep(0.1)
                continue

            physics = sm.Physics
            graphics = sm.Graphics
            static = sm.Static

            # Dati vari
            gear_status = physics.gear
            gap_ahead = graphics.gap_ahead
            gap_behind = graphics.gap_behind
            brake = physics.brake

            # Bandiere
            yellow_flag = graphics.global_yellow

            # 1. Gestione Pit Stop (Reset età gomme)
            in_pit = graphics.isInPit if hasattr(graphics, 'isInPit') else False
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

            # 4. Input e Motore (Raccolta per medie)
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

            # 8. Feedback Visivo Ottimizzato per il Pilota
            est_lap_ms = graphics.estimated_lap_time
            if 0 < est_lap_ms < 2147483647:
                 minutes = int(est_lap_ms // 60000)
                 seconds = int((est_lap_ms % 60000) // 1000)
                 est_lap_str = f"{minutes:02d}:{seconds:02d}"
            else:
                est_lap_str = "N/A"

            # Costruzione stringhe compatte
            flag_str = "YEL" if yellow_flag else "GRN"
            gap_str = f"+{gap_ahead:.1f}/-{gap_behind:.1f}"
            
            # Estrazione valori Slip
            slip_fl = physics.wheel_slip.front_left
            slip_fr = physics.wheel_slip.front_right
            slip_rl = physics.wheel_slip.rear_left
            slip_rr = physics.wheel_slip.rear_right

            # --- CONTROLLO SLITTAMENTO ---
            slip_warnings = []
            if slip_fl > SLIP_THRESHOLD and brake == 0: slip_warnings.append(f"Ant-Sx ({slip_fl:.2f})")
            if slip_fr > SLIP_THRESHOLD and brake == 0: slip_warnings.append(f"Ant-Dx ({slip_fr:.2f})")
            if slip_rl > SLIP_THRESHOLD and brake == 0: slip_warnings.append(f"Post-Sx ({slip_rl:.2f})")
            if slip_rr > SLIP_THRESHOLD and brake == 0: slip_warnings.append(f"Post-Dx ({slip_rr:.2f})")

            # Se c'è almeno un avviso, lo stampa su una nuova riga lasciando il cruscotto intatto
            if slip_warnings:
                print(f"\n⚠️ SLITTAMENTO ECCESSIVO: {', '.join(slip_warnings)}")

            # Dashboard ultra-compatta
            live_status = (
                f"[{flag_str}] L:{graphics.completed_lap} Est:{est_lap_str} | Gap:{gap_str} | "
                f"V:{speed:.0f} G:{current_lap_data['max_g_force']:.1f} | "
                f"S:[{slip_fl:.2f} {slip_fr:.2f} {slip_rl:.2f} {slip_rr:.2f}] | "
                f"Ty:[{physics.tyre_core_temp.front_left:.0f} {physics.tyre_core_temp.front_right:.0f} {physics.tyre_core_temp.rear_left:.0f} {physics.tyre_core_temp.rear_right:.0f}] "
                f"Br:[{physics.brake_temp.front_left:.0f} {physics.brake_temp.front_right:.0f} {physics.brake_temp.rear_left:.0f} {physics.brake_temp.rear_right:.0f}]"
            )
            
            # Stampa sulla stessa riga (flush forza l'output immediato, end='' toglie a capo)
            print(f"\r{live_status:<140}", end='', flush=True)

            # 9. Trigger Fine Giro
            if graphics.completed_lap > last_completed_lap and last_completed_lap != -1:
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

                payload = {
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "driver": static.player_name, 
                    "lap_number": graphics.completed_lap,
                    "lap_time_ms": graphics.last_time,
                    "best_time_ms": current_lap_data["best_time"],
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
                    "tyre_age_laps": tyre_stint_laps
                }

                file_path = r"C:\Users\marco\Desktop\Tesi_Telemetry\analytics_backend\telemetria_giri_test.txt"
                with open(file_path, "a") as f:
                    json.dump(payload, f, indent=4)
                    f.write("\n" + "="*40 + "\n") 

                print(f"-> Dati salvati con successo in {file_path}\n")

                current_lap_data = {
                    "fuel_start": physics.fuel, "max_g_force": 0, "max_speed": 0, "min_speed": 999,
                    "temps_core": {"fl": [], "fr": [], "rl": [], "rr": []},
                    "temps_brake": {"fl": [], "fr": [], "rl": [], "rr": []},
                    "gas_percent": [], "brake_percent": [], "rpm": [],
                    "best_time": current_lap_data["best_time"] 
                }
            
            last_completed_lap = graphics.completed_lap
            time.sleep(0.02) 

    except KeyboardInterrupt:
        print("\n\nArresto del sensore...")
        asm.close()

if __name__ == "__main__":
    start_local_test()