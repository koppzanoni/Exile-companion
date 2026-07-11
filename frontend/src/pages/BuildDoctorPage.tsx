import { AlertTriangle, HeartPulse, LoaderCircle, Stethoscope } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { BuildDoctorResult, BuildFitProfile, EquipmentSlotInput } from '../types';

const slotNames = ['Weapon', 'Offhand', 'Helmet', 'Body Armour', 'Gloves', 'Boots', 'Belt', 'Amulet', 'Ring 1', 'Ring 2'];
const blankEquipment: EquipmentSlotInput[] = slotNames.map((slot) => ({ slot, itemText: '' }));

export function BuildDoctorPage() {
  const [equipment, setEquipment] = useState<EquipmentSlotInput[]>(blankEquipment);
  const [buildProfiles, setBuildProfiles] = useState<BuildFitProfile[]>([]);
  const [selectedBuildProfileId, setSelectedBuildProfileId] = useState('generic-build-fit');
  const [result, setResult] = useState<BuildDoctorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { api.buildProfiles().then((response) => setBuildProfiles(response?.profiles || [])).catch(() => {}); }, []);

  function setSlotText(slot: string, itemText: string) { setEquipment((old) => old.map((entry) => (entry.slot === slot ? { ...entry, itemText } : entry))); }

  async function diagnose() {
    setError(''); setLoading(true); setResult(null);
    try {
      const filled = equipment.filter((entry) => entry.itemText.trim());
      if (!filled.length) { setError('Paste at least one equipped item.'); return; }
      setResult(await api.buildDoctor({ equipment: filled, selectedBuildProfileId }));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not diagnose this equipment set'); }
    finally { setLoading(false); }
  }

  return <div className="page standard-page">
    <header className="page-header"><span className="eyebrow">FULL CHARACTER DIAGNOSIS</span><h1>Build Doctor</h1><p>Paste every equipped item to see combined resistances, attributes, Spirit, defence, weakest slots, and which swaps are safe.</p></header>
    <div className="build-layout"><div className="build-main">
      <section className="card build-card">
        <div className="build-section-title"><Stethoscope/><div><h2>Equipment</h2><p>Paste each slot's exported item text. Empty slots are ignored.</p></div></div>
        <label>Judge against build<select aria-label="Build profile" value={selectedBuildProfileId} onChange={(e) => setSelectedBuildProfileId(e.target.value)}>{buildProfiles.length ? buildProfiles.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}{entry.source === 'custom' ? ' · Custom' : ''}</option>) : <option value="generic-build-fit">Generic Build Fit</option>}</select></label>
        <div className="priority-grid">{equipment.map((entry) => <article key={entry.slot}><div><strong>{entry.slot}</strong></div><textarea aria-label={`${entry.slot} item text`} rows={4} value={entry.itemText} onChange={(e) => setSlotText(entry.slot, e.target.value)} placeholder="Paste exported item text…"/></article>)}</div>
        {error && <div className="error-box">{error}</div>}
        <div className="build-actions"><button className="primary-button" type="button" onClick={diagnose} disabled={loading}>{loading ? <LoaderCircle className="spin"/> : <HeartPulse/>}Diagnose build</button></div>
      </section>

      {result && <section className="card build-card" data-testid="build-doctor-result">
        <div className="build-section-title"><HeartPulse/><div><h2>Character totals</h2><p>Computed from every pasted slot combined.</p></div></div>
        <div className="market-search-meta">
          {Object.entries(result.resistances.current).map(([key, value]) => <span key={key}><small>{key.replace(/Resistance/i, ' RES').toUpperCase()}</small><b>{value}% ({result.resistances.missing[key]}% to cap)</b></span>)}
        </div>
        <div className="market-search-meta">
          {Object.entries(result.attributes.total).map(([key, value]) => <span key={key}><small>{key.toUpperCase()}</small><b>{value}{result.attributes.required[key] ? ` / ${result.attributes.required[key]} needed` : ''} {result.attributes.met[key] ? '' : '⚠'}</b></span>)}
          <span><small>SPIRIT</small><b>{result.spirit.current}{result.spirit.required ? ` / ${result.spirit.required} target` : ''}{result.spirit.missing ? ` · ${result.spirit.missing} missing` : ''}</b></span>
        </div>
        <div className="market-search-meta">
          {Object.entries(result.defenceByType).filter(([, value]) => value > 0).map(([key, value]) => <span key={key}><small>{key.toUpperCase()}</small><b>{value}</b></span>)}
        </div>
        <p className="liquidity-basis">{result.spirit.note}</p>

        {result.alerts.length > 0 && <div className="decision-warnings"><strong style={{ padding: '0 22px' }}>Swap safety alerts</strong>{result.alerts.map((a) => <span key={a.slot + a.message}><AlertTriangle/>{a.message}</span>)}</div>}

        <div className="build-fit-section"><div className="build-fit-title"><Stethoscope/><div><h3>Slot diagnosis</h3><p>Stat-valuation score per slot, weakest first.</p></div></div>
          <div className="build-fit-grid">{[...result.slots].filter((s) => s.baseType).sort((a, b) => (a.overallScore ?? 0) - (b.overallScore ?? 0)).map((s) => <article key={s.slot} className={`build-fit ${result.weakestSlots.includes(s.slot) ? 'weak' : (s.overallScore ?? 0) >= 68 ? 'strong' : 'possible'}`}>
            <div><strong>{s.slot}</strong><span>{s.baseType}</span></div>
            <div className="fit-meter"><i style={{ width: `${s.overallScore ?? 0}%` }}/></div><b>{s.overallScore ?? 0}%</b>
            {s.wastedStats.length > 0 && <small>Wasted: {s.wastedStats.join(', ')}</small>}
          </article>)}</div>
        </div>

        <div className="quality-details">
          <article><h3>Recommended upgrade order</h3>{result.recommendedUpgradeOrder.map((entry) => <span key={entry.slot}>→ {entry.slot} ({entry.budgetPriority} priority): {entry.reason}</span>)}</article>
        </div>
        {result.limitations.length > 0 && <div className="category-warnings">{result.limitations.map((line) => <span key={line}><AlertTriangle/>{line}</span>)}</div>}
      </section>}
    </div></div>
  </div>;
}
