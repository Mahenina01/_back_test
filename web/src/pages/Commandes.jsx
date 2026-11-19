import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  AlertCircle,
  Calendar,
  Clock,
  Fan,
  Plus,
  Power,
  RefreshCw,
  Trash2,
} from 'lucide-react';

import Card from '../components/Card';
import ConfirmDialog from '../components/ConfirmDialog';
import { useIncubator } from '../context/IncubatorContext';
import { useLiveData } from '../context/LiveDataContext';
import { useMqtt } from '../context/MqttContext';
import { useApi } from '../hooks/useApi';
import { apiClient } from '../services/apiClient';

const OVERRIDE_MS = 4000;
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

export default function Commandes() {
  const { dernierMessage, directEsp32 } = useLiveData();
  const { connected: mqttConnected, deviceStatus, ledState, publishLedState } = useMqtt();
  const { selectedIncubatorId } = useIncubator();
  const { execute } = useApi();

  const [pumpState, setPumpState] = useState(false);
  const [mixingFanState, setMixingFanState] = useState(false);
  const [motorState, setMotorState] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [pending, setPending] = useState({ pump: false, motor: false, mixingFan: false });
  const [commandError, setCommandError] = useState('');

  const [confirmCmd, setConfirmCmd] = useState(null);

  const overrideUntil = useRef({ pump: 0, mixingFan: 0 });

  const [retournements, setRetournements] = useState([]);
  const [newDate, setNewDate] = useState('');
  const [dateError, setDateError] = useState('');

  useEffect(() => {
    const fetchStatus = async () => {
      if (!selectedIncubatorId) return;
      try {
        const data = await execute(() => apiClient.getIncubator(selectedIncubatorId));
        if (data) {
          if (Date.now() > overrideUntil.current.pump) setPumpState(data.etat_pompe === 'on');
        }
      } catch (err) {
        console.error('Erreur chargement statut:', err);
      } finally {
        setStatusLoading(false);
      }
    };
    fetchStatus();
  }, [selectedIncubatorId]);

  useEffect(() => {
    if (!dernierMessage?.data) return;
    const d = dernierMessage.data;
    if (d.etat_pompe !== undefined && Date.now() > overrideUntil.current.pump) {
      setPumpState(d.etat_pompe === 'on');
    }
  }, [dernierMessage]);

  useEffect(() => {
    if (typeof ledState === 'boolean') {
      setMixingFanState(ledState);
    }
  }, [ledState]);

  useEffect(() => {
    let active = true;
    if (USE_MOCKS || !selectedIncubatorId) {
      setRetournements([]);
      return () => { active = false; };
    }

    apiClient.getTurningSchedules(selectedIncubatorId)
      .then((schedules) => {
        if (active) {
          setRetournements(schedules
            .filter((schedule) => schedule.status === 'pending')
            .map((schedule) => ({ id: schedule.id, date: schedule.scheduled_at })));
        }
      })
      .catch((error) => {
        console.error('Erreur chargement des retournements:', error);
        if (active) setDateError(error.message || 'Impossible de charger les retournements.');
      });

    return () => { active = false; };
  }, [selectedIncubatorId]);

  const runCommand = async (id, nextState, setState, apiCall) => {
    setCommandError('');
    setState(nextState);
    if (id === 'pump' || id === 'mixingFan') {
      overrideUntil.current[id] = Date.now() + OVERRIDE_MS;
    }
    setPending(p => ({ ...p, [id]: true }));
    try {
      if (apiCall) await apiCall();
    } catch (err) {
      console.error(`Erreur commande ${id}:`, err);
      if (id === 'mixingFan') {
        setState(!nextState);
        setCommandError(err.message || 'Impossible d’envoyer la commande LED.');
      }
    } finally {
      setPending(p => ({ ...p, [id]: false }));
      if (id === 'motor') setState(false);
    }
  };

  const commands = [
    {
      id: 'pump',
      name: 'Pompe à eau',
      description: 'Activation manuelle de la pompe',
      state: pumpState,
      critical: true,
      setState: setPumpState,
      apiCall: (next) => selectedIncubatorId 
        ? apiClient.postIncubatorPumpCommand(selectedIncubatorId, { state: next ? 'on' : 'off' })
        : Promise.reject('Aucune couveuse sélectionnée'),
      icon: Power,
    },
    {
      id: 'motor',
      name: 'Moteur retournement',
      description: 'Déclenchement manuel du retournement',
      state: motorState,
      critical: true,
      setState: setMotorState,
      apiCall: () => selectedIncubatorId
        ? apiClient.postIncubatorMotorCommand(selectedIncubatorId)
        : Promise.reject('Aucune couveuse sélectionnée'),
      icon: RefreshCw,
    },
    {
      id: 'mixingFan',
      name: 'Ventilation · LED GPIO2',
      description: 'Mode démonstration : cette commande pilote la LED, pas un ventilateur physique.',
      state: mixingFanState,
      critical: false,
      setState: setMixingFanState,
      apiCall: publishLedState,
      icon: Fan,
    },
  ];

  const requestCommand = (cmd) => {
    const nextState = !cmd.state;
    if (cmd.critical) {
      setConfirmCmd({ ...cmd, nextState });
    } else {
      runCommand(cmd.id, nextState, cmd.setState, cmd.apiCall ? () => cmd.apiCall(nextState) : null);
    }
  };

  const handleConfirm = () => {
    if (!confirmCmd) return;
    runCommand(
      confirmCmd.id,
      confirmCmd.nextState,
      confirmCmd.setState,
      confirmCmd.apiCall ? () => confirmCmd.apiCall(confirmCmd.nextState) : null
    );
    setConfirmCmd(null);
  };


  const addRetournement = async () => {
    if (directEsp32) {
      setDateError('La connexion directe à l’ESP32 est en lecture seule.');
      return;
    }
    if (!newDate) {
      setDateError('Veuillez choisir une date et une heure');
      return;
    }
    const dateObj = new Date(newDate);
    if (Number.isNaN(dateObj.getTime())) {
      setDateError('Date invalide');
      return;
    }
    if (dateObj.getTime() <= Date.now()) {
      setDateError('La date doit être dans le futur');
      return;
    }

    try {
      const schedule = USE_MOCKS
        ? { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, scheduled_at: dateObj.toISOString() }
        : await apiClient.postTurningSchedule(selectedIncubatorId, dateObj.toISOString());
      const entry = { id: schedule.id, date: schedule.scheduled_at };
      setRetournements(prev =>
        [...prev, entry].sort((a, b) => new Date(a.date) - new Date(b.date))
      );
      setNewDate('');
      setDateError('');
    } catch (error) {
      console.error('Erreur ajout du retournement:', error);
      setDateError(error.message || 'Impossible d’ajouter ce retournement.');
    }
  };

  const removeRetournement = async (id) => {
    if (directEsp32) return;
    try {
      if (!USE_MOCKS) await apiClient.deleteTurningSchedule(selectedIncubatorId, id);
      setRetournements(prev => prev.filter(r => r.id !== id));
      setDateError('');
    } catch (error) {
      console.error('Erreur suppression du retournement:', error);
      setDateError(error.message || 'Impossible de supprimer ce retournement.');
    }
  };

  const prochaineId = retournements.length > 0 ? retournements[0].id : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Commandes manuelles</h1>
        <p className="text-[var(--color-ink-soft)] mt-1 text-sm">Pilotage direct des actionneurs</p>
      </div>

      {directEsp32 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-[var(--color-ink)]">
          Connexion directe à l’ESP32 en lecture seule : les commandes matérielles ne sont pas encore prises en charge.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {commands.map((cmd) => (
          <Card key={cmd.id}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 border border-[var(--color-line)] rounded flex items-center justify-center">
                <cmd.icon className="w-4 h-4 text-[var(--color-ink-soft)]" strokeWidth={1.75} />
              </div>
              <div>
                <h3 className="font-medium text-[var(--color-ink)]">{cmd.name}</h3>
                <p className="text-sm text-[var(--color-ink-soft)]">{cmd.description}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={() => requestCommand(cmd)}
                disabled={directEsp32 || statusLoading || pending[cmd.id] || !selectedIncubatorId || (cmd.id === 'mixingFan' && (!mqttConnected || deviceStatus !== 'online'))}
                className={`${cmd.state ? 'btn-secondary' : 'btn-primary'} flex-1 py-2 px-4 text-sm disabled:opacity-50`}
              >
                {pending[cmd.id] ? 'Envoi…' : cmd.id === 'motor' ? 'Déclencher' : cmd.state ? 'Désactiver' : 'Activer'}
              </button>
              <span className={cmd.state ? 'badge-on' : 'badge-off'}>
                <span className={`status-dot ${cmd.state ? 'bg-[var(--color-ok)]' : 'bg-[var(--color-ink-faint)]'}`} />
                {cmd.state ? 'Actif' : 'Arrêté'}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {commandError && (
        <p className="text-sm text-[var(--color-crit)]" role="alert">{commandError}</p>
      )}

      <Card>
        <p className="text-sm text-[var(--color-ink-soft)]">
          La commande « Ventilation · LED GPIO2 » envoie <code>ON</code>/<code>OFF</code> au broker MQTT.
          Elle ne met pas en marche un ventilateur réel.
        </p>
        {typeof ledState === 'boolean' && (
          <p className="mt-2 text-sm font-medium text-[var(--color-ink)]">
            État reçu de l’ESP32 : {ledState ? 'LED allumée' : 'LED éteinte'}
          </p>
        )}
      </Card>

      { }
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-[var(--color-ink-soft)]" strokeWidth={1.75} />
          <h3 className="font-medium text-[var(--color-ink)]">Programmation des retournements</h3>
        </div>
        <p className="text-sm text-[var(--color-ink-soft)] mb-4">
          Ajoutez autant de dates de retournement que nécessaire. La plus proche est mise en avant.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center mb-4">
          <input
            type="datetime-local"
            value={newDate}
            disabled={directEsp32 || !selectedIncubatorId}
            onChange={(e) => { setNewDate(e.target.value); setDateError(''); }}
            className="border border-[var(--color-line)] rounded px-3 py-2 text-sm bg-[var(--color-surface)] text-[var(--color-ink)] w-full sm:w-auto"
          />
          <button
            onClick={addRetournement}
            disabled={directEsp32 || !selectedIncubatorId}
            className="btn-primary py-2 px-4 text-sm flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" strokeWidth={1.75} />
            Ajouter
          </button>
        </div>
        {dateError && (
          <p className="text-xs text-[var(--color-danger,#B3261E)] mb-4">{dateError}</p>
        )}

        {retournements.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-soft)]">Aucune date programmée pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {retournements.map((r) => {
              const isNext = r.id === prochaineId;
              return (
                <li
                  key={r.id}
                  className={`flex items-center justify-between border rounded px-3 py-2 ${
                    isNext ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]' : 'border-[var(--color-line)]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Clock className={`w-4 h-4 ${isNext ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-soft)]'}`} strokeWidth={1.75} />
                    <div>
                      <p className="text-sm data-value">
                        {new Date(r.date).toLocaleString('fr-FR', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </p>
                      {isNext && (
                        <span className="text-xs text-[var(--color-accent)] font-medium">Prochain retournement</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => removeRetournement(r.id)}
                    disabled={directEsp32}
                    className="p-1.5 rounded hover:bg-[var(--color-line)] transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4 text-[var(--color-ink-soft)]" strokeWidth={1.75} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle className="w-4 h-4 text-[var(--color-ink-soft)]" strokeWidth={1.75} />
          <h3 className="font-medium text-[var(--color-ink)]">Sécurité</h3>
        </div>
        <p className="text-sm text-[var(--color-ink-soft)]">
          Toute commande manuelle critique (pompe, moteur de retournement) est confirmée avant exécution.
          L'état affiché suit le statut réel de l'installation.
        </p>
      </Card>

      <ConfirmDialog
        open={!!confirmCmd}
        onClose={() => setConfirmCmd(null)}
        onConfirm={handleConfirm}
        variant="danger"
        title={confirmCmd ? `${confirmCmd.id === 'motor' ? 'Déclencher' : confirmCmd.nextState ? 'Activer' : 'Désactiver'} — ${confirmCmd.name}` : ''}
        message={
          confirmCmd
            ? confirmCmd.id === 'motor'
              ? 'Le moteur effectue un retournement et s’arrête automatiquement sur le fin de course. Confirmez-vous ?'
              : `Vous êtes sur le point de ${confirmCmd.nextState ? 'activer' : 'désactiver'} manuellement « ${confirmCmd.name} ». Confirmez-vous cette action ?`
            : ''
        }
        confirmLabel={confirmCmd?.id === 'motor' ? 'Déclencher' : confirmCmd?.nextState ? 'Activer' : 'Désactiver'}
      />
    </div>
  );
}