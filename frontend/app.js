const state = {
  // Stato minimo dell'app: niente router complesso, solo dati condivisi tra schermate.
  defaultApiUrl: "https://iu9g1sfq9j.execute-api.eu-south-1.amazonaws.com/",
  apiUrl: "",
  userId: "",
  sessions: [],
  currentSession: null,
  liveTimer: null,
  charts: {},
  mode: "live",
};

const els = {
  // Riferimenti DOM centralizzati per evitare query sparse nel codice.
  status: document.querySelector("#statusBadge"),
  loginView: document.querySelector("#loginView"),
  menuView: document.querySelector("#menuView"),
  sessionsView: document.querySelector("#sessionsView"),
  dashboardView: document.querySelector("#dashboardView"),
  loginForm: document.querySelector("#loginForm"),
  userIdInput: document.querySelector("#userIdInput"),
  apiUrlInput: document.querySelector("#apiUrlInput"),
  sessionList: document.querySelector("#sessionList"),
  dashboardMode: document.querySelector("#dashboardMode"),
  dashboardTitle: document.querySelector("#dashboardTitle"),
  pauseLiveBtn: document.querySelector("#pauseLiveBtn"),
  aiBtn: document.querySelector("#aiBtn"),
  insight: document.querySelector("#sessionInsight"),
  lastLap: document.querySelector("#lastLapMetric"),
  bestLap: document.querySelector("#bestLapMetric"),
  fuel: document.querySelector("#fuelMetric"),
  tyre: document.querySelector("#tyreMetric"),
};

// Se lo user ha gia' fatto login in precedenza, ripropongo i valori salvati.
const savedUserId = localStorage.getItem("accTelemetryUserId");
const savedApiUrl = localStorage.getItem("accTelemetryApiUrl");
els.userIdInput.value = savedUserId || "personal-user";
els.apiUrlInput.value = savedApiUrl || state.defaultApiUrl;

// Mostra una sola schermata alla volta.
function showView(view) {
  [els.loginView, els.menuView, els.sessionsView, els.dashboardView].forEach((node) => {
    node.classList.add("hidden");
  });
  view.classList.remove("hidden");
}

// Ferma il polling quando si torna al menu o allo storico.
function stopLive() {
  if (state.liveTimer) {
    clearInterval(state.liveTimer);
    state.liveTimer = null;
  }
}

function setStatus(text, kind = "") {
  els.status.textContent = text;
  els.status.className = `status-badge ${kind}`.trim();
}

function cleanApiUrl(value) {
  // Il frontend parla con API Gateway HTTP, non con l'endpoint MQTT di IoT Core.
  const url = value.trim();
  if (url.includes(".iot.") || url.includes("-ats.iot.")) {
    throw new Error("Inserisci l'HTTP API Gateway, non l'endpoint IoT MQTT.");
  }
  return url;
}

function formatLapTime(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value <= 0) return "-";
  const minutes = Math.floor(value / 60000);
  const seconds = ((value % 60000) / 1000).toFixed(3).padStart(6, "0");
  return `${minutes}:${seconds}`;
}

function average(values) {
  const numbers = values.map(Number).filter(Number.isFinite);
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : null;
}

function averageTyre(lap) {
  const tyres = lap?.avg_tyre_core_C || {};
  return average([tyres.fl, tyres.fr, tyres.rl, tyres.rr]);
}

function averageBrake(lap) {
  const brakes = lap?.avg_brake_temp_C || {};
  return average([brakes.fl, brakes.fr, brakes.rl, brakes.rr]);
}

// Tutte le chiamate passano da qui: il login decide user_id e endpoint.
async function api(payload) {
  if (!state.apiUrl) {
    throw new Error("Endpoint API mancante.");
  }

  const response = await fetch(state.apiUrl.replace(/\/+$/, ""), {
    method: "POST",
    // Ora API Gateway gestisce CORS, quindi possiamo usare JSON standard.
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: state.userId, ...payload }),
  });

  const data = await response.json().catch(() => ({}));
  const body = typeof data.body === "string" ? JSON.parse(data.body) : data;

  if (!response.ok) {
    throw new Error(body.message || `Errore API ${response.status}`);
  }
  if (body.statusCode >= 400) {
    throw new Error(body.message || `Errore API ${body.statusCode}`);
  }
  return body;
}

function sortedSessions(sessions) {
  return [...sessions].sort((a, b) => {
    return String(b.last_timestamp || "").localeCompare(String(a.last_timestamp || ""));
  });
}

async function loadSessions() {
  setStatus("Carico sessioni");
  const data = await api({ action: "list_sessions", limit: 300 });
  state.sessions = sortedSessions(data.sessions || []);
  setStatus("Sessioni aggiornate", "ok");
  return state.sessions;
}

async function loadLaps(session) {
  const data = await api({
    action: "get_session_laps",
    session_id: session.session_id,
    track: session.track,
  });
  return data.laps || [];
}

function renderSessionList() {
  // La lista e' costruita con createElement: piu' righe, ma nessun HTML fragile.
  els.sessionList.innerHTML = "";

  if (!state.sessions.length) {
    els.sessionList.textContent = "Nessuna sessione trovata per questo utente.";
    return;
  }

  state.sessions.forEach((session) => {
    const button = document.createElement("button");
    button.className = "session-card";
    button.type = "button";

    const text = document.createElement("div");
    const title = document.createElement("strong");
    const meta = document.createElement("span");
    const laps = document.createElement("span");

    title.textContent = session.track || "Pista sconosciuta";
    meta.textContent = `${session.driver || "Pilota"} | ${session.session_type || "sessione"}`;
    laps.textContent = `${session.lap_count || 0} giri | ultimo giro ${session.last_lap || "-"}`;
    const openLabel = document.createElement("span");
    openLabel.className = "open-label";
    openLabel.textContent = "Apri";

    text.append(title, meta, laps);
    button.append(text, openLabel);

    button.addEventListener("click", async () => {
      stopLive();
      const sessionLaps = await loadLaps(session);
      renderDashboard("history", session, sessionLaps);
    });

    els.sessionList.append(button);
  });
}

function updateMetrics(laps) {
  // Le metriche usano sempre l'ultimo giro disponibile della sessione.
  const last = laps.at(-1) || {};
  const validTimes = laps.map((lap) => Number(lap.lap_time_ms)).filter((time) => time > 0);
  const best = validTimes.length ? Math.min(...validTimes) : null;
  const tyre = averageTyre(last);

  els.lastLap.textContent = last.lap_number || "-";
  els.bestLap.textContent = best ? formatLapTime(best) : "-";
  els.fuel.textContent = Number.isFinite(Number(last.fuel_left_L)) ? `${Number(last.fuel_left_L).toFixed(1)} L` : "-";
  els.tyre.textContent = tyre === null ? "-" : `${tyre.toFixed(1)} C`;
}

function sessionSummary(mode, session, laps) {
  // Nello storico non mostriamo il bottone AI: restano solo conclusioni dai dati salvati.
  const last = laps.at(-1) || session.latest_lap || {};
  if (mode === "live") {
    return last.strategy_advice || "Sessione live aggiornata. I consigli AI sono disponibili solo durante la sessione.";
  }
  return last.strategy_advice || "Sessione conclusa. Qui restano solo trend e conclusioni sui dati registrati.";
}

function chartOptions(unit) {
  // Opzioni comuni: stessa estetica racing e griglie leggere su tutti i grafici.
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: "#f4f4f5" } },
      tooltip: { callbacks: { label: (item) => `${item.dataset.label}: ${item.formattedValue} ${unit}` } },
    },
    scales: {
      x: { ticks: { color: "#a4a4aa" }, grid: { color: "rgba(255,255,255,0.06)" } },
      y: { ticks: { color: "#a4a4aa" }, grid: { color: "rgba(255,255,255,0.08)" } },
    },
  };
}

// Ricrea un grafico alla volta: codice semplice e nessun aggiornamento nascosto.
function drawChart(key, canvasId, type, labels, datasets, unit) {
  state.charts[key]?.destroy();
  state.charts[key] = new Chart(document.querySelector(canvasId), {
    type,
    data: { labels, datasets },
    options: chartOptions(unit),
  });
}

function drawCharts(laps) {
  // Ogni grafico racconta un trend diverso della stessa sessione.
  const labels = laps.map((lap) => `G${lap.lap_number || "-"}`);
  const redLine = { borderColor: "#e50914", backgroundColor: "rgba(229,9,20,0.14)", tension: 0.35, fill: true };
  const grayLine = { borderColor: "#f4f4f5", backgroundColor: "rgba(244,244,245,0.10)", tension: 0.35 };

  drawChart("fuel", "#fuelChart", "line", labels, [
    { label: "Fuel residuo", data: laps.map((lap) => lap.fuel_left_L), ...redLine },
    { label: "Fuel consumato", data: laps.map((lap) => lap.fuel_consumed_L), ...grayLine },
  ], "L");

  drawChart("tyre", "#tyreChart", "line", labels, [
    { label: "FL", data: laps.map((lap) => lap.avg_tyre_core_C?.fl), ...redLine },
    { label: "FR", data: laps.map((lap) => lap.avg_tyre_core_C?.fr), borderColor: "#ff6b72", tension: 0.35 },
    { label: "RL", data: laps.map((lap) => lap.avg_tyre_core_C?.rl), borderColor: "#f4f4f5", tension: 0.35 },
    { label: "RR", data: laps.map((lap) => lap.avg_tyre_core_C?.rr), borderColor: "#a4a4aa", tension: 0.35 },
  ], "C");

  drawChart("lap", "#lapChart", "line", labels, [
    { label: "Tempo giro", data: laps.map((lap) => Number(lap.lap_time_ms) / 1000), ...redLine },
  ], "s");

  drawChart("brake", "#brakeChart", "bar", labels, [
    { label: "Media freni", data: laps.map(averageBrake), backgroundColor: "rgba(229,9,20,0.72)" },
  ], "C");
}

function renderDashboard(mode, session, laps) {
  // La dashboard e' unica: cambia solo modalita' live/storico e visibilita' AI.
  state.mode = mode;
  state.currentSession = session;

  const cleanLaps = laps.length ? laps : [session.latest_lap || {}];
  const title = session.track ? `${session.track} | ${session.driver || "Pilota"}` : "Sessione Live";

  els.dashboardMode.textContent = mode === "live" ? "Live" : "Storico";
  els.dashboardTitle.textContent = title;
  els.pauseLiveBtn.classList.toggle("hidden", mode !== "live");
  els.aiBtn.classList.toggle("hidden", mode !== "live");
  els.insight.textContent = sessionSummary(mode, session, cleanLaps);

  updateMetrics(cleanLaps);
  drawCharts(cleanLaps);
  showView(els.dashboardView);
}

async function openSessionList() {
  // Storico: recupero tutte le sessioni dell'utente loggato.
  stopLive();
  showView(els.sessionsView);
  await loadSessions();
  renderSessionList();
}

async function refreshLiveDashboard() {
  // Live: prendo la sessione piu' recente dallo storico, senza chiedere session_id.
  const sessions = await loadSessions();
  const latest = sessions[0];
  if (!latest) {
    throw new Error("Nessuna sessione live trovata.");
  }

  const laps = await loadLaps(latest);
  renderDashboard("live", latest, laps);
}

async function openLiveSession() {
  // Polling semplice ogni 5 secondi: sufficiente per vedere i trend senza complicare.
  stopLive();
  await refreshLiveDashboard();
  state.liveTimer = setInterval(refreshLiveDashboard, 5000);
}

async function askAi() {
  // L'AI e' permessa solo durante la live; nello storico il bottone viene nascosto.
  if (!state.currentSession) return;
  els.aiBtn.disabled = true;
  setStatus("AI in analisi");

  try {
    const data = await api({
      action: "ai_insight",
      session_id: state.currentSession.session_id,
      driver: state.currentSession.driver,
      track: state.currentSession.track,
      question: "Analizza la sessione live e dimmi priorita, rischi e azione consigliata.",
      limit: 40,
    });
    els.insight.textContent = data.ai_engineer_insight || "Nessun consiglio AI disponibile.";
    setStatus("Consiglio AI pronto", "ok");
  } catch (error) {
    els.insight.textContent = error.message;
    setStatus("Errore AI", "err");
  } finally {
    els.aiBtn.disabled = false;
  }
}

els.loginForm.addEventListener("submit", (event) => {
  event.preventDefault();

  state.userId = els.userIdInput.value.trim();
  try {
    state.apiUrl = cleanApiUrl(els.apiUrlInput.value);
  } catch (error) {
    els.apiUrlInput.setCustomValidity(error.message);
    els.apiUrlInput.reportValidity();
    setStatus(error.message, "err");
    return;
  }

  els.apiUrlInput.setCustomValidity("");

  localStorage.setItem("accTelemetryUserId", state.userId);
  localStorage.setItem("accTelemetryApiUrl", state.apiUrl);

  setStatus("Login effettuato", "ok");
  showView(els.menuView);
});

document.querySelector("#sessionListBtn").addEventListener("click", () => {
  openSessionList().catch((error) => setStatus(error.message, "err"));
});

document.querySelector("#liveSessionBtn").addEventListener("click", () => {
  openLiveSession().catch((error) => setStatus(error.message, "err"));
});

els.pauseLiveBtn.addEventListener("click", () => {
  stopLive();
  setStatus("Live fermo");
});

els.aiBtn.addEventListener("click", askAi);

document.querySelectorAll("[data-go-menu]").forEach((button) => {
  button.addEventListener("click", () => {
    stopLive();
    showView(els.menuView);
    setStatus("Pronto");
  });
});
