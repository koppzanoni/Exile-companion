import { useEffect, useState } from 'react';
import { FlaskConical, History, LoaderCircle, RotateCcw, Check } from 'lucide-react';
import { api } from '../api';
import type { ActionEvaluation, CraftingHistoryEntry, CraftingItemState } from '../types';

export function CraftingSimulator({ itemText, league, characterId }: { itemText: string; league: string; characterId?: number }) {
  const [confirmed, setConfirmed] = useState<CraftingItemState | null>(null);
  const [legal, setLegal] = useState<ActionEvaluation[]>([]);
  const [preview, setPreview] = useState<{ state: CraftingItemState; evaluation: ActionEvaluation; legalActions: ActionEvaluation[] } | null>(null);
  const [value, setValue] = useState<number | ''>('');
  const [history, setHistory] = useState<CraftingHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { api.craftingHistory(characterId).then((r) => setHistory(r?.history || [])).catch(() => {}); }, [characterId]);

  async function inspect() {
    setLoading(true); setError(''); setPreview(null);
    try {
      const response = await api.craftingState({ text: itemText, league, estimatedValue: value === '' ? undefined : value });
      setConfirmed(response.state); setLegal(response.legalActions);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not inspect crafting state'); }
    finally { setLoading(false); }
  }

  async function tryAction(currencyId: string) {
    if (!confirmed) return;
    setLoading(true); setError('');
    try {
      const response = await api.craftingApply({ state: confirmed, currencyId });
      if (!response.evaluation.legal) { setError(response.evaluation.reasons.join(' ')); return; }
      setPreview(response);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not simulate action'); }
    finally { setLoading(false); }
  }

  function discardPreview() { setPreview(null); }

  async function confirmPreview() {
    if (!confirmed || !preview) return;
    setLoading(true); setError('');
    try {
      const valueBefore = confirmed.estimatedValue;
      const valueAfter = value === '' ? undefined : value;
      await api.confirmCraftingAction({ characterId, action: preview.evaluation.label, before: confirmed, after: preview.state, valueBefore, valueAfter });
      const nextState = { ...preview.state, estimatedValue: valueAfter ?? preview.state.estimatedValue };
      setConfirmed(nextState); setLegal(preview.legalActions); setPreview(null);
      const refreshed = await api.craftingHistory(characterId);
      setHistory(refreshed?.history || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not confirm action'); }
    finally { setLoading(false); }
  }

  const shown = preview ? preview.state : confirmed;

  return <article className="card assistant-card crafting-simulator">
    <div className="section-title"><FlaskConical/><div><h2>What If? Crafting Simulator</h2><p>Preview an action before it counts. Nothing is saved until you confirm.</p></div></div>
    {!confirmed && <button type="button" onClick={inspect} disabled={loading || !itemText.trim()}>{loading ? <LoaderCircle className="spin"/> : <FlaskConical/>}Inspect crafting state</button>}
    {error && <div className="error-box">{error}</div>}
    {confirmed && shown && <div className="crafting-simulator-body">
      <p className="crafting-state-summary"><strong>{shown.rarity}</strong> {shown.baseType} · {shown.prefixes.length} prefixes · {shown.suffixes.length} suffixes · {shown.currencySpent.length} currency used{preview && <span className="preview-flag"> · PREVIEW (not saved)</span>}</p>
      <label className="crafting-value-input">Estimated item value (exalted, optional)<input type="number" min="0" value={value} onChange={(e) => setValue(e.target.value === '' ? '' : Number(e.target.value))}/></label>
      {!preview && <div className="crafting-action-grid">{legal.map((action) => <button key={action.currencyId} type="button" disabled={!action.legal || loading} title={action.reasons.join(' ')} onClick={() => tryAction(action.currencyId)}><span>{action.label}</span><small className={`leveling-verdict verdict-${action.risk === 'low' ? 'buy-now' : action.risk === 'high' ? 'not-worth-it' : 'wait'}`}>{action.risk} risk</small>{action.knownChance !== undefined && <small>{Math.round(action.knownChance * 100)}% known chance</small>}</button>)}</div>}
      {preview && <div className="crafting-preview-actions">
        <p>Trying <strong>{preview.evaluation.label}</strong> would change the item as shown above. This has not been saved.</p>
        <div className="action-row"><button type="button" onClick={confirmPreview} disabled={loading}><Check size={16}/>Confirm this action</button><button type="button" className="secondary-button" onClick={discardPreview}><RotateCcw size={16}/>Discard preview</button></div>
      </div>}
    </div>}
    {history.length > 0 && <div className="crafting-history"><h3><History size={16}/>Crafting history</h3><ul>{history.map((entry) => <li key={entry.id}><strong>{entry.action}</strong>{entry.gainLoss !== null && <span className={entry.gainLoss >= 0 ? 'gain' : 'loss'}> {entry.gainLoss >= 0 ? '+' : ''}{entry.gainLoss} exalted</span>}<small> · {new Date(entry.createdAt).toLocaleString()}</small>{entry.nextSafeAction && <p className="hint">Next safe action: {entry.nextSafeAction}</p>}{entry.risks.map((r) => <p key={r} className="warning-text">{r}</p>)}</li>)}</ul></div>}
  </article>;
}
