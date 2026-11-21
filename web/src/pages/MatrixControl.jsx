import React, { useState } from 'react';
import { Grid3X3 } from 'lucide-react';
import { useMqtt } from '../context/MqttContext';

export default function MatrixControl() {
  const { connection, connected, deviceStatus, displayedDigit, publishMatrixDigit } = useMqtt();
  const [digit, setDigit] = useState('0');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const deviceReady = connected && deviceStatus === 'online';

  const sendDigit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!/^[0-9]$/.test(digit)) {
      setError('Saisissez un chiffre entier de 0 à 9.');
      return;
    }

    setPending(true);
    try {
      await publishMatrixDigit(Number(digit));
      setNotice(`Commande MQTT publiée : ${digit}`);
    } catch (commandError) {
      setError(commandError.message || 'Échec de l’envoi MQTT.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Matrice LED MAX7219</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          Saisissez un chiffre de 0 à 9 pour l’afficher sur la matrice connectée à l’ESP32.
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

        <div className="my-8 flex flex-col items-center gap-3" aria-live="polite">
          <div className="flex h-32 w-32 items-center justify-center rounded-2xl border border-[var(--color-line-strong)] bg-[var(--color-bg)] text-[var(--color-ink)]">
            {displayedDigit === null
              ? <Grid3X3 size={48} strokeWidth={1.5} />
              : <span className="font-mono text-7xl font-semibold">{displayedDigit}</span>}
          </div>
          <p className="text-sm font-medium text-[var(--color-ink-soft)]">
            {displayedDigit === null ? 'Aucun état reçu' : `Chiffre affiché : ${displayedDigit}`}
          </p>
        </div>

        <form onSubmit={sendDigit} className="space-y-3">
          <label htmlFor="matrix-digit" className="block text-sm font-medium text-[var(--color-ink)]">
            Chiffre à afficher (0 à 9)
          </label>
          <div className="flex gap-3">
            <input
              id="matrix-digit"
              type="number"
              inputMode="numeric"
              min="0"
              max="9"
              step="1"
              value={digit}
              onChange={(event) => setDigit(event.target.value)}
              disabled={!deviceReady || pending}
              className="input-field min-h-11 w-24 px-3 text-center text-lg disabled:opacity-50"
              required
            />
            <button
              type="submit"
              disabled={!deviceReady || pending}
              className="btn-primary min-h-11 flex-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? 'Envoi…' : 'Afficher sur la matrice'}
            </button>
          </div>
        </form>

        {error && <p className="mt-3 text-sm text-[var(--color-crit)]" role="alert">{error}</p>}
        {notice && <p className="mt-3 text-sm text-[var(--color-ok)]" role="status">{notice}</p>}
      </section>

      <p className="text-xs leading-relaxed text-[var(--color-ink-soft)]">
        Câblage prévu : DIN sur GPIO23, CLK sur GPIO18 et CS/LOAD sur GPIO2.
        GPIO18 et GPIO23 sont partagés avec le bus SPI du TFT.
      </p>
    </div>
  );
}
