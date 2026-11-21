import React from 'react';
import { Activity } from 'lucide-react';
import { useMqtt } from '../context/MqttContext';

export default function LedControl() {
  const { connection, connected, deviceStatus, vibrationDetected } = useMqtt();
  const sensorReady = connected && deviceStatus === 'online' && typeof vibrationDetected === 'boolean';
  const vibrationLabel = !connected || deviceStatus !== 'online'
    ? 'Capteur indisponible'
    : vibrationDetected === null
      ? 'En attente de l’état du capteur'
      : vibrationDetected
        ? 'Vibration détectée'
        : 'Aucune vibration';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Capteur de vibration KY-002</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          Surveillance en temps réel du capteur connecté à GPIO2.
        </p>
      </div>

      <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className={`status-dot ${connected ? 'bg-[var(--color-ok)]' : 'bg-[var(--color-crit)]'}`} />
            <span className="font-medium text-[var(--color-ink)]">{connection}</span>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${
            deviceStatus === 'online'
              ? 'bg-[var(--color-ok-soft)] text-[var(--color-ok)]'
              : 'bg-[var(--color-crit-soft)] text-[var(--color-crit)]'
          }`}>
            ESP32 {deviceStatus === 'online' ? 'en ligne' : 'hors ligne'}
          </span>
        </div>

        <div className="my-10 flex flex-col items-center gap-4" aria-live="polite">
          <div className={`flex h-32 w-32 items-center justify-center rounded-full border transition ${
            sensorReady && vibrationDetected
              ? 'border-amber-400 bg-amber-100 text-amber-700 shadow-[0_0_40px_rgba(245,158,11,0.3)]'
              : sensorReady
                ? 'border-emerald-400 bg-emerald-100 text-emerald-600'
                : 'border-[var(--color-line-strong)] bg-[var(--color-bg)] text-[var(--color-ink-faint)]'
          }`}>
            <Activity size={48} strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium text-[var(--color-ink)]">
            {vibrationLabel}
          </p>
        </div>
      </section>

      <p className="text-xs leading-relaxed text-[var(--color-ink-soft)]">
        Le capteur envoie « ON » lorsqu’une vibration est détectée et « OFF » au retour au repos.
      </p>
    </div>
  );
}
