export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'brand brand-compact' : 'brand'}>
      <span className="brand-wordmark">
        Reabilitah{compact && <small>Prontuário eletrônico</small>}
      </span>
    </div>
  );
}
