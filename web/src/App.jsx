import { useEffect, useState } from "react";
import mqtt from "mqtt";

const commandTopic = "esp32-devkit-v1/led/command";
const stateTopic = "esp32-devkit-v1/led/state";
const statusTopic = "esp32-devkit-v1/status";
const mqttUrl = import.meta.env.VITE_MQTT_URL;
const mqttUsername = import.meta.env.VITE_MQTT_USERNAME;
const mqttPassword = import.meta.env.VITE_MQTT_PASSWORD;

export default function App() {
  const [connection, setConnection] = useState("Connexion en cours");
  const [deviceStatus, setDeviceStatus] = useState("inconnu");
  const [ledState, setLedState] = useState(null);
  const [client, setClient] = useState(null);

  useEffect(() => {
    if (!mqttUrl || !mqttUsername || !mqttPassword) {
      setConnection("Configuration MQTT manquante");
      return undefined;
    }

    const mqttClient = mqtt.connect(mqttUrl, {
      username: mqttUsername,
      password: mqttPassword,
      clientId: `web-${Math.random().toString(16).slice(2, 10)}`,
      clean: true,
      connectTimeout: 10000,
      reconnectPeriod: 3000,
    });

    mqttClient.on("connect", () => {
      setConnection("Connecté au broker");
      mqttClient.subscribe([stateTopic, statusTopic], (error) => {
        if (error) setConnection("Échec de l’abonnement MQTT");
      });
    });
    mqttClient.on("reconnect", () => setConnection("Reconnexion…"));
    mqttClient.on("offline", () => setConnection("Hors ligne"));
    mqttClient.on("error", () => setConnection("Erreur MQTT"));
    mqttClient.on("message", (topic, message) => {
      if (topic === statusTopic) {
        setDeviceStatus(message.toString());
      }
      if (topic === stateTopic) {
        const state = message.toString();
        if (state === "ON" || state === "OFF") setLedState(state === "ON");
      }
    });

    setClient(mqttClient);
    return () => mqttClient.end(true);
  }, []);

  function sendCommand(on) {
    if (!client?.connected) return;
    client.publish(commandTopic, on ? "ON" : "OFF", { qos: 1, retain: false });
  }

  return (
    <main className="page">
      <section className="card" aria-labelledby="title">
        <div className="eyebrow">ESP32 DEVKIT V1 · GPIO2</div>
        <h1 id="title">Contrôle de la LED</h1>
        <p className="intro">Commandez la LED intégrée de votre carte depuis le Web.</p>

        <div className="status" role="status">
          <span className={`connection-dot ${client?.connected ? "online" : ""}`} />
          {connection}
        </div>
        <p className="device-status">
          Carte : {deviceStatus === "online" ? "en ligne" : "hors ligne"}
        </p>

        <div className={`led ${ledState ? "lit" : ""}`} aria-label={
          ledState === null ? "État inconnu" : ledState ? "LED allumée" : "LED éteinte"
        }>
          <span />
        </div>
        <p className="led-label">
          {ledState === null ? "État inconnu" : ledState ? "LED allumée" : "LED éteinte"}
        </p>

        <div className="actions">
          <button
            type="button"
            onClick={() => sendCommand(true)}
            disabled={!client?.connected || deviceStatus !== "online"}
          >
            Allumer
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => sendCommand(false)}
            disabled={!client?.connected || deviceStatus !== "online"}
          >
            Éteindre
          </button>
        </div>
        <p className="footnote">La carte et cette page doivent être connectées au même broker MQTT.</p>
      </section>
    </main>
  );
}
