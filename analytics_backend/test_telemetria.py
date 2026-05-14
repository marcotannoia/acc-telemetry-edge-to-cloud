import glob
import ldparser
import numpy as np  # <-- AGGIUNTO QUESTO (la libreria matematica)
from telemetry_core import scanFiles, LDDataStore, laps

# Sostituisci questo percorso con quello della TUA cartella MoTeC
cartella_motec = r"C:\Users\marco\Documents\Assetto Corsa Competizione\MoTeC\*.ld"
file_telemetria = glob.glob(cartella_motec)

if not file_telemetria:
    print("Nessun file .ld trovato. Fai qualche giro su ACC prima!")
else:
    print(f"Trovati {len(file_telemetria)} file di telemetria.")
    
    # 1. Vediamo quali giri ha trovato
    print("\n--- RIEPILOGO FILE ---")
    dati_giri = scanFiles(file_telemetria)
    if dati_giri:
        primo_giro = dati_giri[0]
        print(f"File analizzato: {primo_giro[0]} | Pista: {primo_giro[2]} | Auto: {primo_giro[3]}")
    
    # Prendiamo il primo file della lista
    file_path = file_telemetria[0]
    
    # 2. Leggiamo i dati COMPLETI dal file .ld (passando la stringa)
    print("\nEstrazione dati in corso (potrebbe richiedere qualche secondo per file grandi)...")
    ld_data = ldparser.ldData.fromfile(file_path)
        
    # FIX: Usiamo numpy (np.array) per trasformare i giri in un formato su cui Python può fare matematica
    tempi_giri = np.array(laps(file_path))

    # 3. Creiamo il DataStore e convertiamo in DataFrame
    store = LDDataStore(ld_data.channs, laps=tempi_giri, acc=True)
    df = store.get_data_frame()

    print("\n==================================================")
    print("      DATI ESTRATTI PER OTTIMIZZAZIONE E CO2      ")
    print("==================================================")

    # --- CONSUMO DI CARBURANTE ---
    if 'fuel' in df.columns:
        consumo_totale = df['fuel'].iloc[0] - df['fuel'].iloc[-1]
        print(f"⛽ Carburante consumato: {consumo_totale:.2f} Litri")
    else:
        print("⛽ Canale carburante non trovato.")

    # --- TEMPERATURE GOMME ---
    colonne_gomme = ['tyre_tair_lf', 'tyre_tair_rf', 'tyre_tair_lr', 'tyre_tair_rr']
    presenti_gomme = [c for c in colonne_gomme if c in df.columns]
    
    if presenti_gomme:
        print("\n🌡️ TEMPERATURE MEDIE GOMME (°C):")
        medie_gomme = df[presenti_gomme].mean().round(1)
        print(f"  Anteriore Sinistra: {medie_gomme.get('tyre_tair_lf', 'N/D')}")
        print(f"  Anteriore Destra:   {medie_gomme.get('tyre_tair_rf', 'N/D')}")
        print(f"  Posteriore Sinistra:{medie_gomme.get('tyre_tair_lr', 'N/D')}")
        print(f"  Posteriore Destra:  {medie_gomme.get('tyre_tair_rr', 'N/D')}")

    # --- TEMPERATURE FRENI ---
    colonne_freni = ['brake_temp_lf', 'brake_temp_rf', 'brake_temp_lr', 'brake_temp_rr']
    presenti_freni = [c for c in colonne_freni if c in df.columns]
    
    if presenti_freni:
        print("\n🔥 TEMPERATURE MEDIE FRENI (°C):")
        medie_freni = df[presenti_freni].mean().round(1)
        print(f"  Anteriore Sinistra: {medie_freni.get('brake_temp_lf', 'N/D')}")
        print(f"  Anteriore Destra:   {medie_freni.get('brake_temp_rf', 'N/D')}")
        print(f"  Posteriore Sinistra:{medie_freni.get('brake_temp_lr', 'N/D')}")
        print(f"  Posteriore Destra:  {medie_freni.get('brake_temp_rr', 'N/D')}")

    # --- PRESSIONI GOMME ---
    colonne_pressioni = ['tyre_press_lf', 'tyre_press_rf', 'tyre_press_lr', 'tyre_press_rr']
    presenti_pressioni = [c for c in colonne_pressioni if c in df.columns]
    
    if presenti_pressioni:
        print("\n💨 PRESSIONI MEDIE GOMME (PSI):")
        medie_pressioni = df[presenti_pressioni].mean().round(2)
        print(f"  Anteriore Sinistra: {medie_pressioni.get('tyre_press_lf', 'N/D')}")
        print(f"  Anteriore Destra:   {medie_pressioni.get('tyre_press_rf', 'N/D')}")
        print(f"  Posteriore Sinistra:{medie_pressioni.get('tyre_press_lr', 'N/D')}")
        print(f"  Posteriore Destra:  {medie_pressioni.get('tyre_press_rr', 'N/D')}")

    print("\n==================================================")