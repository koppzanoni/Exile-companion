import { History } from 'lucide-react';
import type {
  CharacterAlert,
  CharacterEvolution,
  NetUpgradeCosts,
  PurchaseHistory,
  RecommendationCalibration,
  ReplacementSaleDraft,
} from '../../types';

export type EvolutionFilters = { patch: string; from: string; to: string };

export function EvolutionTab({
  purchaseHistory,
  reversePurchase,
  evolutionFilters,
  setEvolutionFilters,
  evolution,
  filterEvolution,
  evolutionCsvUrl,
  netCosts,
  saleDrafts,
  listSaleDraft,
  alerts,
  markAlertRead,
  calibration,
}: {
  purchaseHistory: PurchaseHistory | null;
  reversePurchase: (id: number) => void;
  evolutionFilters: EvolutionFilters;
  setEvolutionFilters: (filters: EvolutionFilters) => void;
  evolution: CharacterEvolution | null;
  filterEvolution: () => void;
  evolutionCsvUrl: string;
  netCosts: NetUpgradeCosts | null;
  saleDrafts: ReplacementSaleDraft[];
  listSaleDraft: (draft: ReplacementSaleDraft) => void;
  alerts: CharacterAlert[];
  markAlertRead: (alertId: number) => void;
  calibration: RecommendationCalibration | null;
}) {
  return (
    <>
      {purchaseHistory && purchaseHistory.purchases.length > 0 && (
        <section className="card build-card" data-tab-group="evolution">
          <div className="build-section-title">
            <History />
            <div>
              <h2>Build investment</h2>
              <p>Confirmed purchases and their measured impact.</p>
            </div>
          </div>
          <div className="market-search-meta">
            <span>
              <small>Total spent</small>
              <b>{purchaseHistory.totalSpent} Ex</b>
            </span>
            <span>
              <small>Score gained</small>
              <b>+{purchaseHistory.totalScoreGain}</b>
            </span>
            <span>
              <small>Cost per score</small>
              <b>{purchaseHistory.costPerScore ?? 'N/A'} Ex</b>
            </span>
          </div>
          <div className="review-list">
            {purchaseHistory.purchases.map((purchase) => (
              <article key={purchase.id}>
                <div>
                  <strong>
                    {purchase.slot} · {purchase.price} Exalted
                    {purchase.reversedAt ? ' · reversed' : ''}
                  </strong>
                  <small>
                    Score {purchase.scoreBefore} → {purchase.scoreAfter} ·{' '}
                    {new Date(purchase.createdAt).toLocaleString()}
                    {purchase.reversalReason ? ` · ${purchase.reversalReason}` : ''}
                  </small>
                </div>
                {!purchase.reversedAt && (
                  <button type="button" onClick={() => reversePurchase(purchase.id)}>
                    Reverse safely
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="card build-card" data-tab-group="evolution">
        <div className="build-section-title">
          <History />
          <div>
            <h2>Dashboard filters and export</h2>
            <p>Filter snapshots without changing saved history.</p>
          </div>
        </div>
        <div className="build-fields">
          <label>
            Patch
            <select
              value={evolutionFilters.patch}
              onChange={(e) => setEvolutionFilters({ ...evolutionFilters, patch: e.target.value })}
            >
              <option value="">All patches</option>
              {(evolution?.patches || []).map((patch) => (
                <option key={patch}>{patch}</option>
              ))}
            </select>
          </label>
          <label>
            From
            <input
              type="date"
              value={evolutionFilters.from}
              onChange={(e) => setEvolutionFilters({ ...evolutionFilters, from: e.target.value })}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={evolutionFilters.to}
              onChange={(e) => setEvolutionFilters({ ...evolutionFilters, to: e.target.value })}
            />
          </label>
        </div>
        <div className="build-actions">
          <button type="button" onClick={filterEvolution}>
            Apply filters
          </button>
          <a className="secondary-button" href={evolutionCsvUrl}>
            Export CSV
          </a>
        </div>
        {evolution?.bestPurchase && (
          <p>
            <small>
              Best purchase: {String(evolution.bestPurchase.slot)} · {String(evolution.bestPurchase.price)} Ex. Worst
              purchase: {String(evolution.worstPurchase?.slot || 'N/A')}.
            </small>
          </p>
        )}
      </section>

      {evolution && evolution.snapshots.length > 0 && (
        <section className="card build-card" data-tab-group="evolution">
          <div className="build-section-title">
            <History />
            <div>
              <h2>Evolution dashboard</h2>
              <p>Snapshot timeline across patches {evolution.patches.join(', ')}.</p>
            </div>
          </div>
          <div className="review-list">
            {evolution.snapshots.map((snapshot) => (
              <article key={snapshot.id}>
                <div style={{ width: '100%' }}>
                  <strong>
                    {new Date(snapshot.createdAt).toLocaleDateString()} · score {snapshot.score}
                  </strong>
                  <div
                    style={{
                      height: 8,
                      marginTop: 8,
                      background: 'rgba(255,255,255,.08)',
                      borderRadius: 4,
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.max(2, Math.min(100, snapshot.score))}%`,
                        background: 'var(--accent, #c89b3c)',
                        borderRadius: 4,
                      }}
                    />
                  </div>
                  <small>
                    Patch {snapshot.patch} · Spirit {snapshot.spirit} · Resistances{' '}
                    {Object.values(snapshot.resistances).join(' / ') || 'unknown'}
                  </small>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {netCosts && netCosts.rows.length > 0 && (
        <section className="card build-card" data-tab-group="evolution">
          <div className="build-section-title">
            <History />
            <div>
              <h2>Net upgrade cost</h2>
              <p>Only completed sales reduce the acquisition cost.</p>
            </div>
          </div>
          <div className="review-list">
            {netCosts.rows.map((row) => (
              <article key={row.id}>
                <div>
                  <strong>
                    {row.slot} · net {row.netCost} Exalted
                  </strong>
                  <small>
                    Purchase {row.price} Ex · recovered {row.confirmedReturn} Ex · sale {row.saleStatus} ·{' '}
                    {row.costPerScore ?? 'N/A'} Ex/score
                  </small>
                </div>
              </article>
            ))}
          </div>
          <p>
            <small>{netCosts.warning}</small>
          </p>
        </section>
      )}

      {saleDrafts.some((draft) => draft.status === 'needs-price') && (
        <section className="card build-card" data-tab-group="evolution">
          <div className="build-section-title">
            <History />
            <div>
              <h2>Replaced items to sell</h2>
              <p>Set your own price before sending an old item to the sales journal.</p>
            </div>
          </div>
          <div className="review-list">
            {saleDrafts
              .filter((draft) => draft.status === 'needs-price')
              .map((draft) => (
                <article key={draft.id}>
                  <div>
                    <strong>{draft.slot} replacement</strong>
                    <small>Waiting for a confirmed listing price.</small>
                  </div>
                  <button type="button" onClick={() => listSaleDraft(draft)}>
                    Set price and list
                  </button>
                </article>
              ))}
          </div>
        </section>
      )}

      {alerts.length > 0 && (
        <section className="card build-card" data-tab-group="evolution">
          <div className="build-section-title">
            <History />
            <div>
              <h2>Market alerts</h2>
              <p>Informational only; no purchase or price change was executed.</p>
            </div>
          </div>
          <div className="review-list">
            {alerts
              .filter((alert) => !alert.readAt)
              .map((alert) => (
                <article key={alert.id}>
                  <div>
                    <strong>{alert.type}</strong>
                    <small>{alert.message}</small>
                  </div>
                  <button type="button" onClick={() => markAlertRead(alert.id)}>
                    Mark read
                  </button>
                </article>
              ))}
          </div>
        </section>
      )}

      {calibration && (
        <section className="card build-card" data-tab-group="evolution">
          <div className="build-section-title">
            <History />
            <div>
              <h2>Recommendation accuracy</h2>
              <p>
                {calibration.sampleSize} confirmed local samples · average score error {calibration.averageError}.
              </p>
            </div>
          </div>
          <div className="review-list">
            {calibration.bySlot.map((row) => (
              <article key={row.slot}>
                <div>
                  <strong>
                    {row.slot} · {row.confidence} confidence
                  </strong>
                  <small>
                    {row.count} sample(s) · average error {row.averageError}
                  </small>
                </div>
              </article>
            ))}
          </div>
          <p>
            <small>{calibration.limitation}</small>
          </p>
        </section>
      )}
    </>
  );
}
