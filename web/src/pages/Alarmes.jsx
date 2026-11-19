import React, {
  useEffect,
  useState,
} from 'react';

import {
  Bell,
  CheckCircle,
} from 'lucide-react';

import Card from '../components/Card';
import { useIncubator } from '../context/IncubatorContext';
import { useApi } from '../hooks/useApi';
import { apiClient } from '../services/apiClient';

export default function Alarmes() {
  const { selectedIncubatorId } = useIncubator();
  const { execute, loading: apiLoading } = useApi();
  const [alarms, setAlarms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlarms = async () => {
      if (!selectedIncubatorId) {
        setLoading(false);
        return;
      }
      try {
        const data = await execute(() => apiClient.getIncubatorAlarms(selectedIncubatorId));
        setAlarms(data || []);
      } catch (err) {
        console.error('Erreur chargement alarmes:', err);
        setAlarms([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAlarms();
  }, [selectedIncubatorId]);

  const getSeverityStyle = (severity) => {
    const map = {
      critique: 'text-[var(--color-crit)]',
      élevée: 'text-[var(--color-warn)]',
      moyenne: 'text-[var(--color-warn)]',
      basse: 'text-[var(--color-ink-soft)]',
    };
    return map[severity] || map.basse;
  };

  const activeAlarms = alarms.filter(a => a.active);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-5 h-5 border-2 border-[var(--color-ink-faint)] border-t-[var(--color-ink)] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Alarmes</h1>
          <p className="text-[var(--color-ink-soft)] mt-1 text-sm">
            {activeAlarms.length} alarme{activeAlarms.length > 1 ? 's' : ''} active{activeAlarms.length > 1 ? 's' : ''}
          </p>
        </div>
        <button className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm">
          <Bell className="w-4 h-4" strokeWidth={1.75} />
          <span>Notifications</span>
        </button>
      </div>

      { }
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <p className="stat-label">Alarmes actives</p>
          <p className="stat-value mt-1 text-[var(--color-crit)]">{activeAlarms.length}</p>
        </Card>
        <Card>
          <p className="stat-label">Résolues</p>
          <p className="stat-value mt-1 text-[var(--color-ok)]">{alarms.length - activeAlarms.length}</p>
        </Card>
        <Card>
          <p className="stat-label">Total</p>
          <p className="stat-value mt-1">{alarms.length}</p>
        </Card>
      </div>

      { }
      <Card>
        <h3 className="font-medium text-[var(--color-ink)] mb-4">Historique des alarmes</h3>
        {alarms.length === 0 ? (
          <div className="text-center py-10 text-[var(--color-ink-soft)]">
            <CheckCircle className="w-8 h-8 text-[var(--color-ok)] mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm">Aucune alarme enregistrée — tout fonctionne correctement</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-line)]">
            {alarms.map((alarm) => (
              <div
                key={alarm.id}
                className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <span className={`status-dot mt-1.5 ${alarm.active ? 'bg-[var(--color-crit)]' : 'bg-[var(--color-ok)]'}`} />
                  <div>
                    <p className="text-[var(--color-ink)]">{alarm.message}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-[var(--color-ink-soft)]">
                      <span className="data-value">{alarm.timestamp}</span>
                      <span>{alarm.active ? 'Active' : 'Résolue'}</span>
                      <span className={getSeverityStyle(alarm.severity)}>Sévérité : {alarm.severity}</span>
                    </div>
                  </div>
                </div>
                {alarm.active && (
                  <button className="btn-secondary px-3 py-1.5 text-sm self-start md:self-center">
                    Acquitter
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}