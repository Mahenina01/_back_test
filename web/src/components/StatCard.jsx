import React from 'react';
import Card from './Card';

const STATUS_STYLES = {
  on: { dot: 'bg-[var(--color-ok)]', text: 'text-[var(--color-ok)]' },
  warning: { dot: 'bg-[var(--color-warn)]', text: 'text-[var(--color-warn)]' },
  danger: { dot: 'bg-[var(--color-crit)]', text: 'text-[var(--color-crit)]' },
  neutral: { dot: 'bg-[var(--color-ink-faint)]', text: 'text-[var(--color-ink-soft)]' },
};

export default function StatCard({ icon: Icon, label, value, subValue, status = 'neutral', statusLabel }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.neutral;

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="stat-label">{label}</p>
          <p className="stat-value mt-1">{value}</p>
          {subValue && <p className="text-xs text-[var(--color-ink-faint)] mt-1">{subValue}</p>}
        </div>
        {Icon && (
          <div className="w-8 h-8 border border-[var(--color-line)] rounded flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 text-[var(--color-ink-soft)]" strokeWidth={1.75} />
          </div>
        )}
      </div>
      {statusLabel && (
        <div className="status-line mt-3 pt-3 border-t border-[var(--color-line)]">
          <span className={`status-dot ${style.dot}`} />
          <span className={style.text}>{statusLabel}</span>
        </div>
      )}
    </Card>
  );
}