import time
import json
import requests # Per inviare dati ad AWS API Gateway
from pyaccsharedmemory import accSharedMemory

# Configura l'indirizzo della tua API creata con Terraform
AWS_API_ENDPOINT = "https://tua-api-id.execute-api.eu-central-1.amazonaws.com/prod/telemetry"

def start_collector():
    # Inizializziamo la shared memory
    asm = accSharedMemory()
    asm.start()
    
    last_completed_lap = -1
    current_lap_data = {
        "temps_lf": [],
        "fuel_start": 0,
        "max_g_force": 0
    }

    print("In attesa di ACC... Inizia a guidare!")

    try:
        while True:
            # 1. Lettura dei blocchi di memoria
            physics = asm.get_physics()
            graphics = asm.get_graphics()
            static = asm.get_static()

            if not physics or not graphics:
                time.sleep(1)
                continue

            # 2. Logica di inizio sessione / caricamento carburante
            if current_lap_data["fuel_start"] == 0:
                current_lap_data["fuel_start"] = physics.fuel

            # 3. Accumulo dati in tempo reale (Edge Processing)
            current_lap_data["temps_lf"].append(physics.tyreCoreTemp[0]) # Anteriore SX
            
            # Calcolo Forza G massima (vettore risultante)
            g_force = (physics.accG[0]**2 + physics.accG[1]**2)**0.5
            if g_force > current_lap_data["max_g_force"]:
                current_lap_data["max_g_force"] = g_force

            # 4. Trigger di Fine Giro
            if graphics.completedLaps > last_completed_lap and last_completed_lap != -1:
                # Abbiamo completato un giro!
                print(f"Giro {graphics.completedLaps} completato. Invio al Cloud...")
                
                payload = {
                    "driver": "Marco",
                    "track": static.track,
                    "car": static.carModel,
                    "lap_number": graphics.completedLaps,
                    "lap_time": graphics.iLastTime, # Millisecondi
                    "avg_temp_lf": sum(current_lap_data["temps_lf"]) / len(current_lap_data["temps_lf"]),
                    "fuel_consumed": current_lap_data["fuel_start"] - physics.fuel,
                    "max_g": current_lap_data["max_g_force"]
                }

                # 5. Invio ad AWS (L'aspetto Cloud)
                try:
                    # Qui useresti i token di Cognito per l'autorizzazione
                    requests.post(AWS_API_ENDPOINT, json=payload)
                except Exception as e:
                    print(f"Errore invio Cloud: {e}")

                # Reset per il prossimo giro
                last_completed_lap = graphics.completedLaps
                current_lap_data = {"temps_lf": [], "fuel_start": physics.fuel, "max_g_force": 0}
            
            last_completed_lap = graphics.completedLaps
            time.sleep(0.05) # Polling a 20Hz (sufficiente per medie di giro)

    except KeyboardInterrupt:
        asm.stop()

if __name__ == "__main__":
    start_collector()