import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Download,
  RefreshCw,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import Card from '../components/Card';
import { useIncubator } from '../context/IncubatorContext';
import { useApi } from '../hooks/useApi';
import { apiClient } from '../services/apiClient';

const RANGES = [
  { value: '24h', label: 'Jour (24h)' },
  { value: 'cycle', label: 'Cycle complet' },
  { value: 'custom', label: 'Personnalisée' },
];

function toCsv(rows) {
  const header = ['timestamp', 'temperature', 'humidite', 'pwm_chauffage'];
  const lines = rows.map(r => [r.timestamp, r.temperature, r.humidite, r.pwm_chauffage].join(','));
  return [header.join(','), ...lines].join('\n');
}

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

export default function Historique() {
  const { selectedIncubatorId } = useIncubator();
  const { execute } = useApi();
  const [rangeType, setRangeType] = useState('24h');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [mesures, setMesures] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);

  const effectiveRange = rangeType === 'custom'
    ? (customStart && customEnd ? `${customStart}_${customEnd}` : null)
    : rangeType;

  useEffect(() => {
    if (rangeType === 'custom' && !effectiveRange) return;
    if (!selectedIncubatorId) {
      setLoading(false);
      return;
    }
    const fetchData = async () => {
      setLoading(true);
      try {
        const [mesuresData, statusData] = await Promise.all([
          execute(() => apiClient.getIncubatorMesures(selectedIncubatorId, effectiveRange)),
          execute(() => apiClient.getIncubator(selectedIncubatorId)),
        ]);
        setMesures(mesuresData || []);
        setStatus(statusData || null);
      } catch (err) {
        console.error('Erreur chargement historique:', err);
        setMesures([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [effectiveRange, rangeType, selectedIncubatorId]);

  const chartData = useMemo(() => mesures.map(m => ({
    time: new Date(m.timestamp).toLocaleString('fr-FR', {
      day: rangeType === '24h' ? undefined : '2-digit',
      month: rangeType === '24h' ? undefined : '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }),
    timestamp: m.timestamp,
    temp: m.temperature,
    humidite: m.humidite,
    pwm: m.pwm_chauffage,
  })), [mesures, rangeType]);

  const consigneTemp = status?.consigne_temperature ?? 37.5;
  const consigneHumMin = status?.consigne_humidite_min ?? 55;
  const consigneHumMax = status?.consigne_humidite_max ?? 60;

  const handleExport = (format) => {
    setExportOpen(false);
    const filename = `historique_${effectiveRange || rangeType}.${format}`;
    if (format === 'csv') {
      downloadBlob(toCsv(mesures), filename, 'text/csv');
    } else {
      downloadBlob(JSON.stringify(mesures, null, 2), filename, 'application/json');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Historique des données</h1>
          <p className="text-[var(--color-ink-soft)] mt-1 text-sm">Évolution des mesures dans le temps</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={rangeType}
            onChange={(e) => setRangeType(e.target.value)}
            className="input-field px-3 py-2 text-sm text-[var(--color-ink)]"
          >
            {RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>

          {rangeType === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="input-field px-3 py-2 text-sm text-[var(--color-ink)]"
              />
              <span className="text-sm text-[var(--color-ink-faint)]">→</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="input-field px-3 py-2 text-sm text-[var(--color-ink)]"
              />
            </div>
          )}

          <div className="relative">
            <button
              onClick={() => setExportOpen(o => !o)}
              disabled={mesures.length === 0}
              className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
            >
              <Download className="w-4 h-4" strokeWidth={1.75} />
              <span>Exporter</span>
            </button>
            {exportOpen && (
              <div className="absolute right-0 mt-1 w-36 bg-[var(--color-surface)] border border-[var(--color-line)] rounded shadow-sm z-10">
                <button
                  onClick={() => handleExport('csv')}
                  className="w-full text-left px-3 py-2 text-sm text-[var(--color-ink)] hover:bg-[var(--color-bg)]"
                >
                  Format CSV
                </button>
                <button
                  onClick={() => handleExport('json')}
                  className="w-full text-left px-3 py-2 text-sm text-[var(--color-ink)] hover:bg-[var(--color-bg)] border-t border-[var(--color-line)]"
                >
                  Format JSON
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-[var(--color-ink)]">Courbes de température et humidité</h3>
          <span className="text-sm text-[var(--color-ink-soft)]">
            {RANGES.find(r => r.value === rangeType)?.label}
          </span>
        </div>

        {loading ? (
          <div className="h-80 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-[var(--color-ink-soft)] animate-spin" strokeWidth={1.75} />
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-80 flex items-center justify-center border border-dashed border-[var(--color-line-strong)] rounded">
            <p className="text-sm text-[var(--color-ink-faint)]">Aucune mesure pour cette période</p>
          </div>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#E2E1DA" />
                <XAxis dataKey="time" stroke="#8B8F89" fontSize={12} tickLine={false} axisLine={{ stroke: '#E2E1DA' }} />
                <YAxis yAxisId="temp" stroke="#8B8F89" fontSize={12} domain={[35, 40]} tickLine={false} axisLine={false} />
                <YAxis yAxisId="humidite" stroke="#8B8F89" fontSize={12} domain={[30, 90]} orientation="right" tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E2E1DA', borderRadius: 4, fontSize: 13 }}
                  labelStyle={{ color: '#5B6058' }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: '#5B6058' }}
                  formatter={(value) => (
                    <span style={{ color: '#5B6058' }}>{value}</span>
                  )}
                />

                { }
                <ReferenceArea
                  yAxisId="humidite"
                  y1={consigneHumMin}
                  y2={consigneHumMax}
                  fill="#2F6F4E"
                  fillOpacity={0.06}
                  strokeOpacity={0}
                />
                { }
                <ReferenceLine
                  yAxisId="temp"
                  y={consigneTemp}
                  stroke="#1F4B6E"
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  label={{ value: `Consigne ${consigneTemp}°C`, position: 'insideTopLeft', fill: '#1F4B6E', fontSize: 11 }}
                />

                <Line
                  yAxisId="temp"
                  type="monotone"
                  dataKey="temp"
                  name="Température (°C)"
                  stroke="#1F4B6E"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="humidite"
                  type="monotone"
                  dataKey="humidite"
                  name="Humidité (%)"
                  stroke="#2F6F4E"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-[var(--color-ink)]">Données brutes</h3>
          <span className="text-sm text-[var(--color-ink-soft)]">
            {mesures.length} mesure{mesures.length > 1 ? 's' : ''}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)]">
                <th className="text-left py-2.5 font-medium text-[var(--color-ink-soft)]">Horodatage</th>
                <th className="text-left py-2.5 font-medium text-[var(--color-ink-soft)]">Température</th>
                <th className="text-left py-2.5 font-medium text-[var(--color-ink-soft)]">Humidité</th>
                <th className="text-left py-2.5 font-medium text-[var(--color-ink-soft)]">Chauffage PWM</th>
              </tr>
            </thead>
            <tbody>
              {mesures.slice(-10).reverse().map((m, i) => (
                <tr key={m.timestamp || i} className="border-b border-[var(--color-line)] last:border-0">
                  <td className="py-2.5 data-value text-[var(--color-ink)]">
                    {new Date(m.timestamp).toLocaleString('fr-FR')}
                  </td>
                  <td className="py-2.5 data-value text-[var(--color-ink)]">{m.temperature}°C</td>
                  <td className="py-2.5 data-value text-[var(--color-ink)]">{m.humidite}%</td>
                  <td className="py-2.5 data-value text-[var(--color-ink)]">{m.pwm_chauffage}%</td>
                </tr>
              ))}
              {mesures.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-[var(--color-ink-faint)]">
                    Aucune donnée
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}