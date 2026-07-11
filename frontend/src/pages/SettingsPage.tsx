import { Check, RefreshCw, Save } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';

export function SettingsPage() {
  const [rate, setRate] = useState(65);
  const [league, setLeague] = useState('Runes of Aldur');
  const [risk, setRisk] = useState<'Low'|'Medium'|'High'>('Medium');
  const [warnings, setWarnings] = useState(true);
  const [conservative, setConservative] = useState(true);
  const [mode, setMode] = useState<'Beginner'|'Advanced'>('Beginner');
  const [saved, setSaved] = useState(false);

  useEffect(() => { api.settings().then(s => {
    setRate(s.divineToExalted); setLeague(s.defaultLeague); setRisk(s.craftingRiskTolerance || 'Medium');
    setWarnings(s.showCurrencyWarnings ?? true); setConservative(s.conservativeCraftingRecommendations ?? true);
    setMode(s.interfaceMode || 'Beginner');
  }); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    await api.saveSettings({ divineToExalted: rate, defaultLeague: league, craftingRiskTolerance: risk, showCurrencyWarnings: warnings, conservativeCraftingRecommendations: conservative, interfaceMode: mode });
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  }

  return <div className="page standard-page"><header className="page-header"><span className="eyebrow">CALIBRATE THE LENS</span><h1>Settings</h1><p>Defaults are stored in SQLite and used for future checks.</p></header><form className="settings-card card" onSubmit={submit}>
    <div className="setting-row"><div><h2>Interface mode</h2><p>Beginner explains decisions; Advanced exposes modifier tiers, groups and ranges.</p></div><select aria-label="Interface mode" value={mode} onChange={e => setMode(e.target.value as 'Beginner'|'Advanced')}><option>Beginner</option><option>Advanced</option></select></div>
    <div className="setting-row"><div><h2>Default league</h2><p>The market selected when the analyzer opens.</p></div><select value={league} onChange={e => setLeague(e.target.value)}><option>Runes of Aldur</option><option>Standard</option><option>Hardcore</option></select></div>
    <div className="setting-row"><div><h2>Divine conversion rate</h2><p>Set this manually from the rate you trust.</p></div><div className="setting-rate"><span>1 Divine</span><b>=</b><input type="number" min="0.1" step="0.1" value={rate} onChange={e => setRate(Number(e.target.value))}/><span>Exalted</span></div></div>
    <div className="setting-row"><div><h2>Crafting risk tolerance</h2><p>Low is stricter; High accepts more uncertain crafts.</p></div><select aria-label="Crafting risk tolerance" value={risk} onChange={e => setRisk(e.target.value as typeof risk)}><option>Low</option><option>Medium</option><option>High</option></select></div>
    <div className="setting-row toggle-setting"><div><h2>Currency warnings</h2><p>Warn before risky currency use.</p></div><label><input aria-label="Show currency warnings" type="checkbox" checked={warnings} onChange={e => setWarnings(e.target.checked)}/>Enabled</label></div>
    <div className="setting-row toggle-setting"><div><h2>Conservative recommendations</h2><p>Caps optimistic scores for weak or incomplete items.</p></div><label><input aria-label="Conservative crafting recommendations" type="checkbox" checked={conservative} onChange={e => setConservative(e.target.checked)}/>Enabled</label></div>
    <div className="settings-note"><RefreshCw/><p>Settings affect future analyses; saved checks retain their original advice.</p></div><button className="primary-button">{saved ? <Check/> : <Save/>}{saved ? 'Saved' : 'Save settings'}</button>
  </form></div>;
}
