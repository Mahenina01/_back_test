import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Check,
  ChevronDown,
  Egg,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

import { useIncubator } from '../context/IncubatorContext';
import { useApi } from '../hooks/useApi';
import { apiClient } from '../services/apiClient';
import ConfirmDialog from './ConfirmDialog';

export default function IncubatorSelector() {
  const { incubators, selectedIncubatorId, selectIncubator, loadIncubators } =
    useIncubator();
  const { execute } = useApi();
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newIncubatorName, setNewIncubatorName] = useState("");
  const [incubatorToDelete, setIncubatorToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [operationError, setOperationError] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = incubators.find((inc) => inc.id === selectedIncubatorId);

  const handleAddIncubator = async () => {
    if (!newIncubatorName.trim()) return;

    try {
      setOperationError("");
      const created = await execute(() =>
        apiClient.postIncubator({
          nom: newIncubatorName.trim(),
          active: false,
          statut: "inactif",
        }),
      );
      await loadIncubators(created.id);
      setNewIncubatorName("");
      setIsAdding(false);
    } catch (err) {
      console.error("Erreur création couveuse:", err);
      setOperationError(err.message || "Impossible de créer la couveuse.");
    }
  };

  const handleDeleteIncubator = async () => {
    if (!incubatorToDelete) return;

    setDeleting(true);
    try {
      setOperationError("");
      await execute(() => apiClient.deleteIncubator(incubatorToDelete.id));
      await loadIncubators();
      setIncubatorToDelete(null);
    } catch (err) {
      console.error("Erreur suppression couveuse:", err);
      setOperationError(err.message || "Impossible de supprimer la couveuse.");
    } finally {
      setDeleting(false);
    }
  };

  const getStatusColor = (statut) => {
    switch (statut) {
      case "en_cours":
        return "bg-emerald-500";
      case "termine":
        return "bg-blue-500";
      case "inactif":
        return "bg-gray-400";
      default:
        return "bg-gray-400";
    }
  };

  const getStatusLabel = (statut) => {
    switch (statut) {
      case "en_cours":
        return "En cours";
      case "termine":
        return "Terminé";
      case "inactif":
        return "Inactif";
      default:
        return statut || "Inactif";
    }
  };

  return (
    <>
      <div
        className="relative z-30 w-full min-w-0 sm:max-w-md"
        ref={dropdownRef}
      >
        { }
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm shadow-sm transition-all hover:border-[var(--color-accent)] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/25 active:scale-[0.99] sm:min-h-10 sm:px-3 sm:py-2"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent-soft)] sm:h-6 sm:w-6">
              <Egg
                className="h-3.5 w-3.5 text-[var(--color-accent)]"
                strokeWidth={1.75}
              />
            </span>
            {selected ? (
              <>
                <span className="font-medium text-[var(--color-ink)] truncate">
                  {selected.nom}
                </span>
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getStatusColor(selected.statut)}`}
                />
              </>
            ) : (
              <span className="text-[var(--color-ink-soft)]">Sélectionner</span>
            )}
          </div>
          <ChevronDown
            className={`h-4 w-4 flex-shrink-0 text-[var(--color-ink-soft)] transition-transform ${isOpen ? "rotate-180 text-[var(--color-accent)]" : ""}`}
            strokeWidth={1.75}
          />
        </button>

        { }
        {isOpen && (
          <div className="absolute left-0 right-0 top-full mt-2 max-h-[min(22rem,calc(100dvh-9rem))] min-w-0 overflow-y-auto overscroll-contain rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] shadow-xl shadow-slate-900/10 ring-1 ring-black/5 sm:right-auto sm:min-w-[300px]">
            <div className="p-2 sm:p-1.5">
              { }
              {incubators.length === 0 ? (
                <div className="text-center py-3 text-xs text-[var(--color-ink-soft)]">
                  Aucune couveuse
                </div>
              ) : (
                incubators.map((inc) => (
                  <div
                    key={inc.id}
                    className={`flex items-center gap-1 rounded-xl p-0.5 transition-colors ${
                      selectedIncubatorId === inc.id
                        ? "bg-[var(--color-accent-soft)]"
                        : "hover:bg-[var(--color-bg)]"
                    }`}
                  >
                    <button
                      onClick={() => {
                        selectIncubator(inc.id);
                        setIsOpen(false);
                      }}
                      role="option"
                      aria-selected={selectedIncubatorId === inc.id}
                      className={`flex min-h-11 flex-1 items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors sm:min-h-9 sm:px-2.5 sm:py-1.5 ${
                        selectedIncubatorId === inc.id
                          ? "text-[var(--color-accent)]"
                          : "text-[var(--color-ink)]"
                      }`}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--color-bg)] sm:h-6 sm:w-6">
                          <Egg className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </span>
                        <span className="truncate">{inc.nom}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${getStatusColor(inc.statut)}`}
                        />
                        {selectedIncubatorId === inc.id && (
                          <Check
                            className="w-3.5 h-3.5 text-[var(--color-accent)]"
                            strokeWidth={2}
                          />
                        )}
                      </div>
                    </button>

                    {operationError && (
                      <div role="alert" className="mt-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                        {operationError}
                      </div>
                    )}

                    { }
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIncubatorToDelete(inc);
                        setIsOpen(false);
                      }}
                      type="button"
                      className="mr-0.5 min-h-10 min-w-10 rounded-lg p-2 transition-colors hover:bg-[var(--color-crit-soft)] sm:min-h-8 sm:min-w-8 sm:p-1.5"
                      title={`Supprimer ${inc.nom}`}
                    >
                      <Trash2
                        className="w-3.5 h-3.5 text-[var(--color-ink-soft)] hover:text-[var(--color-crit)]"
                        strokeWidth={1.75}
                      />
                    </button>
                  </div>
                ))
              )}

              { }
              <div className="border-t border-[var(--color-line)] mt-1.5 pt-1.5">
                {isAdding ? (
                  <div className="flex items-center gap-1.5 px-1 py-1">
                    <input
                      type="text"
                      value={newIncubatorName}
                      onChange={(e) => setNewIncubatorName(e.target.value)}
                      placeholder="Nom de la couveuse..."
                      className="min-h-10 min-w-0 flex-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20 sm:min-h-8 sm:py-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddIncubator();
                        if (e.key === "Escape") {
                          setIsAdding(false);
                          setNewIncubatorName("");
                        }
                      }}
                    />
                    <button
                      onClick={handleAddIncubator}
                      type="button"
                      className="min-h-10 min-w-10 flex-shrink-0 rounded-lg bg-[var(--color-accent)] p-2 text-white transition-colors hover:bg-[var(--color-accent-dark)] sm:min-h-8 sm:min-w-8 sm:p-1"
                    >
                      <Check className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                    <button
                      onClick={() => {
                        setIsAdding(false);
                        setNewIncubatorName("");
                      }}
                      type="button"
                      className="min-h-10 min-w-10 flex-shrink-0 rounded-lg p-2 transition-colors hover:bg-[var(--color-bg)] sm:min-h-8 sm:min-w-8 sm:p-1"
                    >
                      <X
                        className="w-3.5 h-3.5 text-[var(--color-ink-soft)]"
                        strokeWidth={1.75}
                      />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAdding(true)}
                    type="button"
                    className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-bg)] hover:text-[var(--color-accent)] sm:min-h-9 sm:px-2.5 sm:py-1.5 sm:text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
                    <span>Ajouter une couveuse</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      { }
      <ConfirmDialog
        open={!!incubatorToDelete}
        onClose={() => setIncubatorToDelete(null)}
        onConfirm={handleDeleteIncubator}
        loading={deleting}
        variant="danger"
        title="Supprimer cette couveuse ?"
        message={`Êtes-vous sûr de vouloir supprimer la couveuse « ${incubatorToDelete?.nom} » ? Cette action est irréversible et supprimera toutes les données associées.`}
        confirmLabel="Supprimer"
        loadingLabel="Suppression…"
      />
    </>
  );
}
