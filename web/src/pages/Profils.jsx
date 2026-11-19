import React, { useState, useEffect } from 'react';
import Card from '../components/Card';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useApi } from '../hooks/useApi';
import { apiClient } from '../services/apiClient';
import { 
  Plus, 
  Eye, 
  Edit2, 
  Trash2, 
  Check, 
  RefreshCw,
  X,
  Calendar,
  AlertCircle,
  Clock
} from 'lucide-react';

const emptyForm = {
  nom: '',
  duree_jours: '',
  temperature_min: '',
  temperature_max: '',
  humidite_phase1: '',
  humidite_phase2: '',
  jour_arret_retournement: '',
  jours_retournement: [],
};

const genererJoursRetournementParDefaut = (jourArret) => {
  const jours = [];
  for (let i = 2; i <= jourArret; i += 2) {
    jours.push(i);
  }
  return jours;
};

export default function Profils() {
  const { execute } = useApi();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState(null);

  const [viewProfile, setViewProfile] = useState(null);
  const [editProfile, setEditProfile] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [newRetournementDay, setNewRetournementDay] = useState('');

  const [profileToDelete, setProfileToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [operationError, setOperationError] = useState('');

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const data = await execute(apiClient.getProfiles);
      const profilesWithRetournements = (data || []).map(p => ({
        ...p,
        jours_retournement: p.jours_retournement || genererJoursRetournementParDefaut(p.jour_arret_retournement || p.duree_jours)
      }));
      setProfiles(profilesWithRetournements);
      setOperationError('');
    } catch (err) {
      console.error('Erreur:', err);
      setOperationError(err.message || 'Impossible de charger les profils.');
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const openEdit = (profile) => {
    setOperationError('');
    if (profile) {
      setForm({
        ...profile,
        jours_retournement: profile.jours_retournement || genererJoursRetournementParDefaut(profile.jour_arret_retournement)
      });
    } else {
      setForm({ ...emptyForm, jours_retournement: [] });
    }
    setEditProfile(profile || 'new');
    setNewRetournementDay('');
  };

  const closeEdit = () => {
    setEditProfile(null);
    setForm(emptyForm);
    setNewRetournementDay('');
  };

  const addRetournementDay = () => {
    const day = parseInt(newRetournementDay);
    const jourArret = parseInt(form.jour_arret_retournement);
    const duree = parseInt(form.duree_jours);

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

    if (form.jours_retournement.includes(day)) {
      alert(`Le jour ${day} est déjà dans la liste`);
      return;
    }

    setForm(prev => ({
      ...prev,
      jours_retournement: [...prev.jours_retournement, day].sort((a, b) => a - b)
    }));
    setNewRetournementDay('');
  };

  const removeRetournementDay = (day) => {
    setForm(prev => ({
      ...prev,
      jours_retournement: prev.jours_retournement.filter(d => d !== day)
    }));
  };

  const generateAutoRetournements = () => {
    const jourArret = parseInt(form.jour_arret_retournement);
    if (!jourArret || jourArret < 2) {
      alert('Veuillez d\'abord définir le jour d\'arrêt des retournements');
      return;
    }
    const jours = genererJoursRetournementParDefaut(jourArret);
    setForm(prev => ({
      ...prev,
      jours_retournement: jours
    }));
  };

  const validateRetournements = () => {
    const jourArret = parseInt(form.jour_arret_retournement);
    const jours = form.jours_retournement;
    
    if (jours.length === 0) {
      alert('Veuillez définir au moins un jour de retournement');
      return false;
    }

    for (const day of jours) {
      if (day > jourArret) {
        alert(`Le jour ${day} est supérieur au jour d'arrêt des retournements (${jourArret})`);
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateRetournements()) return;
    
    setSaving(true);
    try {
      const profileData = {
        ...form,
        duree_jours: parseInt(form.duree_jours),
        temperature_min: parseFloat(form.temperature_min),
        temperature_max: parseFloat(form.temperature_max),
        jour_arret_retournement: parseInt(form.jour_arret_retournement),
        jours_retournement: form.jours_retournement
      };
      
      if (editProfile === 'new') {
        await execute(() => apiClient.postProfile(profileData));
      } else {
        await execute(() => apiClient.putProfile(editProfile.id, profileData));
      }
      await fetchProfiles();
      closeEdit();
    } catch (err) {
      console.error('Erreur enregistrement profil:', err);
      setOperationError(err.message || 'Impossible d’enregistrer le profil.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!profileToDelete) return;
    setDeleting(true);
    try {
      await execute(() => apiClient.deleteProfile(profileToDelete.id));
      await fetchProfiles();
      if (selectedProfile?.id === profileToDelete.id) setSelectedProfile(null);
      setProfileToDelete(null);
    } catch (err) {
      console.error('Erreur suppression profil:', err);
      setOperationError(err.message || 'Impossible de supprimer le profil.');
    } finally {
      setDeleting(false);
    }
  };

  const formatJoursRetournement = (jours) => {
    if (!jours || jours.length === 0) return 'Aucun';
    if (jours.length <= 5) return jours.join(', ');
    return `${jours.slice(0, 5).join(', ')}… (+${jours.length - 5})`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-5 h-5 text-[var(--color-ink-soft)] animate-spin" strokeWidth={1.75} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {operationError && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{operationError}</span>
        </div>
      )}
      { }
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Profils d'espèces</h1>
          <p className="text-[var(--color-ink-soft)] mt-1 text-sm">
            {profiles.length} profil{profiles.length > 1 ? 's' : ''} disponible{profiles.length > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchProfiles} className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm">
            <RefreshCw className="w-4 h-4" strokeWidth={1.75} />
            <span>Rafraîchir</span>
          </button>
          <button onClick={() => openEdit(null)} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
            <Plus className="w-4 h-4" strokeWidth={1.75} />
            <span>Nouveau profil</span>
          </button>
        </div>
      </div>

      { }
      {profiles.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <p className="text-[var(--color-ink)] mb-1">Aucun profil disponible</p>
            <p className="text-sm text-[var(--color-ink-soft)]">Créez votre premier profil d'espèce</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.map((profile) => (
            <Card
              key={profile.id}
              className={selectedProfile?.id === profile.id ? 'border-[var(--color-accent)]' : ''}
              onClick={() => setSelectedProfile(profile)}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-[var(--color-ink)]">{profile.nom}</h3>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title={`Voir le profil ${profile.nom}`}
                    aria-label={`Voir le profil ${profile.nom}`}
                    className="p-1.5 rounded hover:bg-[var(--color-accent-soft)] transition-colors"
                    onClick={(e) => { e.stopPropagation(); setViewProfile(profile); }}
                  >
                    <Eye className="w-3.5 h-3.5 text-[var(--color-accent)]" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    title={`Modifier le profil ${profile.nom}`}
                    aria-label={`Modifier le profil ${profile.nom}`}
                    className="p-1.5 rounded hover:bg-[var(--color-bg)] transition-colors"
                    onClick={(e) => { e.stopPropagation(); openEdit(profile); }}
                  >
                    <Edit2 className="w-3.5 h-3.5 text-[var(--color-ink-soft)]" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    title={profile.is_system ? 'Un profil système ne peut pas être supprimé' : `Supprimer le profil ${profile.nom}`}
                    aria-label={profile.is_system ? `Suppression impossible pour le profil système ${profile.nom}` : `Supprimer le profil ${profile.nom}`}
                    disabled={profile.is_system}
                    className="p-1.5 rounded hover:bg-[var(--color-crit-soft)] transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={(e) => { e.stopPropagation(); setProfileToDelete(profile); }}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-[var(--color-crit)]" strokeWidth={1.75} />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--color-ink-soft)]">Durée</span>
                  <span className="data-value">{profile.duree_jours} jours</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-ink-soft)]">Température</span>
                  <span className="data-value">{profile.temperature_min} – {profile.temperature_max}°C</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-ink-soft)]">Humidité phase 1</span>
                  <span className="data-value">{profile.humidite_phase1}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-ink-soft)]">Humidité phase 2</span>
                  <span className="data-value">{profile.humidite_phase2}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-ink-soft)]">Arrêt retournement</span>
                  <span className="data-value">Jour {profile.jour_arret_retournement}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-ink-soft)]">Jours retournement</span>
                  <span className="data-value text-xs">
                    {formatJoursRetournement(profile.jours_retournement)}
                  </span>
                </div>
              </div>

              {selectedProfile?.id === profile.id && (
                <div className="mt-4 pt-3 border-t border-[var(--color-line)] flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-[var(--color-accent)]" strokeWidth={1.75} />
                  <span className="text-sm text-[var(--color-accent)]">Profil sélectionné</span>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      { }
      <Card>
        <h3 className="font-medium text-[var(--color-ink)] mb-2">Profil personnalisé</h3>
        <p className="text-sm text-[var(--color-ink-soft)] mb-4">
          Créez votre propre profil d'incubation en définissant tous les paramètres
        </p>
        <button onClick={() => openEdit(null)} className="btn-secondary px-4 py-2 text-sm">
          Créer un profil personnalisé
        </button>
      </Card>

      { }
      <Modal
        open={!!viewProfile}
        onClose={() => setViewProfile(null)}
        title={viewProfile?.nom || 'Profil'}
        footer={
          <>
            <button onClick={() => setViewProfile(null)} className="btn-secondary px-4 py-2 text-sm">Fermer</button>
            <button
              onClick={() => { const p = viewProfile; setViewProfile(null); openEdit(p); }}
              className="btn-primary px-4 py-2 text-sm"
            >
              Modifier
            </button>
          </>
        }
      >
        {viewProfile && (
          <dl className="space-y-3 text-sm">
            {[
              ['Durée', `${viewProfile.duree_jours} jours`],
              ['Température', `${viewProfile.temperature_min} – ${viewProfile.temperature_max}°C`],
              ['Humidité phase 1', viewProfile.humidite_phase1],
              ['Humidité phase 2', viewProfile.humidite_phase2],
              ['Arrêt retournement', `Jour ${viewProfile.jour_arret_retournement}`],
              ['Jours de retournement', viewProfile.jours_retournement?.length > 0 
                ? viewProfile.jours_retournement.join(', ') 
                : 'Aucun'
              ],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between border-b border-[var(--color-line)] pb-2 last:border-0">
                <dt className="text-[var(--color-ink-soft)]">{label}</dt>
                <dd className="data-value text-[var(--color-ink)]">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </Modal>

      { }
      <Modal
        open={!!editProfile}
        onClose={closeEdit}
        title={editProfile === 'new' ? 'Nouveau profil' : `Modifier — ${form.nom || ''}`}
        footer={
          <>
            <button onClick={closeEdit} disabled={saving} className="btn-secondary px-4 py-2 text-sm disabled:opacity-50">
              Annuler
            </button>
            <button onClick={handleSave} disabled={saving || !form.nom} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          { }
          <div>
            <label className="block text-sm text-[var(--color-ink-soft)] mb-1.5">Nom de l'espèce</label>
            <input
              type="text"
              value={form.nom}
              onChange={(e) => setForm(f => ({ ...f, nom: e.target.value }))}
              className="input-field w-full px-3 py-2 text-sm text-[var(--color-ink)]"
              placeholder="Poule, Canard…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-[var(--color-ink-soft)] mb-1.5">Durée (jours)</label>
              <input
                type="number"
                value={form.duree_jours}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setForm(f => ({ 
                    ...f, 
                    duree_jours: e.target.value,
                    jour_arret_retournement: f.jour_arret_retournement || Math.floor(val * 0.85)
                  }));
                }}
                className="input-field w-full px-3 py-2 text-sm text-[var(--color-ink)]"
                min="1"
                max="60"
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--color-ink-soft)] mb-1.5">Arrêt retournement (jour)</label>
              <input
                type="number"
                value={form.jour_arret_retournement}
                onChange={(e) => setForm(f => ({ ...f, jour_arret_retournement: e.target.value }))}
                className="input-field w-full px-3 py-2 text-sm text-[var(--color-ink)]"
                min="1"
                max={parseInt(form.duree_jours) || 30}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-[var(--color-ink-soft)] mb-1.5">Température min (°C)</label>
              <input
                type="number"
                step="0.1"
                value={form.temperature_min}
                onChange={(e) => setForm(f => ({ ...f, temperature_min: e.target.value }))}
                className="input-field w-full px-3 py-2 text-sm text-[var(--color-ink)]"
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--color-ink-soft)] mb-1.5">Température max (°C)</label>
              <input
                type="number"
                step="0.1"
                value={form.temperature_max}
                onChange={(e) => setForm(f => ({ ...f, temperature_max: e.target.value }))}
                className="input-field w-full px-3 py-2 text-sm text-[var(--color-ink)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-[var(--color-ink-soft)] mb-1.5">Humidité phase 1</label>
              <input
                type="text"
                value={form.humidite_phase1}
                onChange={(e) => setForm(f => ({ ...f, humidite_phase1: e.target.value }))}
                className="input-field w-full px-3 py-2 text-sm text-[var(--color-ink)]"
                placeholder="55-60%"
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--color-ink-soft)] mb-1.5">Humidité phase 2</label>
              <input
                type="text"
                value={form.humidite_phase2}
                onChange={(e) => setForm(f => ({ ...f, humidite_phase2: e.target.value }))}
                className="input-field w-full px-3 py-2 text-sm text-[var(--color-ink)]"
                placeholder="65-75%"
              />
            </div>
          </div>

          { }
          <div className="border-t border-[var(--color-line)] pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-medium text-[var(--color-ink)]">Jours de retournement</h4>
                <p className="text-xs text-[var(--color-ink-soft)]">
                  {form.jours_retournement.length} jour{form.jours_retournement.length > 1 ? 's' : ''} programmé{form.jours_retournement.length > 1 ? 's' : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={generateAutoRetournements}
                className="text-xs text-[var(--color-accent)] hover:underline"
              >
                Générer automatiquement
              </button>
            </div>

            { }
            <div className="flex gap-2 mb-3">
              <input
                type="number"
                value={newRetournementDay}
                onChange={(e) => setNewRetournementDay(e.target.value)}
                placeholder="Jour (ex: 4)"
                className="input-field flex-1 px-3 py-2 text-sm text-[var(--color-ink)]"
                min="1"
                max={parseInt(form.jour_arret_retournement) || 30}
              />
              <button
                type="button"
                onClick={addRetournementDay}
                className="btn-primary px-4 py-2 text-sm"
              >
                Ajouter
              </button>
            </div>

            { }
            {form.jours_retournement.length > 0 ? (
              <div className="flex flex-wrap gap-2 p-3 bg-[var(--color-bg)] rounded-lg border border-[var(--color-line)]">
                {form.jours_retournement.map((day) => (
                  <span
                    key={day}
                    className="flex items-center gap-1 px-3 py-1 bg-[var(--color-surface)] border border-[var(--color-line)] rounded-full text-sm"
                  >
                    <Calendar className="w-3 h-3 text-[var(--color-ink-soft)]" />
                    <span className="text-[var(--color-ink)]">Jour {day}</span>
                    <button
                      type="button"
                      onClick={() => removeRetournementDay(day)}
                      className="ml-1 p-0.5 rounded-full hover:bg-[var(--color-crit-soft)] transition-colors"
                    >
                      <X className="w-3 h-3 text-[var(--color-crit)]" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-[var(--color-ink-soft)] text-sm border border-dashed border-[var(--color-line)] rounded-lg">
                <AlertCircle className="w-4 h-4 mx-auto mb-1" />
                <p>Aucun jour de retournement défini</p>
                <p className="text-xs">Ajoutez des jours ou générez-les automatiquement</p>
              </div>
            )}

            { }
            {form.jour_arret_retournement && (
              <div className="mt-2 text-xs text-[var(--color-ink-soft)] flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Les retournements sont autorisés jusqu'au jour {form.jour_arret_retournement}</span>
              </div>
            )}
          </div>
        </div>
      </Modal>

      { }
      <ConfirmDialog
        open={!!profileToDelete}
        onClose={() => setProfileToDelete(null)}
        onConfirm={handleDelete}
        loading={deleting}
        variant="danger"
        title="Supprimer ce profil ?"
        message={`Le profil « ${profileToDelete?.nom} » sera définitivement supprimé. Cette action est irréversible.`}
        confirmLabel="Supprimer"
        loadingLabel="Suppression…"
      />
    </div>
  );
}