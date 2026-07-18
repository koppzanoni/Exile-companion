import { Check, Coins, ExternalLink, Save } from 'lucide-react';
import type { CharacterActionPlan } from '../../types';

export type RoadmapEntry = { label: string; plan: CharacterActionPlan };

export function RoadmapsSection({
  roadmaps,
  savedRoadmap,
  roadmapToSave,
  setRoadmapToSave,
  saveRoadmap,
  importLoading,
  text,
}: {
  roadmaps: RoadmapEntry[];
  savedRoadmap: string;
  roadmapToSave: RoadmapEntry | null;
  setRoadmapToSave: (entry: RoadmapEntry | null) => void;
  saveRoadmap: () => void;
  importLoading: boolean;
  text: (english: string, portuguese: string) => string;
}) {
  return (
    <section className="card build-card build-doctor-roadmaps">
      <div className="build-section-title">
        <Coins />
        <div>
          <h2>{text('Upgrade roadmaps', 'Roteiros de upgrades')}</h2>
          <p>
            Three allocations derived from the character's saved budget. Prices are planning limits, not verified
            listing prices.
          </p>
        </div>
      </div>
      {savedRoadmap && (
        <div className="roadmap-saved" role="status">
          <Check /> {savedRoadmap} roadmap saved to the shopping list.
        </div>
      )}
      <div className="roadmap-grid">
        {roadmaps.map((entry) => (
          <article key={entry.label}>
            <div>
              <span>{entry.label}</span>
              <strong>{entry.plan.budget} Exalted</strong>
            </div>
            <ol>
              {entry.plan.purchases.slice(0, 3).map((item) => (
                <li key={item.slot}>
                  <b>
                    #{item.rank} {item.slot}
                  </b>
                  <span>
                    {item.suggestedBudget} Ex · {item.priority}
                  </span>
                  <small>{item.reason}</small>
                  {item.tradeUrl && (
                    <a href={item.tradeUrl} target="_blank" rel="noreferrer">
                      Open Trade2 <ExternalLink />
                    </a>
                  )}
                </li>
              ))}
            </ol>
            {!entry.plan.purchases.length && <p>No upgrade priority is available with the current diagnosis.</p>}
            <button
              className="secondary-button"
              type="button"
              disabled={!entry.plan.purchases.length}
              onClick={() => setRoadmapToSave(entry)}
            >
              <Save />
              {text('Save roadmap', 'Salvar roteiro')}
            </button>
          </article>
        ))}
      </div>
      {roadmapToSave && (
        <div className="roadmap-confirm" role="alertdialog" aria-labelledby="roadmap-confirm-title">
          <div>
            <strong id="roadmap-confirm-title">Save {roadmapToSave.label} roadmap?</strong>
            <span>
              This will add its {roadmapToSave.plan.purchases.length} recommendations to the character shopping list.
            </span>
          </div>
          <div>
            <button type="button" onClick={() => setRoadmapToSave(null)}>
              Cancel
            </button>
            <button className="primary-button" type="button" disabled={importLoading} onClick={saveRoadmap}>
              <Check />
              {text('Confirm save', 'Confirmar salvamento')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
