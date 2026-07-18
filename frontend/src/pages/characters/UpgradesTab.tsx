import { Check, Save, Users } from 'lucide-react';
import type { CharacterActionPlan, MarketUpgradeCandidates, ShoppingPlanItem } from '../../types';

export function UpgradesTab({
  actionPlan,
  marketCandidates,
  shopping,
  marketLoading,
  searchCandidates,
  persistPlan,
  updateShopping,
  monitorItem,
  equipPurchase,
}: {
  actionPlan: CharacterActionPlan | null;
  marketCandidates: MarketUpgradeCandidates | null;
  shopping: ShoppingPlanItem[];
  marketLoading: boolean;
  searchCandidates: (slot: string) => void;
  persistPlan: () => void;
  updateShopping: (item: ShoppingPlanItem, status: ShoppingPlanItem['status'], extra?: Record<string, unknown>) => void;
  monitorItem: (item: ShoppingPlanItem) => void;
  equipPurchase: (item: ShoppingPlanItem) => void;
}) {
  return (
    <>
      {actionPlan && (
        <section className="card build-card" data-tab-group="upgrades">
          <div className="build-section-title">
            <Users />
            <div>
              <h2>Prioritized shopping plan</h2>
              <p>
                Budget {actionPlan.budget} Exalted · current build score {actionPlan.score}.
              </p>
            </div>
          </div>
          <div className="review-list">
            {actionPlan.purchases.map((item) => (
              <article key={item.slot}>
                <div>
                  <strong>
                    #{item.rank} {item.slot} · {item.priority}
                  </strong>
                  <small>
                    {item.reason} · suggested allocation {item.suggestedBudget} Exalted
                  </small>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={marketLoading || item.requiresEquippedItem}
                  onClick={() => searchCandidates(item.slot)}
                >
                  {marketLoading ? 'Searching…' : 'Find and simulate'}
                </button>
                {item.tradeUrl && (
                  <a className="secondary-button" href={item.tradeUrl} target="_blank" rel="noreferrer">
                    Open Trade2
                  </a>
                )}
              </article>
            ))}
          </div>
          {shopping.length === 0 && (
            <button type="button" className="primary-button" onClick={persistPlan}>
              <Save />
              Confirm and save this plan
            </button>
          )}
          {actionPlan.blockers.length > 0 && (
            <div className="category-warnings">
              {actionPlan.blockers.slice(0, 6).map((blocker) => (
                <span key={blocker}>{blocker}</span>
              ))}
            </div>
          )}
          <p>
            <small>{actionPlan.warning}</small>
          </p>
        </section>
      )}

      {marketCandidates && (
        <section className="card build-card" data-tab-group="upgrades">
          <div className="build-section-title">
            <Users />
            <div>
              <h2>Simulated live candidates</h2>
              <p>
                {marketCandidates.sampleSize} usable Trade2 comparables · {marketCandidates.dataSource}.
              </p>
            </div>
          </div>
          <div className="review-list">
            {marketCandidates.candidates.map((candidate) => (
              <article key={candidate.id}>
                <div>
                  <strong>
                    {candidate.listing?.name || candidate.slot} · +{candidate.scoreDelta} score
                  </strong>
                  <small>
                    {candidate.price} Exalted · {candidate.verdict} · {candidate.valuePerExalted} score/Ex
                  </small>
                </div>
                {shopping.find((item) => item.slot === candidate.slot && item.status === 'searching') && (
                  <button
                    type="button"
                    onClick={() => {
                      const item = shopping.find((row) => row.slot === candidate.slot && row.status === 'searching');
                      if (item)
                        updateShopping(item, 'candidate', {
                          listingId: candidate.id,
                          itemText: candidate.itemText,
                          price: candidate.price,
                          tradeUrl: candidate.listing?.officialUrl,
                          scoreDelta: candidate.scoreDelta,
                        });
                    }}
                  >
                    Save candidate
                  </button>
                )}
              </article>
            ))}
          </div>
          <p>
            <small>{marketCandidates.warning}</small>
          </p>
        </section>
      )}

      {shopping.length > 0 && (
        <section className="card build-card" data-tab-group="upgrades">
          <div className="build-section-title">
            <Check />
            <div>
              <h2>Saved purchase workflow</h2>
              <p>Every status change is recorded; monitoring runs only when requested.</p>
            </div>
          </div>
          <div className="review-list">
            {shopping.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>
                    {item.slot} · {item.status}
                  </strong>
                  <small>
                    {item.priority} · {item.price !== undefined ? `${item.price} Exalted · ` : ''}
                    {item.scoreDelta !== undefined ? `+${item.scoreDelta} score` : item.reason}
                  </small>
                </div>
                {['searching', 'candidate'].includes(item.status) && (
                  <button type="button" disabled={marketLoading} onClick={() => monitorItem(item)}>
                    Check market
                  </button>
                )}
                {item.status === 'candidate' && (
                  <button type="button" onClick={() => equipPurchase(item)}>
                    Confirm purchase and equip
                  </button>
                )}
                {item.status !== 'bought' && item.status !== 'discarded' && (
                  <button type="button" onClick={() => updateShopping(item, 'discarded')}>
                    Discard
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
