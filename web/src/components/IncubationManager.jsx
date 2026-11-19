import React, { useState, useEffect } from 'react';
import { 
  Play, 
  RefreshCw, 
  RotateCcw, 
  X, 
  Check, 
  Egg,
  AlertCircle,
  Calendar,
  Plus
} from 'lucide-react';
import Card from './Card';
import ConfirmDialog from './ConfirmDialog';
import { useApi } from '../hooks/useApi';
import { apiClient } from '../services/apiClient';

const genererJoursRetournementParDefaut = (jourArret) => {
  const jours = [];
  for (let i = 2; i <= jourArret; i += 2) {
    jours.push(i);
  }
  return jours;
};

export default function IncubationManager({ 
  onStart, 
  onReset, 
  onRenew,
  currentProfile,
  currentDateDebut,
  currentDateFin,
  isIncubationActive 
}) {
  const { execute } = useApi();
  const [isOpen, setIsOpen] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [mode, setMode] = useState('select');
  const [newRetournementDay, setNewRetournementDay] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    confirmLabel: 'Confirmer',
    variant: 'warning',
    onConfirm: null
  });
  
  const [customProfile, setCustomProfile] = useState({
    nom: 'Personnalisé',
    duree_jours: 21,
    temperature_min: 37.5,
    temperature_max: 37.8,
    humidite_phase1: '55-60%',
    humidite_phase2: '65-75%',
    jour_arret_retournement: 18,
    jours_retournement: [2, 4, 6, 8, 10, 12, 14, 16, 18]
  });

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const data = await execute(apiClient.getProfiles);
        setProfiles(data || []);
        if (data && data.length > 0) {
          setSelectedProfile(data[0]);
        }
      } catch (err) {
        console.error('Erreur chargement profils:', err);
        setActionError(err.message || 'Impossible de charger les profils.');
      }
    };
    fetchProfiles();
  }, []);

  const addRetournementDay = () => {
    const day = parseInt(newRetournementDay);
    const jourArret = customProfile.jour_arret_retournement;

    if (!day || isNaN(day)) {
      alert('Veuillez entrer un jour valide');
      return;
    }

    if (day < 1) {
      alert('Le jour doit être supérieur ou égal à 1');
      return;
    }

    if (day > jourArret) {
      alert(`Le jour ${day} est supérieur au jour d'arrêt des retournements (${jourArret})`);
      return;
    }

    if (customProfile.jours_retournement.includes(day)) {
      alert(`Le jour ${day} est déjà dans la liste`);
      return;
    }

    setCustomProfile(prev => ({
      ...prev,
      jours_retournement: [...prev.jours_retournement, day].sort((a, b) => a - b)
    }));
    setNewRetournementDay('');
  };

  const removeRetournementDay = (day) => {
    setCustomProfile(prev => ({
      ...prev,
      jours_retournement: prev.jours_retournement.filter(d => d !== day)
    }));
  };

  const generateAutoRetournements = () => {
    const jourArret = customProfile.jour_arret_retournement;
    if (!jourArret || jourArret < 2) {
      alert('Veuillez définir le jour d\'arrêt des retournements');
      return;
    }
    const jours = genererJoursRetournementParDefaut(jourArret);
    setCustomProfile(prev => ({
      ...prev,
      jours_retournement: jours
    }));
  };

  const handleJourArretChange = (value) => {
    const jourArret = parseInt(value) || 0;
    setCustomProfile(prev => {
      const joursFiltres = prev.jours_retournement.filter(j => j <= jourArret);
      return {
        ...prev,
        jour_arret_retournement: jourArret,
        jours_retournement: joursFiltres
      };
    });
  };

  const handleStartIncubation = async () => {
    if (!selectedProfile && mode === 'select') return;
    
    const profile = mode === 'select' ? selectedProfile : customProfile;
    if (!profile) return;

    if (mode === 'customize' && (!profile.jours_retournement || profile.jours_retournement.length === 0)) {
      alert('Veuillez définir au moins un jour de retournement');
      return;
    }

    setActionLoading(true);
    setActionError('');
    try {
      await onStart(profile);
      setIsOpen(false);
    } catch (err) {
      setActionError(err.message || 'Impossible de démarrer l’incubation.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReset = () => {
    setConfirmDialog({
      open: true,
      title: 'Annuler l’incubation en cours ?',
      message: 'Le cycle sera marqué comme annulé et restera visible dans l’historique.',
      confirmLabel: 'Annuler le cycle',
      variant: 'danger',
      onConfirm: onReset,
    });
  };

  const handleRenew = () => {
    setConfirmDialog({
      open: true,
      title: 'Renouveler l\'incubation ?',
      message: `Voulez-vous renouveler l'incubation avec les mêmes paramètres ?\n\n• Profil : ${currentProfile?.nom || 'Non défini'}\n• Durée : ${currentProfile?.duree_jours || '?'} jours\n• Début : ${currentDateDebut ? new Date(currentDateDebut).toLocaleDateString('fr-FR') : 'Non défini'}\n• Fin : ${currentDateFin ? new Date(currentDateFin).toLocaleDateString('fr-FR') : 'Non défini'}`,
      confirmLabel: 'Renouveler',
      variant: 'warning',
      onConfirm: onRenew,
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmDialog.onConfirm) return;
    setConfirmLoading(true);
    setActionError('');
    try {
      await confirmDialog.onConfirm();
      setIsOpen(false);
      setConfirmDialog(prev => ({ ...prev, open: false }));
    } catch (err) {
      setActionError(err.message || 'Impossible de terminer cette action.');
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleCloseConfirm = () => {
    setConfirmDialog(prev => ({ ...prev, open: false }));
  };

  return (
    <>
      <button
        onClick={() => { setActionError(''); setIsOpen(true); }}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white shadow-sm transition-all"
      >
        <Play className="w-4 h-4" />
        <span>Gérer l'incubation</span>
      </button>

      { }
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl border border-slate-100">
            
            { }
            <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-slate-100 bg-white rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 rounded-xl text-[var(--color-accent)]">
                  <Egg className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-slate-800">Gestion de l'incubation</h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            { }
            <div className="p-6 space-y-6">
              {actionError && (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}
              
              { }
              {isIncubationActive && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="font-semibold text-emerald-800 text-sm">Incubation en cours</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-emerald-700">
                    <p><span className="font-medium">Profil :</span> {currentProfile?.nom || 'Non défini'}</p>
                    <p><span className="font-medium">Début :</span> {currentDateDebut ? new Date(currentDateDebut).toLocaleDateString('fr-FR') : 'Non défini'}</p>
                    <p><span className="font-medium">Fin :</span> {currentDateFin ? new Date(currentDateFin).toLocaleDateString('fr-FR') : 'Non défini'}</p>
                  </div>
                </div>
              )}

              { }
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Actions rapides</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={handleRenew}
                    disabled={!isIncubationActive || actionLoading || confirmLoading}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100/60 font-medium text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Renouveler</span>
                  </button>
                  <button
                    onClick={handleReset}
                    disabled={!isIncubationActive || actionLoading || confirmLoading}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100/60 font-medium text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Annuler</span>
                  </button>
                  <button
                    onClick={() => {
                      setMode('select');
                      setIsOpen(false);
                      setTimeout(() => setIsOpen(true), 100);
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100/60 font-medium text-xs transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    <span>Nouvelle</span>
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-800 text-sm">Démarrer une nouvelle incubation</h3>
                  
                  { }
                  <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => setMode('select')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        mode === 'select'
                          ? 'bg-white text-slate-800 shadow-xs'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Profils
                    </button>
                    <button
                      onClick={() => setMode('customize')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        mode === 'customize'
                          ? 'bg-white text-slate-800 shadow-xs'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Personnaliser
                    </button>
                  </div>
                </div>

                { }
                {mode === 'select' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {profiles.map((profile) => (
                      <div
                        key={profile.id}
                        onClick={() => setSelectedProfile(profile)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          selectedProfile?.id === profile.id
                            ? 'border-[var(--color-accent)] bg-amber-50/40 shadow-xs'
                            : 'border-slate-100 bg-slate-50/50 hover:border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-bold text-slate-800 text-sm">{profile.nom}</h4>
                          {selectedProfile?.id === profile.id && (
                            <div className="w-5 h-5 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white">
                              <Check className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                        <div className="space-y-1 text-xs text-slate-500">
                          <p>Durée : <span className="text-slate-700 font-medium">{profile.duree_jours} jours</span></p>
                          <p>Température : <span className="text-slate-700 font-medium">{profile.temperature_min}–{profile.temperature_max}°C</span></p>
                          <p>Humidité : <span className="text-slate-700 font-medium">{profile.humidite_phase1}</span></p>
                          <p>Retournements : <span className="text-slate-700 font-medium">
                            {profile.jours_retournement?.length || 0} jour{profile.jours_retournement?.length > 1 ? 's' : ''}
                          </span></p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                    { }
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Nom du profil
                        </label>
                        <input
                          type="text"
                          value={customProfile.nom}
                          onChange={(e) => setCustomProfile({ ...customProfile, nom: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20 focus:border-[var(--color-accent)]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Durée (jours)
                        </label>
                        <input
                          type="number"
                          value={customProfile.duree_jours}
                          onChange={(e) => setCustomProfile({ ...customProfile, duree_jours: parseInt(e.target.value) || 21 })}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20 focus:border-[var(--color-accent)]"
                          min="1"
                          max="60"
                        />
                      </div>
                    </div>

                    { }
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Température min (°C)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={customProfile.temperature_min}
                          onChange={(e) => setCustomProfile({ ...customProfile, temperature_min: parseFloat(e.target.value) || 37.5 })}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20 focus:border-[var(--color-accent)]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Température max (°C)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={customProfile.temperature_max}
                          onChange={(e) => setCustomProfile({ ...customProfile, temperature_max: parseFloat(e.target.value) || 37.8 })}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20 focus:border-[var(--color-accent)]"
                        />
                      </div>
                    </div>

                    { }
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Humidité phase 1
                        </label>
                        <input
                          type="text"
                          value={customProfile.humidite_phase1}
                          onChange={(e) => setCustomProfile({ ...customProfile, humidite_phase1: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20 focus:border-[var(--color-accent)]"
                          placeholder="55-60%"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Humidité phase 2
                        </label>
                        <input
                          type="text"
                          value={customProfile.humidite_phase2}
                          onChange={(e) => setCustomProfile({ ...customProfile, humidite_phase2: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20 focus:border-[var(--color-accent)]"
                          placeholder="65-75%"
                        />
                      </div>
                    </div>

                    { }
                    <div className="border-t border-slate-200 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="text-sm font-medium text-slate-700">Jours de retournement</h4>
                          <p className="text-xs text-slate-400">
                            {customProfile.jours_retournement.length} jour{customProfile.jours_retournement.length > 1 ? 's' : ''} programmé{customProfile.jours_retournement.length > 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={generateAutoRetournements}
                            className="text-xs text-[var(--color-accent)] hover:underline"
                          >
                            Générer auto
                          </button>
                        </div>
                      </div>

                      { }
                      <div className="mb-3">
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Jour d'arrêt des retournements
                        </label>
                        <input
                          type="number"
                          value={customProfile.jour_arret_retournement}
                          onChange={(e) => handleJourArretChange(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20 focus:border-[var(--color-accent)]"
                          min="1"
                          max={customProfile.duree_jours - 1}
                        />
                      </div>

                      { }
                      <div className="flex gap-2 mb-3">
                        <input
                          type="number"
                          value={newRetournementDay}
                          onChange={(e) => setNewRetournementDay(e.target.value)}
                          placeholder="Jour (ex: 4)"
                          className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20 focus:border-[var(--color-accent)]"
                          min="1"
                          max={customProfile.jour_arret_retournement}
                        />
                        <button
                          type="button"
                          onClick={addRetournementDay}
                          className="px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white text-xs font-medium hover:bg-[var(--color-accent-dark)] transition-colors flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          Ajouter
                        </button>
                      </div>

                      { }
                      {customProfile.jours_retournement.length > 0 ? (
                        <div className="flex flex-wrap gap-2 p-3 bg-white rounded-xl border border-slate-200">
                          {customProfile.jours_retournement.map((day) => (
                            <span
                              key={day}
                              className="flex items-center gap-1 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs"
                            >
                              <Calendar className="w-3 h-3 text-amber-600" />
                              <span className="text-slate-700">Jour {day}</span>
                              <button
                                type="button"
                                onClick={() => removeRetournementDay(day)}
                                className="ml-1 p-0.5 rounded-full hover:bg-amber-200 transition-colors"
                              >
                                <X className="w-3 h-3 text-amber-600" />
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                          <AlertCircle className="w-4 h-4 mx-auto mb-1" />
                          <p>Aucun jour de retournement défini</p>
                          <p className="text-[10px]">Ajoutez des jours ou générez-les automatiquement</p>
                        </div>
                      )}

                      { }
                      {customProfile.jour_arret_retournement && (
                        <div className="mt-2 text-xs text-slate-400 flex items-center gap-1">
                          <span>🔹 Les retournements sont autorisés jusqu'au jour {customProfile.jour_arret_retournement}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleStartIncubation}
                  disabled={actionLoading || (!selectedProfile && mode === 'select')}
                  className="w-full mt-5 py-3 rounded-xl bg-[var(--color-accent)] text-white font-bold text-sm shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  <span>{actionLoading ? 'Démarrage…' : 'Démarrer l’incubation'}</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      { }
      <ConfirmDialog
        open={confirmDialog.open}
        onClose={handleCloseConfirm}
        onConfirm={handleConfirmAction}
        loading={confirmLoading}
        variant={confirmDialog.variant}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        loadingLabel="Traitement…"
      />
    </>
  );
}