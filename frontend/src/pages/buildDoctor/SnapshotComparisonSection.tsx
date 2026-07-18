import { History } from 'lucide-react';
import type { BuildDoctorResult } from '../../types';

function snapshotDiagnosis(row: Record<string, unknown>): BuildDoctorResult | null {
  try {
    return typeof row.diagnosisJson === 'string' ? (JSON.parse(row.diagnosisJson) as BuildDoctorResult) : null;
  } catch {
    return null;
  }
}

export function SnapshotComparisonSection({
  snapshots,
  text,
}: {
  snapshots: Array<Record<string, unknown>>;
  text: (english: string, portuguese: string) => string;
}) {
  if (snapshots.length < 2) return null;
  const current = snapshotDiagnosis(snapshots[0]),
    previous = snapshotDiagnosis(snapshots[1]);
  if (!current || !previous) return null;
  const delta = current.profile.overallScore - previous.profile.overallScore;
  return (
    <section className="card build-card build-doctor-snapshot-compare">
      <div className="build-section-title">
        <History />
        <div>
          <h2>{text('Latest snapshot comparison', 'Comparação dos snapshots mais recentes')}</h2>
          <p>Immutable saved states from before confirmed equipment changes.</p>
        </div>
      </div>
      <div className="snapshot-score-change">
        <span>
          <small>PREVIOUS</small>
          <strong>{previous.profile.overallScore}</strong>
        </span>
        <b className={delta >= 0 ? 'positive' : 'negative'}>
          {delta >= 0 ? '+' : ''}
          {delta}
        </b>
        <span>
          <small>LATEST</small>
          <strong>{current.profile.overallScore}</strong>
        </span>
      </div>
      <div className="snapshot-stat-grid">
        {Object.keys(current.resistances.current).map((key) => {
          const before = previous.resistances.current[key] || 0,
            after = current.resistances.current[key] || 0,
            diff = after - before;
          return (
            <span key={key}>
              <small>{key.replace('Resistance', ' RES')}</small>
              <b>
                {before}% → {after}%
              </b>
              <em className={diff >= 0 ? 'positive' : 'negative'}>
                {diff >= 0 ? '+' : ''}
                {diff}
              </em>
            </span>
          );
        })}
      </div>
    </section>
  );
}
