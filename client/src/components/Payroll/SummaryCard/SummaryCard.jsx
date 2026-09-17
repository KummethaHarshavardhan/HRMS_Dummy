import React from 'react';
import './SummaryCard.css';

/**
 * SummaryCard — Payroll summary metric card.
 */
export default function SummaryCard({ title, value, exactValue, subtitle, icon, variant = 'primary' }) {
  return (
    <div
      className={`pr-summary-card pr-summary-card-${variant}`}
      title={exactValue || undefined}
    >
      <div className="pr-summary-card-content">
        <span className="pr-summary-card-title">{title}</span>
        <div
          className="pr-summary-card-value"
          title={exactValue || undefined}
        >
          {value}
        </div>
        {subtitle && <span className="pr-summary-card-subtitle">{subtitle}</span>}
      </div>
      {icon && <div className="pr-summary-card-icon">{icon}</div>}
    </div>
  );
}