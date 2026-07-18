import { Camera, History, UserCircle2 } from 'lucide-react';
import type { CharacterDetail } from '../../types';

export function CharacterSummarySection({
  detail,
  snapshots,
  createSnapshot,
}: {
  detail: CharacterDetail | null;
  snapshots: Array<Record<string, unknown>>;
  createSnapshot: () => void;
}) {
  return (
    <>
      {detail?.diagnosis && (
        <section className="card build-card" data-tab-group="overview">
          <div className="build-section-title">
            <UserCircle2 />
            <div>
              <h2>Current totals</h2>
              <p>Computed live from the saved equipment above.</p>
            </div>
          </div>
          <div className="market-search-meta">
            {Object.entries(detail.diagnosis.resistances.current).map(([key, value]) => (
              <span key={key}>
                <small>{key.toUpperCase()}</small>
                <b>{value}%</b>
              </span>
            ))}
          </div>
          <div className="build-actions">
            <button type="button" className="secondary-button" onClick={createSnapshot}>
              <Camera />
              Save progression snapshot
            </button>
          </div>
          {snapshots.length > 0 && (
            <div className="review-list">
              {snapshots.slice(0, 10).map((snapshot) => (
                <article key={String(snapshot.id)}>
                  <div>
                    <strong>Score {String(snapshot.score)}</strong>
                    <small>
                      {new Date(String(snapshot.createdAt)).toLocaleString()} · patch {String(snapshot.patch)}
                    </small>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {detail && detail.history.length > 0 && (
        <section className="card build-card" data-tab-group="overview">
          <div className="build-section-title">
            <History />
            <div>
              <h2>Analysis history</h2>
              <p>Every analysis run against this character.</p>
            </div>
          </div>
          <div className="review-list">
            {detail.history.map((entry) => (
              <article key={entry.id}>
                <div>
                  <strong>{entry.summary}</strong>
                  <small>{new Date(entry.createdAt).toLocaleString()}</small>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
