import React, { useState, useEffect, useMemo } from 'react';
import Card from '../components/Card';
import { useApi } from '../hooks/useApi';
import { apiClient } from '../services/apiClient';
import {
  Clock, RefreshCw, CalendarClock, ScrollText, Download,
  CheckCircle, AlertCircle, Wifi
} from 'lucide-react';

const MOCK_EVENTS = [
  { id: 1, type: 'consigne', message: 'Consigne température modifiée : 37.5°C → 37.6°C', timestamp: '2026-01-15T14:20:00Z', user: 'admin' },
  { id: 2, type: 'commande', message: 'Pompe à eau activée manuellement', timestamp: '2026-01-15T13:45:00Z', user: 'admin' },
  { id: 3, type: 'alarme', message: 'Alarme température haute déclenchée : 38.2°C', timestamp: '2026-01-15T14:32:00Z', user: 'système' },
  { id: 4, type: 'alimentation', message: 'Bascule sur batterie de secours', timestamp: '2026-01-15T11:02:00Z', user: 'système' },
  { id: 5, type: 'alimentation', message: 'Retour secteur', timestamp: '2026-01-15T11:18:00Z', user: 'système' },
  { id: 6, type: 'profil', message: "Profil actif changé : Poule → Canard", timestamp: '2026-01-14T09:00:00Z', user: 'admin' },
  { id: 7, type: 'commande', message: 'Retournement manuel déclenché', timestamp: '2026-01-14T08:12:00Z', user: 'opérateur' },
];

const EVENT_TYPES = {
  consigne: { label: 'Consigne', color: 'var(--color-accent)' },
  commande: { label: 'Commande manuelle', color: 'var(--color-ink-soft)' },
  alarme: { label: 'Alarme', color: 'var(--color-crit)' },
  alimentation: { label: 'Alimentation', color: 'var(--color-warn)' },
  profil: { label: 'Profil', color: 'var(--color-ok)' },
};

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function eventsToCsv(events) {
  const header = ['timestamp', 'type', 'message', 'utilisateur'];
  const lines = events.map(e => [e.timestamp, e.type, `"${e.message.replace(/"/g, '""')}"`, e.user].join(','));
  return [header.join(','), ...lines].join('\n');
}

function eventsToPrintableHtml(events) {
  const rows = events.map(e => `
    <tr>
      <td>${new Date(e.timestamp).toLocaleString('fr-FR')}</td>
      <td>${EVENT_TYPES[e.type]?.label || e.type}</td>
      <td>${e.message}</td>
      <td>${e.user}</td>
    </tr>`).join('');
  return `
    <html>
      <head>
        <title>Journal d'événements</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #1B1E1D; }
          h1 { font-size: 18px; margin-bottom: 4px; }
          p { color: #5B6058; font-size: 12px; margin-top: 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { text-align: left; padding: 6px 8px; font-size: 12px; border-bottom: 1px solid #E2E1DA; }
          th { color: #5B6058; font-weight: 600; }
        </style>
      </head>
      <body>
        <h1>Journal d'événements — Smart Incubator</h1>
        <p>Exporté le ${new Date().toLocaleString('fr-FR')}</p>
        <table>
          <thead><tr><th>Horodatage</th><th>Type</th><th>Message</th><th>Utilisateur</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>`;
}

export default function Parametres() {
  const { execute } = useApi();

  const [now, setNow] = useState(new Date());
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState('2026-01-15T08:00:00Z');
  const [syncOk, setSyncOk] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleSyncNtp = async () => {
    setSyncing(true);
    try {
      await new Promise(r => setTimeout(r, 900));
      setLastSync(new Date().toISOString());
      setSyncOk(true);
    } catch (err) {
      console.error('Erreur synchronisation NTP:', err);
      setSyncOk(false);
    } finally {
      setSyncing(false);
    }
  };

  const [freqHours, setFreqHours] = useState(2);
  const [savedFreq, setSavedFreq] = useState(2);
  const [savingFreq, setSavingFreq] = useState(false);
  const [freqSaved, setFreqSaved] = useState(false);

  const handleSaveFreq = async () => {
    setSavingFreq(true);
    setFreqSaved(false);
    try {
      await execute(() => apiClient.postSetpoint({ type: 'retournement_frequence', valeur_heures: freqHours }));
      setSavedFreq(freqHours);
      setFreqSaved(true);
      setTimeout(() => setFreqSaved(false), 2500);
    } catch (err) {
      console.error('Erreur enregistrement fréquence:', err);
    } finally {
      setSavingFreq(false);
    }
  };

  const nextTurns = useMemo(() => {
    const anchor = new Date();
    const list = [];
    for (let i = 1; i <= 6; i++) {
      list.push(new Date(anchor.getTime() + i * savedFreq * 60 * 60 * 1000));
    }
    return list;
  }, [savedFreq, now]);

  const [typeFilter, setTypeFilter] = useState('all');
  const filteredEvents = typeFilter === 'all'
    ? MOCK_EVENTS
    : MOCK_EVENTS.filter(e => e.type === typeFilter);

  const handleExportCsv = () => {
    downloadBlob(eventsToCsv(filteredEvents), 'journal_evenements.csv', 'text/csv');
  };

  const handleExportPdf = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(eventsToPrintableHtml(filteredEvents));
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Paramètres</h1>
        <p className="text-[var(--color-ink-soft)] mt-1 text-sm">Réglages temporels, planification et journal d'événements</p>
      </div>

      { }
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-[var(--color-ink-soft)]" strokeWidth={1.75} />
          <h3 className="font-medium text-[var(--color-ink)]">Horloge système</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="stat-label">Heure actuelle</p>
            <p className="stat-value mt-1">{now.toLocaleTimeString('fr-FR')}</p>
            <p className="text-xs text-[var(--color-ink-faint)] mt-1">{now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
          <div>
            <p className="stat-label">Dernière synchronisation NTP</p>
            <p className="text-sm data-value mt-1">{new Date(lastSync).toLocaleString('fr-FR')}</p>
            <span className={`status-line mt-2 ${syncOk ? 'text-[var(--color-ok)]' : 'text-[var(--color-crit)]'}`}>
              <span className={`status-dot ${syncOk ? 'bg-[var(--color-ok)]' : 'bg-[var(--color-crit)]'}`} />
              {syncOk ? 'Horloge à jour' : 'Échec de synchronisation'}
            </span>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleSyncNtp}
              disabled={syncing}
              className="btn-secondary w-full flex items-center justify-center gap-2 py-2 px-4 text-sm disabled:opacity-50"
            >
              <Wifi className={`w-4 h-4 ${syncing ? 'animate-pulse' : ''}`} strokeWidth={1.75} />
              {syncing ? 'Synchronisation…' : 'Synchroniser (NTP)'}
            </button>
          </div>
        </div>
        <p className="text-xs text-[var(--color-ink-faint)] mt-4">
          La synchronisation NTP nécessite une connexion Internet côté serveur. Sans connexion, l'horloge RTC embarquée continue de faire foi.
        </p>
      </Card>

      { }
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <CalendarClock className="w-4 h-4 text-[var(--color-ink-soft)]" strokeWidth={1.75} />
          <h3 className="font-medium text-[var(--color-ink)]">Retournement automatique</h3>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-6">
          <div>
            <label className="block text-sm text-[var(--color-ink-soft)] mb-1.5">Fréquence (heures)</label>
            <input
              type="number"
              min={0.5}
              max={12}
              step={0.5}
              value={freqHours}
              onChange={(e) => setFreqHours(parseFloat(e.target.value) || 0.5)}
              className="input-field w-32 px-3 py-2 text-sm text-[var(--color-ink)]"
            />
          </div>
          <button
            onClick={handleSaveFreq}
            disabled={savingFreq || freqHours === savedFreq}
            className="btn-primary py-2 px-4 text-sm disabled:opacity-50"
          >
            {savingFreq ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          {freqSaved && (
            <span className="status-line text-[var(--color-ok)]">
              <CheckCircle className="w-4 h-4" strokeWidth={1.75} />
              Fréquence mise à jour
            </span>
          )}
          <span className="text-xs text-[var(--color-ink-faint)] sm:ml-auto">Par défaut : 2 heures</span>
        </div>

        <p className="stat-label mb-2">Prochains retournements planifiés</p>
        <div className="divide-y divide-[var(--color-line)] border border-[var(--color-line)] rounded">
          {nextTurns.map((t, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-[var(--color-ink)]">{t.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              <span className="data-value text-[var(--color-ink)]">{t.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          ))}
        </div>
      </Card>

      { }
      <Card>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-[var(--color-ink-soft)]" strokeWidth={1.75} />
            <h3 className="font-medium text-[var(--color-ink)]">Journal d'événements</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="input-field px-3 py-2 text-sm text-[var(--color-ink)]"
            >
              <option value="all">Tous les types</option>
              {Object.entries(EVENT_TYPES).map(([key, v]) => (
                <option key={key} value={key}>{v.label}</option>
              ))}
            </select>
            <button onClick={handleExportCsv} className="btn-secondary flex items-center gap-2 px-3 py-2 text-sm">
              <Download className="w-4 h-4" strokeWidth={1.75} />
              CSV
            </button>
            <button onClick={handleExportPdf} className="btn-secondary flex items-center gap-2 px-3 py-2 text-sm">
              <Download className="w-4 h-4" strokeWidth={1.75} />
              PDF
            </button>
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="text-center py-8 text-[var(--color-ink-soft)] text-sm">
            <AlertCircle className="w-6 h-6 mx-auto mb-2 text-[var(--color-ink-faint)]" strokeWidth={1.5} />
            Aucun événement pour ce filtre
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)]">
                  <th className="text-left py-2.5 font-medium text-[var(--color-ink-soft)]">Horodatage</th>
                  <th className="text-left py-2.5 font-medium text-[var(--color-ink-soft)]">Type</th>
                  <th className="text-left py-2.5 font-medium text-[var(--color-ink-soft)]">Événement</th>
                  <th className="text-left py-2.5 font-medium text-[var(--color-ink-soft)]">Utilisateur</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((e) => (
                  <tr key={e.id} className="border-b border-[var(--color-line)] last:border-0">
                    <td className="py-2.5 data-value text-[var(--color-ink)]">{new Date(e.timestamp).toLocaleString('fr-FR')}</td>
                    <td className="py-2.5">
                      <span className="status-line" style={{ color: EVENT_TYPES[e.type]?.color }}>
                        <span className="status-dot" style={{ backgroundColor: EVENT_TYPES[e.type]?.color }} />
                        {EVENT_TYPES[e.type]?.label || e.type}
                      </span>
                    </td>
                    <td className="py-2.5 text-[var(--color-ink)]">{e.message}</td>
                    <td className="py-2.5 text-[var(--color-ink-soft)]">{e.user}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}