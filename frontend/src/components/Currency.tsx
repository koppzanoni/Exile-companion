export function Currency({ kind, value, compact = false }: { kind: 'exalted'|'divine'; value: number; compact?: boolean }) {
  return <span className={`currency ${kind}`}><span className="orb">{kind === 'exalted' ? 'E' : 'D'}</span><strong>{value}</strong>{!compact && <small>{kind === 'exalted' ? 'Exalted' : 'Divine'}</small>}</span>;
}
