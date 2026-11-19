import React from 'react';

export default function Card({ children, className = '', onClick }) {
  return (
    <div
      className={`card ${onClick ? 'cursor-pointer hover:border-[var(--color-line-strong)] transition-colors' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}