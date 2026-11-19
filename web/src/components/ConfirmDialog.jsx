import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

import {
  AlertTriangle,
  Loader2,
  X,
} from 'lucide-react';

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  loading = false,
  variant = "danger",
  title = "Confirmer cette action",
  message,
  confirmLabel = "Confirmer",
  loadingLabel = "Traitement…",
}) {
  useEffect(() => {
    if (!open) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape" && !loading) onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, loading, onClose]);

  if (!open || typeof document === "undefined") return null;

  const isDanger = variant === "danger";
  const accentClasses = isDanger
    ? "bg-[var(--color-crit)] hover:bg-red-700 focus:ring-red-500/30"
    : "bg-[var(--color-accent)] hover:bg-[var(--color-accent-dark)] focus:ring-[var(--color-accent)]/30";

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex min-h-dvh items-center justify-center overflow-y-auto p-4 sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onClose();
      }}
    >
      <div
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        aria-hidden="true"
      />

      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="relative z-10 my-auto w-full max-w-md overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] shadow-2xl shadow-slate-950/30"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-[var(--color-line)] px-5 py-4 sm:px-6 sm:py-5">
          <div
            className={`mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${isDanger ? "bg-[var(--color-crit-soft)] text-[var(--color-crit)]" : "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"}`}
          >
            <AlertTriangle className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="confirm-dialog-title"
              className="pr-6 text-base font-semibold text-[var(--color-ink)] sm:text-lg"
            >
              {title}
            </h2>
            <p
              id="confirm-dialog-description"
              className="mt-1.5 text-sm leading-6 text-[var(--color-ink-soft)]"
            >
              {message}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Fermer"
            className="absolute right-3 top-3 rounded-lg p-2 text-[var(--color-ink-soft)] transition hover:bg-[var(--color-bg)] hover:text-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>

        <div className="flex flex-col-reverse gap-2 px-5 py-4 sm:flex-row sm:justify-end sm:px-6 sm:py-5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="min-h-11 rounded-xl border border-[var(--color-line)] px-4 py-2.5 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-bg)] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-10 ${accentClasses}`}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? loadingLabel : confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
