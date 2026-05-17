import pandas as pd
import matplotlib.pyplot as plt

def analizza_telemetria_gara(dati_giri):
    """
    Riceve il vettore di recap (lista di dizionari) e genera i plot.
    I dati devono avere la forma: 
    [{'lap': 1, 'avg_gas': 0.85, 'fuel': 3.1}, {'lap': 2, 'avg_gas': 0.88, 'fuel': 3.4}, ...]
    """
    if not dati_giri:
        print("Errore: Nessun dato disponibile nel vettore.")
        return

    # 1. Converte la struttura dati in un DataFrame Pandas
    df = pd.DataFrame(dati_giri)
    
    # Rimuove eventuali giri incompleti o nulli e imposta l'indice
    df.dropna(inplace=True)
    df.set_index('lap', inplace=True)

    # 2. Setup della figura con doppio asse Y
    fig, ax1 = plt.subplots(figsize=(10, 5))

    # Asse Principale: Gas Medio
    colore_gas = 'tab:red'
    ax1.set_xlabel('Numero Giro')
    ax1.set_ylabel('Gas Medio Applicato (%)', color=colore_gas)
    ax1.plot(df.index, df['avg_gas'], marker='o', color=colore_gas, label='Gas Medio', linewidth=2)
    ax1.tick_params(axis='y', labelcolor=colore_gas)
    ax1.grid(True, linestyle='--', alpha=0.6)

    # Asse Secondario: Consumo Carburante (se presente nel recap)
    if 'fuel' in df.columns:
        ax2 = ax1.twinx()  
        colore_fuel = 'tab:blue'
        ax2.set_ylabel('Carburante Consumato (Litri)', color=colore_fuel)  
        ax2.plot(df.index, df['fuel'], marker='s', color=colore_fuel, label='Consumo Fuel', linewidth=2, linestyle=':')
        ax2.tick_params(axis='y', labelcolor=colore_fuel)

    # Rendering finale
    plt.title('Analisi Telemetria: Andamento Recap per Giro')
    plt.xticks(df.index) # Forza l'asse X a mostrare numeri interi per i giri
    fig.tight_layout()  
    plt.show()

# --- ESECUZIONE DI TEST LOCALE ---
if __name__ == "__main__":
    # Struttura dati fittizia che il tuo test_realtime.py passerà a questa funzione
    vettore_recap_fine_gara = [
        {"lap": 1, "avg_gas": 75.4, "fuel": 3.05},
        {"lap": 2, "avg_gas": 82.1, "fuel": 3.40},
        {"lap": 3, "avg_gas": 81.5, "fuel": 3.35},
        {"lap": 4, "avg_gas": 79.0, "fuel": 3.20}
    ]
    
    analizza_telemetria_gara(vettore_recap_fine_gara)