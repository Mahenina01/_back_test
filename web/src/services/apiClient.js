const BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";
const AUTH_STORAGE_KEY = "smart_incubator_auth";

function getToken() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "{}").token || null;
  } catch {
    return null;
  }
}

export function normalizeReading(reading) {
  if (!reading) return null;
  return {
    ...reading,
    humidite: reading.humidity ?? reading.humidite,
    pwm_chauffage: reading.heating_pwm ?? reading.pwm_chauffage,
    etat_ventilateur_brassage: reading.mixing_fan_on ? "on" : "off",
    etat_ventilateur_extraction: reading.extraction_fan_on ? "on" : "off",
    etat_pompe: reading.pump_on ? "on" : "off",
    niveau_eau_bas: Boolean(reading.water_level_low),
    niveau_eau_vide: Boolean(reading.water_level_empty),
    niveau_eau: reading.water_level_empty ? "vide" : reading.water_level_low ? "bas" : "ok",
    defaut_moteur: Boolean(reading.motor_fault),
    defaut_sonde: Boolean(reading.sensor_fault),
  };
}

function normalizeProfile(profile) {
  if (!profile) return null;
  return {
    ...profile,
    nom: profile.name ?? profile.nom,
    duree_jours: profile.duration_days ?? profile.duree_jours,
    temperature_min: profile.temp_min ?? profile.temperature_min,
    temperature_max: profile.temp_max ?? profile.temperature_max,
    humidite_phase1: profile.humidite_phase1
      ?? formatHumidityRange(profile.humidity_phase1_min, profile.humidity_phase1_max),
    humidite_phase2: profile.humidite_phase2
      ?? formatHumidityRange(profile.humidity_phase2_min, profile.humidity_phase2_max),
    jour_arret_retournement: profile.turning_stop_day ?? profile.jour_arret_retournement,
    jours_retournement: profile.turning_days ?? profile.jours_retournement ?? [],
  };
}

function formatHumidityRange(min, max) {
  if (min === undefined || max === undefined) return "";
  return min === max ? `${min}%` : `${min}-${max}%`;
}

function parseHumidityRange(value, min, max, defaultMin, defaultMax, phase) {
  if (typeof value === "string" && value.trim()) {
    const values = value.match(/\d+(?:[.,]\d+)?/g)?.map((part) => Number(part.replace(",", ".")));
    if (!values?.length) throw new Error(`Humidité phase ${phase} invalide`);
    return {
      min: values[0],
      max: values[1] ?? values[0],
    };
  }
  return {
    min: min ?? defaultMin,
    max: max ?? defaultMax,
  };
}

function profilePayload(payload) {
  const phase1 = parseHumidityRange(
    payload.humidite_phase1,
    payload.humidity_phase1_min,
    payload.humidity_phase1_max,
    55,
    60,
    1,
  );
  const phase2 = parseHumidityRange(
    payload.humidite_phase2,
    payload.humidity_phase2_min,
    payload.humidity_phase2_max,
    65,
    75,
    2,
  );
  return {
    name: payload.name ?? payload.nom,
    duration_days: payload.duration_days ?? payload.duree_jours,
    temp_min: payload.temp_min ?? payload.temperature_min,
    temp_max: payload.temp_max ?? payload.temperature_max,
    humidity_phase1_min: phase1.min,
    humidity_phase1_max: phase1.max,
    humidity_phase2_min: phase2.min,
    humidity_phase2_max: phase2.max,
    turning_stop_day: payload.turning_stop_day ?? payload.jour_arret_retournement,
    turning_days: payload.turning_days ?? payload.jours_retournement ?? [],
  };
}

function normalizeAlarm(alarm) {
  if (!alarm) return null;
  return {
    ...alarm,
    active: alarm.status === "active",
    timestamp: alarm.triggered_at,
  };
}

function normalizeIncubator(incubator) {
  if (!incubator) return null;
  return {
    ...incubator,
    nom: incubator.name ?? incubator.nom,
    statut: incubator.status ?? incubator.statut,
  };
}

function normalizeLive(live) {
  const reading = normalizeReading(live?.latest_reading);
  return {
    ...live,
    ...(reading || {}),
    data: reading,
    temperature: reading?.temperature,
    humidite: reading?.humidite,
    pwm_chauffage: reading?.pwm_chauffage,
    prochain_retournement: live?.next_turning_at,
    en_ligne: live?.status === "online",
  };
}

async function request(path, options = {}) {
  if (USE_MOCKS) {
    const { getMockResponse } = await import("../mocks/mockApi.js");
    return getMockResponse(path, options);
  }

  const headers = { Accept: "application/json", ...options.headers };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (response.status === 401 && path !== "/auth/login") {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("smart-incubator:session-expired"));
  }
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  if (!response.ok) {
    const detail = typeof payload === "object" ? payload.detail : payload;
    throw new Error(detail || `Erreur API (${response.status})`);
  }
  return payload;
}

const json = (method, body) => ({ method, body: JSON.stringify(body) });
const normalizeHistoryPeriod = (period) => {
  if (period === "7d" || period === "30d" || period === "24h") return period;
  return "30d";
};

export const apiClient = {
  postLogin: (payload) => request("/auth/login", json("POST", payload)),
  postRegister: (payload) => request("/auth/register", json("POST", payload)),
  postLogout: () => request("/auth/logout", { method: "POST" }),
  getMe: () => request("/auth/me"),

  getIncubators: async () => (await request("/incubators")).map(normalizeIncubator),
  getIncubator: async (id) => {
    const incubator = await request(`/incubators/${id}`);
    const [live, cycle] = await Promise.all([
      request(`/incubators/${id}/telemetry/live`).catch(() => null),
      request(`/incubators/${id}/cycle`).catch(() => null),
    ]);
    const liveView = normalizeLive(live);
    const reading = liveView.data;
    return {
      ...normalizeIncubator(incubator),
      ...liveView,
      ...(reading || {}),
      ...(cycle ? {
        date_debut_incubation: cycle.cycle.start_date,
        date_fin_incubation: cycle.cycle.end_date,
        espece_active: cycle.species_profile.name,
        current_profile: normalizeProfile(cycle.species_profile),
        jour_incubation: cycle.current_day,
        duree_jours: cycle.total_days,
        prochain_retournement: liveView.prochain_retournement,
      } : {}),
    };
  },
  postIncubator: (payload) => request("/incubators", json("POST", {
    name: payload.name ?? payload.nom,
  })).then(normalizeIncubator),
  putIncubator: (id, payload) => request(`/incubators/${id}`, json("PUT", payload)),
  deleteIncubator: (id) => request(`/incubators/${id}`, { method: "DELETE" }),

  getProfiles: async () => (await request("/species-profiles")).map(normalizeProfile),
  postProfile: async (payload) =>
    normalizeProfile(await request("/species-profiles", json("POST", profilePayload(payload)))),
  putProfile: async (id, payload) =>
    normalizeProfile(await request(`/species-profiles/${id}`, json("PUT", profilePayload(payload)))),
  deleteProfile: (id) => request(`/species-profiles/${id}`, { method: "DELETE" }),

  getLiveStatus: async (id) => normalizeLive(await request(`/incubators/${id}/telemetry/live`)),
  getIncubatorMesures: async (id, period = "24h") =>
    (await request(`/incubators/${id}/telemetry/history?period=${normalizeHistoryPeriod(period)}`)).map(normalizeReading),
  exportHistory: (id, period = "24h") => request(`/incubators/${id}/telemetry/history/export?period=${normalizeHistoryPeriod(period)}`),

  getCycle: async (id) => {
    const cycle = await request(`/incubators/${id}/cycle`);
    return { ...cycle, species_profile: normalizeProfile(cycle.species_profile) };
  },
  startCycle: (id, profileId, startDate) => request(`/incubators/${id}/cycle/start`, json("POST", {
    species_profile_id: profileId,
    ...(startDate ? { start_date: startDate } : {}),
  })),
  stopCycle: (id) => request(`/incubators/${id}/cycle/stop`, { method: "POST" }),
  cancelCycle: (id) => request(`/incubators/${id}/cycle/cancel`, { method: "POST" }),

  getIncubatorAlarms: async (id) => (await request(`/incubators/${id}/alarms`)).map(normalizeAlarm),
  getAlarmSummary: (id) => request(`/incubators/${id}/alarms/summary`),
  resolveAlarm: (id, alarmId) => request(`/incubators/${id}/alarms/${alarmId}/resolve`, { method: "POST" }),

  postCommand: (id, actuator, action) => request(`/incubators/${id}/commands`, json("POST", { actuator, action })),
  postIncubatorPumpCommand: (id, payload) => apiClient.postCommand(id, "pump", payload.state),
  postIncubatorMotorCommand: (id) => apiClient.postCommand(id, "turning_motor", "trigger"),
  postIncubatorMixingFanCommand: (id, payload) => apiClient.postCommand(id, "mixing_fan", payload.state),
  postIncubatorExtractionCommand: (id, payload) => apiClient.postCommand(id, "extraction_fan", payload.state),
  getTurningSchedules: (id) => request(`/incubators/${id}/turning-schedules`),
  postTurningSchedule: (id, scheduledAt) => request(`/incubators/${id}/turning-schedules`, json("POST", { scheduled_at: scheduledAt })),
  deleteTurningSchedule: (id, scheduleId) => request(`/incubators/${id}/turning-schedules/${scheduleId}`, { method: "DELETE" }),
  tiltNow: (id) => request(`/incubators/${id}/telemetry/tilt`, { method: "POST" }),
  hatchNow: (id) => request(`/incubators/${id}/telemetry/hatch`, { method: "POST" }),

  getAutoTurnSettings: (id) => request(`/incubators/${id}/settings/auto-turn`),
  updateAutoTurnSettings: (id, payload) => request(`/incubators/${id}/settings/auto-turn`, json("PUT", payload)),
  postSetpoint: async (payload) => {
    const id = localStorage.getItem("selectedIncubatorId");
    if (!id) throw new Error("Aucun incubateur sélectionné");
    return apiClient.updateAutoTurnSettings(id, {
      frequency_hours: Math.max(1, Math.round(Number(payload.valeur_heures || 2))),
      enabled: true,
    });
  },
  syncNtp: (id) => request(`/incubators/${id}/settings/sync-ntp`, { method: "POST" }),
  getEvents: (id) => request(`/incubators/${id}/settings/events`),
  getFirmwareConfig: (id) => request(`/incubators/${id}/settings/firmware-config`),
};

export { BASE_URL, getToken };
