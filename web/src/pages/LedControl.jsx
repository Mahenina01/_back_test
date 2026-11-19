import { Lightbulb } from 'lucide-react';
import { useState } from 'react';
import { useMqtt } from '../context/MqttContext';

export default function LedControl() {
  const { connection, connected, deviceStatus, ledState, publishLedState } = useMqtt();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const sendCommand = async (on) => {
    setPending(true);
    setError('');
    try {
      await publishLedState(on);
    } catch (commandError) {
      setError(commandError.message || 'Échec de la commande MQTT.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Contrôle de la LED GPIO2</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          Commande MQTT directe de la LED intégrée à l’ESP32.
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

        <div className="my-10 flex flex-col items-center gap-4">
          <div className={`flex h-32 w-32 items-center justify-center rounded-full border transition ${
            ledState
              ? 'border-emerald-400 bg-emerald-100 text-emerald-600 shadow-[0_0_40px_rgba(16,185,129,0.3)]'
              : 'border-[var(--color-line-strong)] bg-[var(--color-bg)] text-[var(--color-ink-faint)]'
          }`}>
            <Lightbulb size={48} strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium text-[var(--color-ink)]">
            {ledState === null ? 'État inconnu' : ledState ? 'LED allumée' : 'LED éteinte'}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => sendCommand(true)}
            disabled={!connected || deviceStatus !== 'online' || pending}
            className="btn-primary min-h-11 flex-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Allumer
          </button>
          <button
            type="button"
            onClick={() => sendCommand(false)}
            disabled={!connected || deviceStatus !== 'online' || pending}
            className="btn-secondary min-h-11 flex-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Éteindre
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-[var(--color-crit)]" role="alert">{error}</p>}
      </section>

      <p className="text-xs leading-relaxed text-[var(--color-ink-soft)]">
        Le bouton « Ventilateur de brassage » dans Commandes manuelles pilote également cette LED.
        Aucun ventilateur physique n’est connecté à GPIO2.
      </p>
    </div>
  );
}
