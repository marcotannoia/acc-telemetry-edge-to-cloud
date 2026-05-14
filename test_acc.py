import time
from pyaccsharedmemory import accSharedMemory

def edge_agent_acc():
    print("🚀 Edge Agent Avviato: Monitoraggio infrastruttura...")
    
    asm = None
    in_pista = False
    giro_precedente = -1
    
    try:
        while True:
            # LOGICA DI RICONNESSIONE (FAULT TOLERANCE)
            if asm is None:
                try:
                    asm = accSharedMemory()
                    print("📡 Tentativo di aggancio alla Shared Memory...")
                except:
                    time.sleep(2)
                    continue

            # Lettura memoria
            asm.read_shared_memory()
            f_data = asm.physicSM
            g_data = asm.graphicSM
            
            # Estrazione con fallback per packetId (gestisce typo della libreria)
            packet_id = getattr(f_data, 'packetId', getattr(f_data, 'packed_id', 0))
            status = getattr(g_data, 'status', 0)
            
            # Se packet_id è 0, la memoria è vuota: resettiamo l'oggetto e riproviamo
            if packet_id == 0:
                print(f"⚠️ Dati non rilevati (Status: {status}). Assicurati di essere in GUIDA.", end="\r")
                asm.close()
                asm = None
                time.sleep(1)
                continue

            # Se siamo LIVE (status 2), processiamo i dati
            if packet_id > 0 and status == 2:
                if not in_pista:
                    print(f"\n\n🟢 TELEMETRIA AGGANCIATA! Packet: {packet_id}")
                    in_pista = True
                
                giro_attuale = getattr(g_data, 'completed_lap', 0)
                
                if giro_attuale > giro_precedente:
                    # Qui estrai i tuoi KPI per l'ottimizzazione ambientale
                    fuel = getattr(f_data, 'fuel', 0.0)
                    used_fuel = getattr(g_data, 'used_fuel', 0.0) # Utile per analisi consumi[cite: 4]
                    
                    print(f"\n🏁 LAP COMPLETATO: {giro_attuale}")
                    print(f"⛽ Carburante in serbatoio: {fuel:.2f}L")
                    print(f"📊 Consumo totale sessione: {used_fuel:.2f}L")
                    print("-" * 30)
                    
                    giro_precedente = giro_attuale
            
            time.sleep(0.1) # 10Hz

    except KeyboardInterrupt:
        print("\n🛑 Shutdown Agent.")
    finally:
        if asm: asm.close()

if __name__ == "__main__":
    edge_agent_acc()