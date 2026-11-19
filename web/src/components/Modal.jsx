import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export default function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${SIZES[size] || SIZES.md} bg-[var(--color-surface)] border border-[var(--color-line)] rounded-md shadow-lg max-h-[90vh] flex flex-col`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-line)] flex-shrink-0">
          <h2 className="font-medium text-[var(--color-ink)]">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-[var(--color-bg)] transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4 text-[var(--color-ink-soft)]" strokeWidth={1.75} />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto">
          {children}
        </div>

        {footer && (
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[var(--color-line)] flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}