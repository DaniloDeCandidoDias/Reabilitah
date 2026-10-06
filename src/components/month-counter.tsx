'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';

export function MonthCounter({
  initialMonth,
  counts,
}: {
  initialMonth: string;
  counts: Record<string, number>;
}) {
  const [month, setMonth] = useState(initialMonth);
  const step = (offset: number) => {
    const [year, index] = month.split('-').map(Number);
    const next = new Date(Date.UTC(year, index - 1 + offset, 1));
    if (next.getUTCFullYear() >= 1900 && next.getUTCFullYear() <= 9999)
      setMonth(next.toISOString().slice(0, 7));
  };
  return (
    <div className="month-counter">
      <span className="month-label">
        <TrendingUp size={16} aria-hidden="true" />
        Documentos no mês
      </span>
      <div className="month-controls">
        <button onClick={() => step(-1)} className="icon-button" aria-label="Mês anterior">
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <label className="sr-only" htmlFor="mes-documentos">
          Mês dos documentos
        </label>
        <input
          id="mes-documentos"
          type="month"
          min="1900-01"
          max="9999-12"
          value={month}
          onChange={(e) => {
            if (/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)) setMonth(e.target.value);
          }}
        />
        <button onClick={() => step(1)} className="icon-button" aria-label="Próximo mês">
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        <strong aria-live="polite" aria-atomic="true">
          {counts[month] ?? 0}
          <span className="sr-only"> documentos neste mês</span>
        </strong>
      </div>
    </div>
  );
}
