import { Archive, ExternalLink, LoaderCircle, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { Currency } from '../components/Currency';
import type { SavedCheck } from '../types';

export function SavedPage() {
  const [checks, setChecks] = useState<SavedCheck[] | null>(null);
  const [query, setQuery] = useState('');
  const load = () =>
    api
      .checks()
      .then(setChecks)
      .catch(() => setChecks([]));
  useEffect(() => {
    void load();
  }, []);
  async function remove(id: number) {
    await api.deleteCheck(id);
    setChecks((old) => old?.filter((c) => c.id !== id) || []);
  }
  const visible = (checks || []).filter((c) =>
    `${c.item?.name} ${c.item?.baseType}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="page standard-page">
      <header className="page-header">
        <span className="eyebrow">YOUR MARKET JOURNAL</span>
        <h1>Saved checks</h1>
        <p>Every analysis is stored locally in SQLite so you can revisit the evidence.</p>
      </header>
      <div className="search-field">
        <Search />
        <input
          aria-label="Search saved checks"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search items…"
        />
      </div>
      {!checks ? (
        <div className="loading">
          <LoaderCircle className="spin" />
          Loading your journal…
        </div>
      ) : !visible.length ? (
        <div className="empty-state">
          <Archive />
          <h2>No saved checks found</h2>
          <p>Analyze an item and it will appear here automatically.</p>
        </div>
      ) : (
        <div className="saved-grid">
          {visible.map((check) => (
            <article className="card saved-card" key={check.id}>
              <div className={`source-dot ${check.dataSource}`} />
              <div>
                <span>
                  {check.item?.rarity || 'unknown'} · {check.league}
                </span>
                <h2>{check.item?.name || check.item?.baseType || check.item?.itemType}</h2>
                <small>
                  {check.evaluation
                    ? `${check.evaluation.label} · ${check.evaluation.score}/100`
                    : new Date(check.createdAt).toLocaleString()}
                </small>
                {check.recommendation && (
                  <span
                    className={`saved-recommendation action-${String(check.recommendation.action)
                      .toLowerCase()
                      .replace(/[^a-z]+/g, '-')}`}
                  >
                    Recommendation: {check.recommendation.action} · {check.recommendation.confidence}
                  </span>
                )}
              </div>
              {check.result?.fair != null ? (
                <div className="saved-price">
                  <Currency kind="exalted" value={check.result.fair} />
                  <span>fair price</span>
                </div>
              ) : (
                <span className="no-estimate">Quality only</span>
              )}
              <div className="saved-actions">
                <a href={check.officialUrl} target="_blank" rel="noreferrer" title="Open official trade">
                  <ExternalLink />
                </a>
                <button onClick={() => remove(check.id)} title="Delete">
                  <Trash2 />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
