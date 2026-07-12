import { ChevronDown, ExternalLink, LoaderCircle, Search, ShoppingBag, Sparkles, TrendingUp } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api';
import type { LevelingSearchResult } from '../types';

export function LevelingPage() {
  const [guideUrl, setGuideUrl] = useState('');
  const [level, setLevel] = useState(10);
  const [league, setLeague] = useState('Runes of Aldur');
  const [maxPrice, setMaxPrice] = useState(3);
  const [result, setResult] = useState<LevelingSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { api.settings().then((settings) => setLeague(settings.defaultLeague)).catch(() => {}); }, []);

  async function search(event: FormEvent) {
    event.preventDefault(); setError(''); setResult(null);
    if (level < 10 || level > 100) { setError('Character level must be between 10 and 100.'); return; }
    setLoading(true);
    try { setResult(await api.levelingSearch({ guideUrl, level, league, maxPrice })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not search for leveling gear.'); }
    finally { setLoading(false); }
  }

  return <div className="page standard-page leveling-page">
    <header className="page-header leveling-hero"><span className="eyebrow">LEVELING COMPANION</span><h1>What should I buy next?</h1><p>Tell us your build and your current level. Exile Companion only recommends items you can use now.</p></header>
    <form className="card leveling-form" onSubmit={search}>
      <div className="build-section-title"><TrendingUp/><div><h2>Start with two things</h2><p>You can change market settings later if needed.</p></div></div>
      <div className="leveling-simple-fields">
        <label className="leveling-guide">What build are you following?<span>Paste a public Mobalytics, poe.ninja, Maxroll, PoE Vault or pobb.in guide.</span><input required type="url" value={guideUrl} onChange={(event) => setGuideUrl(event.target.value)} placeholder="Paste your build link here"/></label>
        <div className="level-picker"><div><label htmlFor="level-range">What level is your character?</label><strong>Level {level}</strong></div><input id="level-range" aria-label="Character level" required type="range" min="10" max="100" value={level} onChange={(event) => setLevel(Number(event.target.value))}/><div className="level-range-labels"><span>10</span><span>100</span></div></div>
      </div>
      <details className="leveling-advanced"><summary>Market settings <ChevronDown size={15}/></summary><p>Optional: change these only if you do not want the default league or budget.</p><div className="leveling-fields"><label>League<input aria-label="League" required value={league} onChange={(event) => setLeague(event.target.value)}/></label><label>Budget per item<input aria-label="Maximum price" required type="number" min="0.1" max="10000" step="0.1" value={maxPrice} onChange={(event) => setMaxPrice(Number(event.target.value))}/><small>Exalted, up to 10,000</small></label></div></details>
      <button className="leveling-search" disabled={loading}>{loading ? <LoaderCircle className="spin"/> : <Search/>}{loading ? 'Checking your build and the market…' : `Show upgrades for level ${level}`}</button>
      {error && <div className="leveling-error">{error}</div>}
    </form>

    {result && <section className="leveling-results">
      <div className="leveling-summary card"><Sparkles/><div><span>BUILD DETECTED · {result.provider}</span><h2>{result.profile.name}</h2><p>{result.profile.className}{result.profile.ascendancy ? ` · ${result.profile.ascendancy}` : ''}{result.profile.mainSkill ? ` · ${result.profile.mainSkill}` : ''}</p></div><strong>LEVEL {result.level}</strong></div>
      <div className="liquidity-basis" style={{padding:'0 4px 14px'}}>Milestone: <b>{result.milestone}</b> · {result.whatChangesNext}</div>
      {result.warnings.map((warning) => <p className="leveling-warning" key={warning}>{warning}</p>)}
      <div className="leveling-grid">{result.slots.map((slot) => <article className="card leveling-slot" key={slot.slot}>
        <header><ShoppingBag/><div><h3>{slot.label}</h3><p>{slot.priorities.join(' · ')} · Budget {slot.budget} Ex</p></div><a href={slot.officialUrl} target="_blank" rel="noreferrer" title={`Open ${slot.label} search`}><ExternalLink/></a></header>
        {slot.listings.length ? <div className="leveling-listings">{slot.listings.map((listing) => <a href={listing.officialUrl} target="_blank" rel="noreferrer" key={listing.id} className={`leveling-listing verdict-${listing.verdict}`}><div><strong>{listing.name}</strong><small>{listing.baseType}{listing.requiredLevel ? ` · Requires ${listing.requiredLevel}` : ''}</small></div><span>{listing.price} {listing.currency === 'divine' ? 'Div' : 'Ex'}</span><small className="leveling-verdict">{listing.verdict === 'buy-now' ? 'Buy now' : listing.verdict === 'wait' ? `Wait until level ${listing.waitUntilLevel}` : `Not worth it (useful for only ${listing.usefulLevels} levels)`}</small><ul>{listing.mods.slice(0, 4).map((mod) => <li key={mod}>{mod}</li>)}</ul></a>)}</div> : <div className="leveling-empty"><p>{slot.warning || 'No items found for this slot.'}</p><a href={slot.officialUrl} target="_blank" rel="noreferrer">Adjust on Trade2 <ExternalLink/></a></div>}
      </article>)}</div>
    </section>}
  </div>;
}
