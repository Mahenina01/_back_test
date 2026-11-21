
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth";
import { useIncubator } from "../context/IncubatorContext";
import { getToken, normalizeReading } from "../services/apiClient";

const USE_MOCKS = import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === "true";
const READING_STALE_TIMEOUT_MS = 15000;
const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");
const WS_BASE_URL = (import.meta.env.VITE_WS_URL || API_URL.replace(/^http/, "ws")).replace(/\/$/, "");
const ESP32_WS_URL = import.meta.env.VITE_ESP32_WS_URL;

function normalizeEsp32Message(message) {
  if (!message || typeof message !== "object" || typeof message.t !== "number"
    || typeof message.h !== "number" || typeof message.pid !== "number") {
    throw new Error("Format de mesure ESP32 non reconnu.");
  }

  return {
    event: "mesure",
    data: {
      temperature: message.t,
      consigne_temperature: message.ts,
      humidite: message.h,
      consigne_humidite: message.hs,
      pwm_chauffage: message.pid,
      etat_ventilateur_brassage: message.fan ? "on" : "off",
      etat_ventilateur_extraction: null,
      etat_pompe: message.pump ? "on" : "off",
      etat_humidificateur: message.hum ? "on" : "off",
      niveau_eau: message.eau === "OK" ? "ok" : message.eau === "BASSE" ? "bas"
        : message.eau === "VIDE" ? "vide" : null,
      alarme: message.al,
      jour_incubation: message.day,
      sensor_fault: message.sensor_fault !== false,
    },
  };
}

function normalizeBackendMessage(message) {
  if (message?.type === "reading" && message.data) {
    return { event: "mesure", data: normalizeReading(message.data) };
  }
  return message;
}

export function useLiveSocket() {
  const { user } = useAuth();
  const { selectedIncubatorId } = useIncubator();
  const [dernierMessage, setDernierMessage] = useState(null);
  const [derniereMesure, setDerniereMesure] = useState(null);
  const [enLigne, setEnLigne] = useState(false);
  const indexRef = useRef(0);
  const readingTimeoutRef = useRef(null);

  useEffect(() => {
    setDernierMessage(null);
    setDerniereMesure(null);
    setEnLigne(false);
    clearTimeout(readingTimeoutRef.current);

    const acceptMessage = (message) => {
      setDernierMessage(message);
      if (message?.event !== "mesure") return;

      setDerniereMesure(message);
      clearTimeout(readingTimeoutRef.current);
      readingTimeoutRef.current = setTimeout(() => {
        setDerniereMesure(null);
      }, READING_STALE_TIMEOUT_MS);
    };

    if (USE_MOCKS && !ESP32_WS_URL) {
      let annule = false;
      let intervalId;
      import("../mocks/fixtures/ws-mesures-sample.json").then((mod) => {
        const evenements = mod.default;
        if (annule) return;
        setEnLigne(true);
        intervalId = setInterval(() => {
          if (annule) return;
          acceptMessage(evenements[indexRef.current % evenements.length]);
          indexRef.current += 1;
        }, 3000);
      }).catch((error) => {
        console.error("Erreur de chargement des mesures simulées :", error);
        setEnLigne(false);
      });
      return () => {
        annule = true;
        clearInterval(intervalId);
        clearTimeout(readingTimeoutRef.current);
      };
    }

    const token = getToken();
    if (!ESP32_WS_URL && (!selectedIncubatorId || !token)) {
      setEnLigne(false);
      return undefined;
    }

    const socketUrl = ESP32_WS_URL || `${WS_BASE_URL}/ws/incubators/${selectedIncubatorId}?token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(socketUrl);
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        acceptMessage(ESP32_WS_URL
          ? normalizeEsp32Message(message)
          : normalizeBackendMessage(message));
      } catch (error) {
        console.error("Message WebSocket invalide :", error);
      }
    };
    socket.onopen = () => setEnLigne(true);
    socket.onclose = () => {
      setEnLigne(false);
      setDerniereMesure(null);
      clearTimeout(readingTimeoutRef.current);
    };
    socket.onerror = (error) => {
      console.error("Erreur de connexion WebSocket :", error);
      setEnLigne(false);
    };
    return () => {
      socket.close();
      clearTimeout(readingTimeoutRef.current);
    };
  }, [selectedIncubatorId, user]);

  return { dernierMessage, derniereMesure, enLigne, directEsp32: Boolean(ESP32_WS_URL) };
}
