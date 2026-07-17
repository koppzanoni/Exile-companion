import { Calculator, LoaderCircle, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api';
import type { EquipmentSlotInput, RankedUpgradeCandidate, UpgradeBudgetPlan, UpgradeCandidateInput } from '../types';

const slots = ['Weapon', 'Offhand', 'Helmet', 'Body Armour', 'Gloves', 'Boots', 'Belt', 'Amulet', 'Ring 1', 'Ring 2'];
const blank = (index: number): UpgradeCandidateInput => ({
  id: `candidate-${Date.now()}-${index}`,
  slot: 'Boots',
  itemText: '',
  price: 0,
  currency: 'exalted',
});
export function UpgradeCandidatePlanner({
  equipment,
  buildProfileId,
}: {
  equipment: EquipmentSlotInput[];
  buildProfileId: string;
}) {
  const [candidates, setCandidates] = useState<UpgradeCandidateInput[]>([blank(1), blank(2)]);
  const [budget, setBudget] = useState(50);
  const [ranked, setRanked] = useState<RankedUpgradeCandidate[]>([]);
  const [plan, setPlan] = useState<UpgradeBudgetPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  function update(id: string, patch: Partial<UpgradeCandidateInput>) {
    setCandidates((old) => old.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }
  const valid = candidates.filter((row) => row.itemText.trim() && row.price >= 0);
  async function compare() {
    if (!valid.length) return;
    setLoading(true);
    setError('');
    try {
      const result = await api.compareUpgradeCandidates({
        equipment,
        candidates: valid,
        selectedBuildProfileId: buildProfileId,
      });
      setRanked(result.candidates);
      setPlan(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not compare candidates.');
    } finally {
      setLoading(false);
    }
  }
  async function makePlan() {
    if (!valid.length) return;
    setLoading(true);
    setError('');
    try {
      setPlan(await api.planUpgrades({ equipment, candidates: valid, budget, selectedBuildProfileId: buildProfileId }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the budget plan.');
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="card candidate-planner">
      <header>
        <Calculator />
        <div>
          <span className="eyebrow">PURCHASE DECISION</span>
          <h2>Compare candidates</h2>
          <p>Paste Trade2 candidates, add their prices and compare real profile gain per Exalted.</p>
        </div>
      </header>
      <div className="candidate-inputs">
        {candidates.map((candidate, index) => (
          <article key={candidate.id}>
            <div>
              <strong>Candidate {index + 1}</strong>
              <button
                type="button"
                aria-label={`Remove candidate ${index + 1}`}
                onClick={() => setCandidates((old) => old.filter((row) => row.id !== candidate.id))}
              >
                <Trash2 />
              </button>
            </div>
            <label>
              Slot
              <select value={candidate.slot} onChange={(e) => update(candidate.id, { slot: e.target.value })}>
                {slots.map((slot) => (
                  <option key={slot}>{slot}</option>
                ))}
              </select>
            </label>
            <label>
              Price (Exalted)
              <input
                type="number"
                min="0"
                value={candidate.price}
                onChange={(e) => update(candidate.id, { price: Number(e.target.value) })}
              />
            </label>
            <label className="wide">
              Item
              <textarea
                aria-label={`Candidate ${index + 1} item`}
                rows={4}
                value={candidate.itemText}
                onChange={(e) => update(candidate.id, { itemText: e.target.value })}
                placeholder="Paste copied item text…"
              />
            </label>
          </article>
        ))}
      </div>
      <button
        className="text-button"
        type="button"
        onClick={() => setCandidates((old) => [...old, blank(old.length + 1)])}
      >
        <Plus />
        Add candidate
      </button>
      <div className="candidate-controls">
        <label>
          Total budget
          <input
            aria-label="Upgrade budget"
            type="number"
            min="1"
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
          />
          <span>Exalted</span>
        </label>
        <button type="button" onClick={compare} disabled={loading || !valid.length}>
          {loading ? <LoaderCircle className="spin" /> : <Calculator />}Compare
        </button>
        <button type="button" onClick={makePlan} disabled={loading || !valid.length}>
          Build budget plan
        </button>
      </div>
      {error && <div className="error-box">{error}</div>}
      {ranked.length > 0 && (
        <div className="candidate-ranking">
          {ranked.map((row, index) => (
            <article key={row.id} className={row.verdict.toLowerCase().replace(/ /g, '-')}>
              <strong>
                #{index + 1} · {row.slot}
              </strong>
              <span>{row.verdict}</span>
              <b>
                {row.beforeScore} → {row.afterScore} ({row.scoreDelta >= 0 ? '+' : ''}
                {row.scoreDelta})
              </b>
              <small>
                {row.price} Ex · {row.valuePerExalted} score/Ex
              </small>
              {row.newGaps.map((gap) => (
                <em key={gap}>Risk: {gap}</em>
              ))}
            </article>
          ))}
        </div>
      )}
      {plan && (
        <div className="budget-plan">
          <header>
            <div>
              <small>BUDGET PLAN</small>
              <h3>
                {plan.spent}/{plan.budget} Exalted · score {plan.beforeScore} → {plan.afterScore}
              </h3>
            </div>
            <strong>{plan.remaining} Ex left</strong>
          </header>
          {plan.selected.map((row, index) => (
            <p key={row.id}>
              <b>
                {index + 1}. {row.slot}
              </b>
              <span>
                {row.price} Ex · +{row.scoreDelta} score
              </span>
            </p>
          ))}
          {!plan.selected.length && <p>No safe measured upgrade fits this budget.</p>}
          {plan.warnings.map((warning) => (
            <small key={warning}>{warning}</small>
          ))}
        </div>
      )}
    </section>
  );
}
