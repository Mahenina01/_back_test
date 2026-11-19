import React, {
  useEffect,
  useState,
} from 'react';

import {
  AlertTriangle,
  BatteryWarning,
  Calendar,
  CheckCircle,
  Clock,
  Droplets,
  Egg,
  Fan,
  Plug,
  Power,
  RefreshCw,
  Thermometer,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import Card from '../components/Card';
import IncubationManager from '../components/IncubationManager';
import StatCard from '../components/StatCard';
import { useIncubator } from '../context/IncubatorContext';
import { useLiveData } from '../context/LiveDataContext';
import { useApi } from '../hooks/useApi';
import { apiClient } from '../services/apiClient';


const parseDate = (date) => {
  if (!date) return null;
  const dateObjet = new Date(date);
  return Number.isNaN(dateObjet.getTime()) ? null : dateObjet;
};

const formatDateLongue = (date) => {
  const dateObjet = parseDate(date);
  if (!dateObjet) return 'Date non définie';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dateObjet);
};

const calculerJourIncubation = (dateDebut, dateFin) => {
  const debut = parseDate(dateDebut);
  const fin = parseDate(dateFin);
  
  if (!debut || !fin) return { jourActuel: 0, totalJours: 0, progression: 0 };
  
  const maintenant = new Date();
  const diffEnMs = maintenant - debut;
  const diffEnJours = Math.floor(diffEnMs / (1000 * 60 * 60 * 24));
  
  const totalJours = Math.ceil((fin - debut) / (1000 * 60 * 60 * 24));
  const jourActuel = Math.min(diffEnJours + 1, totalJours);
  const progression = Math.min((jourActuel / totalJours) * 100, 100);
  
  return { jourActuel, totalJours, progression };
};


export default function Dashboard() {
  const { dernierMessage } = useLiveData();
  const { execute, loading: apiLoading } = useApi();
  const { selectedIncubatorId, selectedIncubator } = useIncubator();
  const navigate = useNavigate();
  
  const [status, setStatus] = useState(null);
  const [mesures, setMesures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(null);
  const [incubationAcknowledged, setIncubationAcknowledged] = useState(false);
  
  const [isIncubationActive, setIsIncubationActive] = useState(false);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [operationError, setOperationError] = useState('');


  useEffect(() => {
    const fetchData = async () => {
      if (!selectedIncubatorId) {
        setLoading(false);
        return;
      }
      
      try {
        const [statusData, mesuresData] = await Promise.all([
          execute(() => apiClient.getIncubator(selectedIncubatorId)),
          execute(() => apiClient.getIncubatorMesures(selectedIncubatorId, '24h'))
        ]);
        setStatus(statusData);
        setMesures(mesuresData || []);
        
        if (statusData?.date_debut_incubation && statusData?.date_fin_incubation) {
          setIsIncubationActive(true);
          setCurrentProfile(statusData.current_profile || { nom: statusData.espece_active || 'Poule' });
        } else {
          setIsIncubationActive(false);
          setCurrentProfile(null);
        }
      } catch (err) {
        console.error('Erreur chargement données:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedIncubatorId]);


  useEffect(() => {
    if (dernierMessage && dernierMessage.data) {
      setStatus(prev => ({
        ...prev,
        temperature: dernierMessage.data.temperature,
        humidite: dernierMessage.data.humidite,
        pwm_chauffage: dernierMessage.data.pwm_chauffage,
        date_debut_incubation: dernierMessage.data.date_debut_incubation ?? prev?.date_debut_incubation,
        date_fin_incubation: dernierMessage.data.date_fin_incubation ?? prev?.date_fin_incubation,
        alimentation: dernierMessage.data.alimentation ?? prev?.alimentation,
        hors_ligne_depuis: dernierMessage.data.hors_ligne_depuis ?? prev?.hors_ligne_depuis,
        prochain_retournement: dernierMessage.data.prochain_retournement ?? prev?.prochain_retournement,
        espece_active: dernierMessage.data.espece_active ?? prev?.espece_active,
        jour_incubation: dernierMessage.data.jour_incubation ?? prev?.jour_incubation,
      }));
    }
  }, [dernierMessage]);


  const data = status || {};
  const dateFinObjet = parseDate(data.date_fin_incubation);
  const dateDebutIncubation = formatDateLongue(data.date_debut_incubation);
  const dateFinIncubation = formatDateLongue(data.date_fin_incubation);
  const incubationTerminee = Boolean(dateFinObjet && Date.now() >= dateFinObjet.getTime());
  const incubationAckKey = `incubation-finished-${data.date_fin_incubation || 'undefined'}`;

  const { jourActuel, totalJours, progression } = calculerJourIncubation(
    data.date_debut_incubation,
    data.date_fin_incubation
  );

  useEffect(() => {
    if (data.date_debut_incubation && data.date_fin_incubation) {
      setIsIncubationActive(true);
      setCurrentProfile((previous) => data.current_profile || previous || { nom: data.espece_active || 'Poule' });
    }
  }, [data.current_profile, data.date_debut_incubation, data.date_fin_incubation, data.espece_active]);


  const handleStartIncubation = async (profile) => {
    try {
      setLoading(true);
      if (!selectedIncubatorId) throw new Error('Sélectionnez une couveuse avant de démarrer une incubation.');
      const savedProfile = profile.id ? profile : await apiClient.postProfile(profile);
      const cycle = await apiClient.startCycle(selectedIncubatorId, savedProfile.id);

      setStatus((previous) => ({
        ...previous,
        date_debut_incubation: cycle.start_date,
        date_fin_incubation: cycle.end_date,
        espece_active: savedProfile.nom,
        current_profile: savedProfile,
        jour_incubation: 1,
        duree_jours: savedProfile.duree_jours,
      }));
      setCurrentProfile(savedProfile);
      setIsIncubationActive(true);
      setOperationError('');
    } catch (err) {
      setOperationError(err.message || 'Impossible de démarrer l’incubation.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleResetIncubation = async () => {
    try {
      if (!selectedIncubatorId) throw new Error('Aucune couveuse sélectionnée.');
      await apiClient.cancelCycle(selectedIncubatorId);
      setStatus((previous) => ({
        ...previous,
        date_debut_incubation: null,
        date_fin_incubation: null,
        espece_active: null,
        current_profile: null,
        jour_incubation: 0,
        prochain_retournement: null,
      }));
      setIsIncubationActive(false);
      setCurrentProfile(null);
      setOperationError('');
    } catch (err) {
      setOperationError(err.message || 'Impossible d’annuler l’incubation.');
      throw err;
    }
  };

  const handleRenewIncubation = async () => {
    try {
      let profile = currentProfile;
      if (!profile?.id && selectedIncubatorId) {
        const cycle = await apiClient.getCycle(selectedIncubatorId);
        profile = cycle.species_profile;
      }
      if (!profile?.id) throw new Error('Le profil de l’incubation en cours est introuvable.');
      await handleStartIncubation(profile);
    } catch (err) {
      setOperationError(err.message || 'Impossible de renouveler l’incubation.');
      throw err;
    }
  };


  useEffect(() => {
    if (!data.prochain_retournement) {
      setCountdown(null);
      return;
    }

    const target = new Date(data.prochain_retournement).getTime();

    const tick = () => {
      const diff = target - Date.now();

      if (diff <= 0) {
        setCountdown({ text: '00:00:00', label: 'Retournement en cours' });
        return;
      }

      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      const pad = (n) => String(n).padStart(2, '0');

      setCountdown({
        text: `${pad(h)}:${pad(m)}:${pad(s)}`,
        label: `Dans ${h}h ${m}m ${s}s`,
      });
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [data.prochain_retournement]);


  useEffect(() => {
    if (incubationTerminee && typeof window !== 'undefined') {
      setIncubationAcknowledged(sessionStorage.getItem(incubationAckKey) === 'true');
    }
  }, [incubationTerminee, incubationAckKey]);

  const handleIncubationConfirmation = () => {
    setIncubationAcknowledged(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(incubationAckKey, 'true');
    }
    navigate('/synoptique', { state: { playHatching: true } });
  };


  const chartData = mesures.length > 0
    ? mesures.map(m => ({
        time: new Date(m.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        temp: m.temperature,
        humidite: m.humidite
      }))
    : [];


  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-5 h-5 text-[var(--color-ink-soft)] animate-spin" strokeWidth={1.75} />
      </div>
    );
  }

  const actuators = [
    { label: 'Ventilateur brassage', icon: Fan, state: data.etat_ventilateur_brassage },
    { label: 'Ventilateur extraction', icon: Fan, state: data.etat_ventilateur_extraction },
    { label: 'Pompe à eau', icon: Power, state: data.etat_pompe },
  ];

  const surBatterie = data.alimentation === 'batterie';

  return (
    <div className="space-y-6">
      {!selectedIncubatorId && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Aucune couveuse n’est enregistrée.</p>
            <p className="mt-1">
              Ouvre le sélecteur « Sélectionner » en haut de la page, puis « Ajouter une couveuse ».
              Elle sera sélectionnée automatiquement ; tu pourras ensuite démarrer une incubation.
            </p>
          </div>
        </div>
      )}
      {operationError && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{operationError}</span>
        </div>
      )}
      { }
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Tableau de bord</h1>
          <p className="text-[var(--color-ink-soft)] mt-1 text-sm">Supervision en temps réel de l'incubateur</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          { }
          <div className="flex items-center gap-2 px-3 py-1.5 rounded border border-[var(--color-line)] bg-[var(--color-surface)]">
            <Egg className="w-3.5 h-3.5 text-[var(--color-ink-soft)]" strokeWidth={1.75} />
            <span className="text-sm data-value font-medium">
              {isIncubationActive ? `Jour ${jourActuel}/${totalJours}` : 'Non démarrée'}
            </span>
          </div>
          
          { }
          <div className="flex items-center gap-2 px-3 py-1.5 rounded border border-[var(--color-line)] bg-[var(--color-surface)]">
            <Calendar className="w-3.5 h-3.5 text-[var(--color-ink-soft)]" strokeWidth={1.75} />
            <span className="text-sm data-value">
              {isIncubationActive ? `Du ${dateDebutIncubation} au ${dateFinIncubation}` : 'Aucune incubation'}
            </span>
          </div>
          
          { }
          <div className="px-3 py-1.5 rounded border border-[var(--color-line)] bg-[var(--color-accent)]">
            <span className="text-sm font-medium text-[var(--color-bg)]">
              {data.espece_active || 'Aucun profil'}
            </span>
          </div>
          
          { }
          <IncubationManager
            onStart={handleStartIncubation}
            onReset={handleResetIncubation}
            onRenew={handleRenewIncubation}
            currentProfile={currentProfile}
            currentDateDebut={data.date_debut_incubation}
            currentDateFin={data.date_fin_incubation}
            isIncubationActive={isIncubationActive}
          />
        </div>
      </div>

      { }
      {isIncubationActive && (
        <Card>
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-sm font-medium text-[var(--color-ink)]">Progression de l'incubation</span>
              <span className="ml-2 text-sm text-[var(--color-ink-soft)]">({Math.round(progression)}%)</span>
            </div>
            <span className="text-sm text-[var(--color-ink-soft)]">
              {jourActuel} / {totalJours} jours
            </span>
          </div>
          <div className="w-full h-2 bg-[var(--color-line)] rounded-full overflow-hidden">
            <div 
              className="h-full bg-[var(--color-accent)] rounded-full transition-all duration-500"
              style={{ width: `${Math.min(progression, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-[var(--color-ink-faint)]">Début</span>
            <span className="text-xs text-[var(--color-ink-faint)]">Éclosion</span>
          </div>
        </Card>
      )}

      { }
      {!isIncubationActive && (
        <Card>
          <div className="text-center py-6">
            <Egg className="w-12 h-12 text-[var(--color-ink-faint)] mx-auto mb-3" />
            <h3 className="text-lg font-medium text-[var(--color-ink)]">Aucune incubation en cours</h3>
            <p className="text-sm text-[var(--color-ink-soft)] mt-1">
              Cliquez sur "Gérer l'incubation" pour démarrer une nouvelle incubation
            </p>
          </div>
        </Card>
      )}

      { }
      {incubationTerminee && !incubationAcknowledged && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col gap-4 rounded-xl border border-[var(--color-accent)] bg-[var(--color-accent-soft)] px-4 py-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--color-accent)]" strokeWidth={1.75} />
            <div>
              <p className="text-sm font-semibold text-[var(--color-ink)]">Incubation terminée</p>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                Vos œufs sont arrivés au terme prévu de leur incubation, le {dateFinIncubation}.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleIncubationConfirmation}
            className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 sm:w-auto"
          >
            OK — Voir l'éclosion
          </button>
        </div>
      )}

      { }
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Thermometer}
          label="Température"
          value={`${data.temperature?.toFixed(1) || '--'}°C`}
          subValue={`Consigne ${data.consigne_temperature || 37.5}°C`}
          status={data.temperature > 38 ? 'warning' : 'on'}
          statusLabel={data.temperature > 38 ? 'Alerte' : 'Normal'}
        />
        <StatCard
          icon={Droplets}
          label="Humidité"
          value={`${data.humidite?.toFixed(1) || '--'}%`}
          subValue={`Consigne ${data.consigne_humidite_min || 55}–${data.consigne_humidite_max || 60}%`}
          status="on"
          statusLabel="Normal"
        />
        <StatCard
          icon={Zap}
          label="Chauffage"
          value={`${data.pwm_chauffage || 0}%`}
          subValue="PWM"
          status={data.pwm_chauffage > 80 ? 'warning' : 'on'}
          statusLabel={data.pwm_chauffage > 80 ? 'Intense' : 'Stable'}
        />
        <StatCard
          icon={data.niveau_eau === 'ok' ? CheckCircle : AlertTriangle}
          label="Niveau d'eau"
          value={data.niveau_eau === 'ok' ? 'OK' : 'Bas'}
          status={data.niveau_eau === 'ok' ? 'on' : 'danger'}
          statusLabel={data.niveau_eau === 'ok' ? 'Suffisant' : 'Urgent'}
        />
      </div>

      { }
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        { }
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 border border-[var(--color-line)] rounded flex items-center justify-center">
                {surBatterie ? (
                  <BatteryWarning className="w-4 h-4 text-[var(--color-warn)]" strokeWidth={1.75} />
                ) : (
                  <Plug className="w-4 h-4 text-[var(--color-ink-soft)]" strokeWidth={1.75} />
                )}
              </div>
              <div>
                <p className="stat-label">Alimentation</p>
                <p className="text-sm data-value mt-0.5">
                  {surBatterie ? 'Batterie de secours' : 'Secteur'}
                </p>
              </div>
            </div>
            <span className={surBatterie ? 'badge-warning' : 'badge-on'}>
              <span className={`status-dot ${surBatterie ? 'bg-[var(--color-warn)]' : 'bg-[var(--color-ok)]'}`} />
              {surBatterie ? 'Secours' : 'Normal'}
            </span>
          </div>
          {surBatterie && data.hors_ligne_depuis && (
            <p className="text-xs text-[var(--color-ink-faint)] mt-2">
              Coupure secteur depuis {new Date(data.hors_ligne_depuis).toLocaleString('fr-FR')}
            </p>
          )}
        </Card>

        { }
        {actuators.map((a) => (
          <Card key={a.label}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 border border-[var(--color-line)] rounded flex items-center justify-center">
                  <a.icon className="w-4 h-4 text-[var(--color-ink-soft)]" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="stat-label">{a.label}</p>
                  <p className="text-sm data-value mt-0.5">
                    {a.state === 'on' ? 'Actif' : 'Arrêté'}
                  </p>
                </div>
              </div>
              <span className={a.state === 'on' ? 'badge-on' : 'badge-off'}>
                <span className={`status-dot ${a.state === 'on' ? 'bg-[var(--color-ok)]' : 'bg-[var(--color-ink-faint)]'}`} />
                {a.state === 'on' ? 'En marche' : 'Arrêté'}
              </span>
            </div>
          </Card>
        ))}
      </div>

      { }
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-medium text-[var(--color-ink)]">Évolution température / humidité</h3>
            <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">Dernières 24 heures</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm bg-[var(--color-accent)]" />
              <span className="text-xs text-[var(--color-ink-soft)]">Température</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm bg-[var(--color-ok)]" />
              <span className="text-xs text-[var(--color-ink-soft)]">Humidité</span>
            </div>
          </div>
        </div>
        <div className="h-64">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="2 4" stroke="#E2E1DA" />
                <XAxis dataKey="time" stroke="#8B8F89" fontSize={12} tickLine={false} axisLine={{ stroke: '#E2E1DA' }} />
                <YAxis yAxisId="temp" stroke="#8B8F89" fontSize={12} domain={[36, 39]} tickLine={false} axisLine={false} />
                <YAxis yAxisId="humidite" stroke="#8B8F89" fontSize={12} domain={[40, 70]} orientation="right" tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E2E1DA', borderRadius: 4, fontSize: 13 }}
                  labelStyle={{ color: '#5B6058' }}
                />
                <Line
                  yAxisId="temp"
                  type="monotone"
                  dataKey="temp"
                  stroke="#1F4B6E"
                  strokeWidth={2}
                  dot={{ fill: '#1F4B6E', r: 3 }}
                />
                <Line
                  yAxisId="humidite"
                  type="monotone"
                  dataKey="humidite"
                  stroke="#2F6F4E"
                  strokeWidth={2}
                  dot={{ fill: '#2F6F4E', r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-[var(--color-ink-soft)]">
              Aucune donnée disponible
            </div>
          )}
        </div>
      </Card>

      { }
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        { }
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-[var(--color-ink-soft)]" strokeWidth={1.75} />
            <h3 className="font-medium text-[var(--color-ink)]">Prochain retournement</h3>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-value">{countdown?.text || '--:--:--'}</p>
              <p className="text-sm text-[var(--color-ink-soft)] mt-1">
                {countdown?.label || 'Non programmé'}
              </p>
            </div>
            <span className={countdown ? 'badge-on' : 'badge-off'}>
              <span className={`status-dot ${countdown ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-ink-faint)]'}`} />
              {countdown ? 'Programmé' : 'Aucun'}
            </span>
          </div>
        </Card>

        { }
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-[var(--color-ink-soft)]" strokeWidth={1.75} />
            <h3 className="font-medium text-[var(--color-ink)]">Dernières alarmes</h3>
          </div>
          <div className="text-[var(--color-ink-soft)] text-sm">
            {data.alarmes && data.alarmes.length > 0 ? (
              <ul className="space-y-1">
                {data.alarmes.slice(0, 3).map((alarme, index) => (
                  <li key={index} className="flex items-center gap-2 text-red-500">
                    <AlertTriangle className="w-3 h-3" />
                    {alarme.message}
                  </li>
                ))}
              </ul>
            ) : (
              'Aucune alarme active'
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}