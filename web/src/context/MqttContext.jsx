import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import mqtt from 'mqtt';

const vibrationTopic = 'esp32-devkit-v1/vibration/state';
const statusTopic = 'esp32-devkit-v1/status';
const mqttUrl = import.meta.env.VITE_MQTT_URL;
const mqttUsername = import.meta.env.VITE_MQTT_USERNAME;
const mqttPassword = import.meta.env.VITE_MQTT_PASSWORD;

const MqttContext = createContext(null);

export function MqttProvider({ children }) {
  const clientRef = useRef(null);
  const [connection, setConnection] = useState('Connexion en cours');
  const [connected, setConnected] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState('inconnu');
  const [vibrationDetected, setVibrationDetected] = useState(null);

  useEffect(() => {
    if (!mqttUrl || !mqttUsername || !mqttPassword) {
      setConnection('Configuration MQTT manquante');
      setConnected(false);
      return undefined;
    }

    const client = mqtt.connect(mqttUrl, {
      username: mqttUsername,
      password: mqttPassword,
      clientId: `web-${Math.random().toString(16).slice(2, 10)}`,
      clean: true,
      connectTimeout: 10000,
      reconnectPeriod: 3000,
    });
    clientRef.current = client;

    client.on('connect', () => {
      client.subscribe([vibrationTopic, statusTopic], (error) => {
        if (error) {
          setConnection('Échec de l’abonnement MQTT');
          setConnected(false);
          return;
        }
        setConnection('Connecté au broker');
        setConnected(true);
      });
    });
    client.on('reconnect', () => {
      setConnection('Reconnexion…');
      setConnected(false);
    });
    client.on('offline', () => {
      setConnection('Hors ligne');
      setConnected(false);
    });
    client.on('close', () => {
      setConnection('Hors ligne');
      setConnected(false);
    });
    client.on('error', () => {
      setConnection('Erreur MQTT');
      setConnected(false);
    });
    client.on('message', (topic, message) => {
      const value = message.toString();
      if (topic === statusTopic) {
        setDeviceStatus(value);
      } else if (topic === vibrationTopic && (value === 'ON' || value === 'OFF')) {
        setVibrationDetected(value === 'ON');
      }
    });

    return () => {
      clientRef.current = null;
      client.end(true);
    };
  }, []);

  return (
    <MqttContext.Provider value={{ connection, connected, deviceStatus, vibrationDetected }}>
      {children}
    </MqttContext.Provider>
  );
}

export function useMqtt() {
  const context = useContext(MqttContext);
  if (!context) {
    throw new Error('useMqtt must be used within MqttProvider');
  }
  return context;
}
