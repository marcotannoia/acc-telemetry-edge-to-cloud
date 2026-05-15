import time
import json
from datetime import datetime
from pyaccsharedmemory import accSharedMemory

def start_local_test():
    asm = accSharedMemory()
    last_completed_lap = -1
    
    # Struttura dati corretta e separata per singola ruota
    current_lap_data = {
        "fuel_start": 0,
        "max_g_force": 0,
        "max_speed": 0,
        "min_speed": 999,
        "temps_core": {"fl": [], "fr": [], "rl": [], "rr": []},
        "temps_brake": {"fl": [], "fr": [], "rl": [], "rr": []}
        
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

            # Registriamo il carburante all'inizio del giro
            if current_lap_data["fuel_start"] == 0 and physics.fuel > 0:
                current_lap_data["fuel_start"] = physics.fuel

            # Velocità Max e Min
            speed = physics.speed_kmh
            if speed > current_lap_data["max_speed"]: 
                current_lap_data["max_speed"] = speed
            if 0 < speed < current_lap_data["min_speed"]: # Ignora lo 0 se la macchina è ferma
                current_lap_data["min_speed"] = speed

            # Forza G
            g_force = (physics.g_force.x**2 + physics.g_force.z**2)**0.5
            if g_force > current_lap_data["max_g_force"]: 
                current_lap_data["max_g_force"] = g_force

            # Accumulo Temperature Core (Separate)
            current_lap_data["temps_core"]["fl"].append(physics.tyre_core_temp.front_left)
            current_lap_data["temps_core"]["fr"].append(physics.tyre_core_temp.front_right)
            current_lap_data["temps_core"]["rl"].append(physics.tyre_core_temp.rear_left)
            current_lap_data["temps_core"]["rr"].append(physics.tyre_core_temp.rear_right)

            # Accumulo Temperature Freni
            current_lap_data["temps_brake"]["fl"].append(physics.brake_temp.front_left)
            current_lap_data["temps_brake"]["fr"].append(physics.brake_temp.front_right)
            current_lap_data["temps_brake"]["rl"].append(physics.brake_temp.rear_left)
            current_lap_data["temps_brake"]["rr"].append(physics.brake_temp.rear_right)

            # Stima Miglior Giro (iEstimatedLapTime è in millisecondi)
            est_lap_ms = graphics.estimated_lap_time
            # Filtra il valore MAX_INT di ACC per evitare bug logici
            if 0 < est_lap_ms < 2147483647:
                 minutes = int(est_lap_ms // 60000)
                 seconds = int((est_lap_ms % 60000) // 1000)
                 ms = int(est_lap_ms % 1000)
                 est_lap_str = f"{minutes:02d}:{seconds:02d}.{ms:03d}"
            else:
                est_lap_str = "N/A"

            # Feedback Visivo Terminale
            print(f"🟢 LIVE | Giro: {graphics.completed_lap} | Vel: {speed:.0f}km/h | G-Max: {current_lap_data['max_g_force']:.2f} | Fuel: {physics.fuel:.2f}L | Best Est: {est_lap_str}        ", end="\r", flush=True)

            # Trigger di Fine Giro
            if graphics.completed_lap > last_completed_lap and last_completed_lap != -1:
                print(f"\n\n[!] GIRO {graphics.completed_lap} COMPLETATO! Elaborazione dati...")

                # Calcolo consumo (Fix: track_spline_length)
                fuel_consumed = current_lap_data["fuel_start"] - physics.fuel
                track_length_m = getattr(static, 'track_spline_length', getattr(static, 'trackSPlineLength', 0))
                track_length_km = track_length_m / 1000.0 if track_length_m > 0 else 1.0
                fuel_per_km = fuel_consumed / track_length_km if fuel_consumed > 0 else 0

                # Medie termiche sicure per ruota
                avg_core = {k: round(sum(v)/len(v), 2) for k, v in current_lap_data["temps_core"].items() if v}
                avg_brake = {k: round(sum(v)/len(v), 2) for k, v in current_lap_data["temps_brake"].items() if v}

                payload = {
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "driver": static.player_name, 
                    "lap_number": graphics.completed_lap,
                    "lap_time_ms": graphics.last_time,
                    "max_speed_kmh": round(current_lap_data["max_speed"], 2),
                    "min_speed_kmh": round(current_lap_data["min_speed"], 2),
                    "fuel_consumed_L": round(fuel_consumed, 3),
                    "fuel_per_km_L": round(fuel_per_km, 3),
                    "max_g_force": round(current_lap_data["max_g_force"], 2),
                    "avg_tyre_core_C": avg_core,
                    "avg_brake_temp_C": avg_brake
                }

                # Scrittura su file assoluto
                file_path = r"C:\Users\marco\Desktop\Tesi_Telemetry\analytics_backend\telemetria_giri_test.txt"
                with open(file_path, "a") as f:
                    json.dump(payload, f, indent=4)
                    f.write("\n" + "="*40 + "\n") 

                print(f"-> Dati salvati con successo in {file_path}\n")

                # Reset variabili
                current_lap_data = {
                    "fuel_start": physics.fuel, "max_g_force": 0, "max_speed": 0, "min_speed": 999,
                    "temps_core": {"fl": [], "fr": [], "rl": [], "rr": []},
                    "temps_brake": {"fl": [], "fr": [], "rl": [], "rr": []}
                }
            
            last_completed_lap = graphics.completed_lap
            time.sleep(0.02) 

    except KeyboardInterrupt:
        print("\n\nArresto del sensore...")
        asm.close()

if __name__ == "__main__":
    start_local_test()