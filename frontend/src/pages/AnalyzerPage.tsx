import { ArrowUpRight, ChevronDown, Database, Link2, LoaderCircle, Search, ShieldCheck, SlidersHorizontal, Swords, Upload, UserRoundSearch } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import { ResultPanel } from '../components/ResultPanel';
import { AssistantPanels } from '../components/AssistantPanels';
import type { Analysis, BuildFitProfile, BuildProfile, CharacterSummary, CharacterTotals, ItemInput, NormalizedItem } from '../types';

const sample = `Item Class: Boots
Rarity: Rare
Rune Pace
Stone Greaves
--------
Armour: 268
--------
Requirements:
Level: 65
--------
Item Level: 78
--------
+76 to maximum Life
+31% to Fire Resistance
+27% to Cold Resistance
25% increased Movement Speed`;

const initial: ItemInput = { itemType: '', baseType: '', rarity: '', customMods: [] };
const fields: Array<[keyof ItemInput, string, string]> = [
  ['itemType','Item type','text'], ['baseType','Base type','text'], ['itemLevel','Item level','number'], ['requiredLevel','Required level','number'],
  ['energyShield','Energy shield','number'], ['evasion','Evasion','number'], ['armour','Armour','number'], ['deflection','Deflection','number'], ['runicWard','Runic Ward','number'], ['life','Maximum life','number'],
  ['mana','Maximum mana','number'], ['intelligence','Intelligence','number'], ['strength','Strength','number'], ['dexterity','Dexterity','number'],
  ['fireResistance','Fire resistance %','number'], ['coldResistance','Cold resistance %','number'], ['lightningResistance','Lightning resistance %','number'],
  ['chaosResistance','Chaos resistance %','number'], ['movementSpeed','Movement speed %','number'], ['rarityFind','Rarity find %','number'],
  ['spirit','Spirit','number'], ['stunThreshold','Stun threshold %','number'],
];

export function AnalyzerPage() {
  const [itemText, setItemText] = useState(''); const [item, setItem] = useState<ItemInput>(initial);
  const [league, setLeague] = useState('Runes of Aldur'); const [rate, setRate] = useState(65);
  const [manual, setManual] = useState('');
  const [equippedItemText, setEquippedItemText] = useState(''); const [compareExpanded, setCompareExpanded] = useState(false);
  const [characterTotals,setCharacterTotals]=useState<CharacterTotals>({});
  const [result, setResult] = useState<Analysis | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const [tradeUrl, setTradeUrl] = useState(''); const [parsedUrl, setParsedUrl] = useState<Record<string, unknown>|null>(null);
  const [build, setBuild] = useState<BuildProfile | null>(null);
  const [buildProfiles,setBuildProfiles]=useState<BuildFitProfile[]>([]); const [selectedBuildProfileId,setSelectedBuildProfileId]=useState('generic-build-fit');
  const [mode,setMode]=useState<'Beginner'|'Advanced'>('Beginner'); const [normalized,setNormalized]=useState<NormalizedItem|null>(null);
  const [characters,setCharacters]=useState<CharacterSummary[]>([]); const [characterId,setCharacterId]=useState<number|''>('');
  const [advancedOpen,setAdvancedOpen]=useState(false);
  useEffect(() => { api.settings().then((s) => { setLeague(s.defaultLeague); setRate(s.divineToExalted); setMode(s.interfaceMode||'Beginner'); setAdvancedOpen((s.interfaceMode||'Beginner')==='Advanced'); }).catch(() => {}); }, []);
  useEffect(() => { api.buildProfile().then((response) => setBuild(response.profile)).catch(() => {}); }, []);
  useEffect(() => { api.buildProfiles().then((response)=>setBuildProfiles(response?.profiles||[])).catch(()=>{}); }, []);
  useEffect(() => { api.characters().then((response)=>setCharacters(response?.characters||[])).catch(()=>{}); }, []);

  function selectCharacter(value:string) {
    const id = value ? Number(value) : '';
    setCharacterId(id);
    const character = characters.find((c)=>c.id===id);
    if (character) { setLeague(character.league); if (character.buildProfileId) setSelectedBuildProfileId(character.buildProfileId); }
  }

  const update = (key: keyof ItemInput, value: string) => setItem((old) => ({ ...old, [key]: fields.find((f) => f[0] === key)?.[2] === 'number' ? (value === '' ? undefined : Number(value)) : value }));
  const updateTotal=(key:keyof CharacterTotals,value:string)=>setCharacterTotals((old)=>({...old,[key]:value===''?undefined:Number(value)}));
  async function submit(event: FormEvent) { event.preventDefault(); setLoading(true); setError(''); try { const text=itemText.trim()||sample;const [analysis,parsed]=await Promise.all([api.analyze({ league, itemText:text, equippedItemText:compareExpanded?equippedItemText:'', characterTotals:compareExpanded?characterTotals:undefined, selectedBuildProfileId, item, manualListings: manual, divineToExalted: rate, characterId: characterId||undefined }),api.normalizeItem({text,league})]);setItemText(text);setResult(analysis);setNormalized(parsed.item); } catch (e) { setError(e instanceof Error ? e.message : 'Analysis failed'); } finally { setLoading(false); } }
  async function openOfficial() { try { const { url } = await api.buildUrl({ league, itemText, item }); window.open(url, '_blank', 'noopener'); } catch (e) { setError(e instanceof Error ? e.message : 'Could not build URL'); } }
  async function parseUrl() { setError(''); try { setParsedUrl(await api.parseUrl(tradeUrl)); } catch (e) { setError(e instanceof Error ? e.message : 'Could not parse URL'); } }

  return <div className="page analyzer-page">
    <section className="hero"><span className="eyebrow">OFFICIAL MARKET INTELLIGENCE</span><h1>Know the worth of<br/><em>what you found.</em></h1><p>Compare your item against real Trade2 listings. No invented prices, no mystery math—just market evidence you can inspect.</p><div className="hero-stats"><span><strong>LIVE</strong> Trade2 verification</span><span><strong>SMART</strong> Outlier filtering</span><span><strong>CLEAR</strong> Exalt & Divine values</span></div></section>
    <form className="analyzer-layout" onSubmit={submit}>
      <div className="input-column">
        <section className="card form-card"><div className="section-title"><span>01</span><div><h2>New Item</h2><p>Paste the new item you want to analyze or compare.</p></div><button type="button" className="text-button" onClick={() => setItemText(sample)}><Upload size={14}/>Load example</button></div>
          <textarea className="item-paste" aria-label="Item text" value={itemText} onChange={(e) => setItemText(e.target.value)} placeholder={`Paste item text here…\n\nCtrl+C while hovering an item in Path of Exile 2`}/>
        </section>
        <section className="card form-card build-selector-card"><div className="section-title"><span>02</span><div><h2>Character &amp; Build</h2><p>Pick a saved character to reuse its league and build automatically, or choose a build directly.</p></div><UserRoundSearch/></div>{characters.length>0&&<label>Character<select aria-label="Character" value={characterId} onChange={(e)=>selectCharacter(e.target.value)}><option value="">None (fill fields manually)</option>{characters.map((c)=><option key={c.id} value={c.id}>{c.name} · {c.league}</option>)}</select></label>}<label>Selected build profile<select aria-label="Build profile" value={selectedBuildProfileId} onChange={(e)=>setSelectedBuildProfileId(e.target.value)}>{buildProfiles.length?buildProfiles.map((entry)=><option key={entry.id} value={entry.id}>{entry.name}{entry.source==='custom'?' · Custom':''}</option>):<option value="generic-build-fit">Generic Build Fit</option>}</select></label><a href="/characters">Manage characters <ArrowUpRight size={13}/></a> · <a href="/build">Create or manage custom profiles <ArrowUpRight size={13}/></a></section>
        {error && <div className="error-box">{error}</div>}
        <div className="action-row"><button className="primary-button" disabled={loading}>{loading ? <LoaderCircle className="spin"/> : <Search/>}{loading ? 'Checking Trade2…' : 'Analyze market value'}</button><button className="secondary-button" type="button" onClick={openOfficial}>Verify on official trade <ArrowUpRight size={17}/></button></div>
        <button type="button" className="expand-button advanced-options-toggle" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen(!advancedOpen)}><SlidersHorizontal size={16}/>Advanced options<ChevronDown className={advancedOpen ? 'rotated' : ''}/></button>
        {advancedOpen && <div className="advanced-options">
          <section className="card form-card"><div className="section-title"><h2>Override item specs</h2><p>Fill in or override any field detected from the pasted item.</p></div>
            <div className="manual-fields"><label>Rarity<select value={item.rarity} onChange={(e) => update('rarity', e.target.value)}><option value="">Use pasted rarity</option><option>rare</option><option>unique</option><option>magic</option><option>normal</option></select></label>{fields.map(([key,label,type]) => <label key={key}>{label}<input type={type} value={(item[key] as string|number|undefined) ?? ''} onChange={(e) => update(key, e.target.value)}/></label>)}<label className="wide">Custom mods (one per line)<textarea value={item.customMods.join('\n')} onChange={(e) => setItem({...item, customMods: e.target.value.split('\n').filter(Boolean)})}/></label></div>
          </section>
          <section className="card form-card compare-card"><div className="section-title"><h2>Compare with Equipped Item <small>OPTIONAL</small></h2><p>Enable comparison to see upgrade, downgrade, character-total and slot-specific changes.</p><ShieldCheck/></div><button type="button" className="expand-button" aria-expanded={compareExpanded} onClick={() => setCompareExpanded(!compareExpanded)}>{compareExpanded ? 'Disable equipped comparison' : 'Enable equipped comparison'}<ChevronDown className={compareExpanded ? 'rotated' : ''}/></button>{compareExpanded && <div className="equipped-comparison-inputs"><label className="equipped-label">Current Equipped Item<textarea aria-label="Current Equipped Item" className="item-paste equipped-paste" value={equippedItemText} onChange={(e) => setEquippedItemText(e.target.value)} placeholder={'Paste the item currently equipped in this slot…'}/></label><div className="character-totals"><div><strong>Current character totals <small>OPTIONAL</small></strong><p>Used to estimate resistance caps and attribute requirements after the swap.</p></div><div className="character-total-fields">{([['fireResistance','Current Fire Resistance'],['coldResistance','Current Cold Resistance'],['lightningResistance','Current Lightning Resistance'],['chaosResistance','Current Chaos Resistance'],['strength','Current Strength'],['dexterity','Current Dexterity'],['intelligence','Current Intelligence']] as Array<[keyof CharacterTotals,string]>).map(([key,label])=><label key={key}>{label}<input aria-label={label} type="number" value={characterTotals[key]??''} onChange={(e)=>updateTotal(key,e.target.value)}/></label>)}</div></div></div>}</section>
          <section className="card form-card"><div className="section-title"><h2>Market &amp; conversion</h2><p>Choose where to compare and how to value Divines.</p></div><div className="market-grid"><label>League<select aria-label="League" value={league} onChange={(e) => setLeague(e.target.value)}><option>Runes of Aldur</option><option>Standard</option><option>Hardcore</option></select></label><label>1 Divine equals<div className="rate-input"><input aria-label="Divine to Exalted rate" type="number" min="0.1" step="0.1" value={rate} onChange={(e) => setRate(Number(e.target.value))}/><span>Exalted</span></div></label></div></section>
          <section className="card form-card"><div className="section-title"><h2>Manual market data <small>OPTIONAL</small></h2><p>Use when Trade2 blocks automated access.</p></div><textarea aria-label="Manual listings" className="manual-paste" value={manual} onChange={(e) => setManual(e.target.value)} placeholder={'Paste JSON, or one listing per line:\n25 exalted | Stone Greaves | +70 Life, 25% Movement Speed'}/><p className="hint"><Database size={14}/>Manual input is always labeled as manual and is never presented as live data.</p></section>
          <section className="card url-card"><Link2/><h3>Inspect a Trade2 URL</h3><p>Paste an official search URL to decode its league, type, filters, stats and sorting.</p><input aria-label="Trade URL" value={tradeUrl} onChange={(e) => setTradeUrl(e.target.value)} placeholder="https://pathofexile.com/trade2/…"/><button type="button" onClick={parseUrl}>Parse official URL</button>{parsedUrl && <pre>{JSON.stringify(parsedUrl, null, 2)}</pre>}</section>
        </div>}
      </div>
      <aside className="side-column"><section className="card trust-card"><div className="crest">RL</div><span className="eyebrow">THE RELIC LENS PROMISE</span><h3>Every price has a provenance.</h3><p>Results tell you whether the evidence is live, cached, or manually pasted. If official access fails, you’ll see exactly why.</p><ul><li>Never fabricates listings</li><li>Filters price-fixing patterns</li><li>Shows every comparable used</li></ul></section>
        <section className={`card active-build-card ${build ? 'enabled' : ''}`}><Swords/><span className="eyebrow">PERSONAL ANALYSIS</span><h3>{build ? build.name : 'No active build yet'}</h3>{build ? <><p>{[build.className, build.ascendancy, build.mainSkill].filter(Boolean).join(' · ')}</p><strong>{build.priorities.length + build.requiredMods.length} tracked priorities</strong><a href="/build">Edit My Build <ArrowUpRight size={13}/></a></> : <><p>Add your class, main skill and gear priorities. Every item will then get a personalized fit score.</p><a href="/build">Set up My Build <ArrowUpRight size={13}/></a></>}</section>
      </aside>
    </form>
    {result && <ResultPanel result={result} mode={mode}/>} {normalized&&<AssistantPanels item={normalized} itemText={itemText} mode={mode} league={league} characterId={characterId||undefined}/>}
  </div>;
}
