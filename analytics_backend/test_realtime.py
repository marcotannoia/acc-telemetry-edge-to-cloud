import time
import json
from datetime import datetime
from pyaccsharedmemory import accSharedMemory

def start_local_test():
    # Inizializziamo la shared memory (legge in automatico)
    asm = accSharedMemory()
    
    last_completed_lap = -1
    current_lap_data = {
        "temps_lf": [],
        "fuel_start": 0,
        "max_g_force": 0
    }

    print("Sensore Telemetria Avviato.")
    print("In attesa di Assetto Corsa Competizione... Scendi in pista!")
    print("I dati verranno salvati nel file 'telemetria_giri_test.txt' al termine di ogni giro.\n")

    try:
        while True:
            # 1. Chiamiamo l'unica funzione necessaria per leggere la memoria
            sm = asm.read_shared_memory()

            # Se il gioco è chiuso, in pausa, o non ci sono dati nuovi, sm è None
            if sm is None:
                print("⏳ In attesa di dati da ACC... (Gioco chiuso o non in pista)     ", end="\r", flush=True)
                time.sleep(0.1)
                continue

            # Estraiamo i 3 blocchi di memoria usando la sintassi esatta della libreria
            physics = sm.Physics
            graphics = sm.Graphics
            static = sm.Static

            # 2. Registriamo il carburante all'inizio del giro
            if current_lap_data["fuel_start"] == 0 and physics.fuel > 0:
                current_lap_data["fuel_start"] = physics.fuel

            # 3. Accumulo dati in tempo reale
            # tyre_core_temp usa l'oggetto 'Wheels' (front_left, front_right...)
            if physics.tyre_core_temp.front_left > 0:
                current_lap_data["temps_lf"].append(physics.tyre_core_temp.front_left)
            
            # Calcolo Forza G (g_force è un vettore Vector3f con coordinate x, y, z)
            g_force = (physics.g_force.x**2 + physics.g_force.z**2)**0.5
            if g_force > current_lap_data["max_g_force"]:
                current_lap_data["max_g_force"] = g_force

            # --- NOVITÀ: FEEDBACK VISIVO IN TEMPO REALE ---
            # Questo aggiorna continuamente la stessa riga del terminale mentre guidi!
            print(f"🟢 LIVE | Giri completati: {graphics.completed_lap} | G-Force Max: {current_lap_data['max_g_force']:.2f} G | Benzina: {physics.fuel:.2f} L        ", end="\r", flush=True)

            # 4. Trigger di Fine Giro
            if graphics.completed_lap > last_completed_lap and last_completed_lap != -1:
                # Usiamo \n\n per andare a capo e non sovrascrivere la riga "LIVE"
                print(f"\n\n[!] GIRO {graphics.completed_lap} COMPLETATO! Elaborazione dati...")
                
                # Calcoliamo la media termica in modo sicuro
                avg_temp = 0
                if len(current_lap_data["temps_lf"]) > 0:
                    avg_temp = sum(current_lap_data["temps_lf"]) / len(current_lap_data["temps_lf"])

                # Creiamo il pacchetto dati
                payload = {
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "driver": static.player_name, 
                    "track": static.track,
                    "car": static.car_model,
                    "lap_number": graphics.completed_lap,
                    "lap_time_ms": graphics.last_time,
                    "avg_temp_front_left_C": round(avg_temp, 2),
                    "fuel_consumed_L": round(current_lap_data["fuel_start"] - physics.fuel, 3),
                    "max_g_force": round(current_lap_data["max_g_force"], 2)
                }

                # 5. SCRITTURA NEL FILE DI TEST LOCALE
                nome_file = "telemetria_giri_test.txt"
                with open(nome_file, "a") as f:
                    # Scrive i dati in formato JSON leggibile
                    json.dump(payload, f, indent=4)
                    f.write("\n" + "="*40 + "\n") 

                print(f"-> Dati salvati con successo in {nome_file}\n")

                # Reset delle variabili per il nuovo giro
                current_lap_data = {"temps_lf": [], "fuel_start": physics.fuel, "max_g_force": 0}
            
            last_completed_lap = graphics.completed_lap
            time.sleep(0.02) # Frequenza di polling velocissima per la telemetria (50 Hz)

    except KeyboardInterrupt:
        print("\n\nArresto del sensore...")
        # Il file esatto usa asm.close()
        asm.close()

if __name__ == "__main__":
    start_local_test()