import time
import json
from pyaccsharedmemory import accSharedMemory #[cite: 1, 4]

# Configurazione Real-Time
SAMPLING_RATE_HZ = 5
INTERVAL = 1.0 / SAMPLING_RATE_HZ

def start_collector():
    asm = accSharedMemory() #[cite: 1]
    asm.start()
    
    payload_batch = []
    
    # TODO: Configurare il client MQTT AWS IoT Core tramite SDK awsiot
    # mqtt_connection = ... 

    print(f"In attesa di ACC... Inizio streaming MQTT a {SAMPLING_RATE_HZ}Hz!")

    try:
        while True:
            start_time = time.time()

            # 1. Lettura dei blocchi di memoria
            physics = asm.get_physics() #[cite: 1]
            graphics = asm.get_graphics() #[cite: 1]
            static = asm.get_static() #[cite: 1]

            if not physics or not graphics:
                time.sleep(1)
                continue

            # 2. Estrazione parametri real-time (Edge Processing)
            g_force = (physics.accG[0]**2 + physics.accG[1]**2)**0.5

            current_data = {
                "timestamp": time.time(),
                "driver": "Marco",
                "track": static.track,
                "car": static.carModel,
                "lap_number": graphics.completedLaps,
                "speedKmh": physics.speedKmh,
                "fuel_current": physics.fuel,
                "temp_lf": physics.tyreCoreTemp[0],
                "g_force": g_force
            }

            # 3. Accumulo nel batch
            payload_batch.append(current_data)

            # 4. Trigger di invio MQTT (Ogni 1 secondo = 5 campionamenti)
            if len(payload_batch) >= SAMPLING_RATE_HZ:
                payload_json = json.dumps({"batch": payload_batch})
                
                # Invio al cloud tramite connessione MQTT
                # mqtt_connection.publish(
                #     topic="telemetry/acc/realtime",
                #     payload=payload_json,
                #     qos=mqtt.QoS.AT_LEAST_ONCE
                # )
                
                print(f"Inviato batch MQTT: {len(payload_batch)} pacchetti.")
                payload_batch.clear()

            # 5. Sincronizzazione precisa a 5Hz
            elapsed_time = time.time() - start_time
            sleep_time = max(0, INTERVAL - elapsed_time)
            
            time.sleep(sleep_time)

    except KeyboardInterrupt:
        print("\nChiusura connessione...")
        asm.stop()

if __name__ == "__main__":
    start_collector()