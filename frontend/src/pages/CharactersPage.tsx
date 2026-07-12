import { Check, Cloud, History, LoaderCircle, RefreshCw, Save, Trash2, UserCircle2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { ascendanciesFor, poeClasses } from '../poeClasses';
import type { CharacterDetail, CharacterInput, CharacterSummary, EquipmentSlotInput, PoeOAuthStatus, PoeRemoteCharacter } from '../types';

const slotNames = ['Weapon', 'Offhand', 'Helmet', 'Body Armour', 'Gloves', 'Boots', 'Belt', 'Amulet', 'Ring 1', 'Ring 2'];
const blankCharacter: CharacterInput = { name: '', league: 'Runes of Aldur', className: '', ascendancy: '', buildProfileId: '', stage: 'endgame', targetContent: '', currentIssues: '' };

export function CharactersPage() {
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<CharacterDetail | null>(null);
  const [form, setForm] = useState<CharacterInput>(blankCharacter);
  const [equipment, setEquipment] = useState<EquipmentSlotInput[]>(slotNames.map((slot) => ({ slot, itemText: '' })));
  const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const [poe, setPoe] = useState<PoeOAuthStatus | null>(null); const [remoteCharacters, setRemoteCharacters] = useState<PoeRemoteCharacter[]>([]); const [syncing, setSyncing] = useState(false);

  function loadList() { api.characters().then((response) => setCharacters(response?.characters || [])).catch(() => {}); }
  useEffect(() => { loadList(); api.poeOAuthStatus().then(setPoe).catch(() => {}); }, []);

  async function connectPoe(){try{const {url}=await api.poeOAuthStart();window.location.assign(url);}catch(e){setError(e instanceof Error?e.message:'Could not start Path of Exile connection.');}}
  async function loadRemote(connectionId:number){setSyncing(true);setError('');try{const response=await api.poeCharacters(connectionId);setRemoteCharacters(response.characters);}catch(e){setError(e instanceof Error?e.message:'Could not load Path of Exile characters.');}finally{setSyncing(false);}}
  async function importRemote(connectionId:number,name:string){setSyncing(true);setError('');try{const {character,importedEquipment}=await api.importPoeCharacter(connectionId,name);loadList();await selectCharacter(character.id);setMessage(`${name} imported with ${importedEquipment} equipped slots. Review and save any local build details.`);}catch(e){setError(e instanceof Error?e.message:'Could not import Path of Exile character.');}finally{setSyncing(false);}}

  async function selectCharacter(id: number) {
    setSelectedId(id); setError(''); setMessage('');
    try {
      const data = await api.character(id);
      setDetail(data);
      setForm({ name: data.character.name, league: data.character.league, level: data.character.level ?? undefined, className: data.character.className, ascendancy: data.character.ascendancy, buildProfileId: data.character.buildProfileId, stage: (data.character.stage as CharacterInput['stage']) || 'endgame', budget: data.character.budget ?? undefined, targetContent: data.character.targetContent, currentIssues: data.character.currentIssues });
      const merged = slotNames.map((slot) => data.equipment.find((e) => e.slot === slot) || { slot, itemText: '' });
      setEquipment(merged);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load this character'); }
  }

  async function createCharacter() {
    setError(''); setMessage(''); setLoading(true);
    try { const { character } = await api.createCharacter(form); loadList(); await selectCharacter(character.id); setMessage('Character created.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not create character'); }
    finally { setLoading(false); }
  }

  async function saveCharacter() {
    if (!selectedId) return;
    setError(''); setMessage(''); setLoading(true);
    try { await api.updateCharacter(selectedId, form); await api.saveCharacterEquipment(selectedId, equipment.filter((e) => e.itemText.trim())); loadList(); await selectCharacter(selectedId); setMessage('Character and equipment saved. You will not need to re-enter this data in future analyses.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save character'); }
    finally { setLoading(false); }
  }

  async function removeCharacter(id: number) {
    await api.deleteCharacter(id);
    if (selectedId === id) { setSelectedId(null); setDetail(null); setForm(blankCharacter); }
    loadList();
  }

  function setSlotText(slot: string, itemText: string) { setEquipment((old) => old.map((entry) => (entry.slot === slot ? { ...entry, itemText } : entry))); }

  return <div className="page standard-page">
    <header className="page-header"><span className="eyebrow">SAVED CHARACTERS</span><h1>Characters</h1><p>Save a character once — league, build, equipment and totals carry into every future analysis without re-entering them.</p></header>
    <div className="build-layout"><div className="build-main">
      <section className="card build-card"><div className="build-section-title"><Cloud/><div><h2>Path of Exile account</h2><p>Connect with official OAuth to import your PoE 2 characters and currently equipped items. The app never asks for your password.</p></div></div>{poe?.configured===false?<div className="category-warnings"><span>OAuth is not configured on this server yet. Required: {(poe.required||[]).join(', ')}.</span></div>:(poe?.connections||[]).length?<><div className="custom-profile-list">{(poe?.connections||[]).map(connection=><article key={connection.id}><div><strong>{connection.username||'Connected account'}</strong><small>{connection.lastSyncAt?`Last sync: ${new Date(connection.lastSyncAt).toLocaleString()}`:'Not synchronized yet'}{connection.lastError?` · ${connection.lastError}`:''}</small></div><button type="button" onClick={()=>loadRemote(connection.id)} disabled={syncing}><RefreshCw/></button></article>)}</div>{remoteCharacters.length>0&&<div className="review-list">{remoteCharacters.map(remote=>{const connection=(poe?.connections||[])[0];return <article key={remote.name}><div><strong>{remote.name}</strong><small>{remote.league||'PoE 2'}{remote.level?` · Level ${remote.level}`:''}{remote.ascendancy?` · ${remote.ascendancy}`:''}</small></div><button type="button" onClick={()=>connection&&importRemote(connection.id,remote.name)} disabled={syncing||!connection}>{syncing?<LoaderCircle className="spin"/>:'Import equipped gear'}</button></article>;})}</div>}</>:<button className="primary-button" type="button" onClick={connectPoe}><Cloud/>Connect Path of Exile account</button>}</section>
      <section className="card build-card">
        <div className="build-section-title"><Users/><div><h2>Your characters</h2><p>Select one to edit, or fill the form below to create a new one.</p></div></div>
        {characters.length ? <div className="custom-profile-list">{characters.map((c) => <article key={c.id}><div><strong>{c.name}</strong><small>{c.league} · {c.className}{c.ascendancy ? ` · ${c.ascendancy}` : ''}{c.level ? ` · Level ${c.level}` : ''}</small></div><button type="button" onClick={() => selectCharacter(c.id)}><UserCircle2/></button><button type="button" onClick={() => removeCharacter(c.id)} aria-label={`Delete ${c.name}`}><Trash2/></button></article>)}</div> : <p>No characters saved yet.</p>}
      </section>

      <section className="card build-card">
        <div className="build-section-title"><UserCircle2/><div><h2>{selectedId ? 'Edit character' : 'New character'}</h2><p>Class, ascendancy, build, stage, budget and target content are reused automatically.</p></div></div>
        <div className="build-fields">
          <label>Name<input aria-label="Character name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Frostbolt"/></label>
          <label>League<input aria-label="Character league" value={form.league} onChange={(e) => setForm({ ...form, league: e.target.value })}/></label>
          <label>Level<input aria-label="Character level" type="number" min="1" max="100" value={form.level ?? ''} onChange={(e) => setForm({ ...form, level: e.target.value ? Number(e.target.value) : undefined })}/></label>
          <label>Class<select aria-label="Character class" value={form.className || ''} onChange={(e) => setForm({ ...form, className: e.target.value, ascendancy: '' })}><option value="">Choose a class</option>{poeClasses.map((entry)=><option key={entry.name} value={entry.name}>{entry.name}</option>)}</select></label>
          <label>Ascendancy<select aria-label="Character ascendancy" value={form.ascendancy || ''} disabled={!form.className} onChange={(e) => setForm({ ...form, ascendancy: e.target.value })}><option value="">{form.className ? 'Choose an ascendancy' : 'Choose a class first'}</option>{ascendanciesFor(form.className || '').map((name)=><option key={name} value={name}>{name}</option>)}</select></label>
          <label>Build profile ID<input aria-label="Build profile id" value={form.buildProfileId} onChange={(e) => setForm({ ...form, buildProfileId: e.target.value })} placeholder="e.g. ice-shot-deadeye or custom:1"/></label>
          <label>Progression stage<select aria-label="Progression stage" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as CharacterInput['stage'] })}><option value="campaign">Campaign</option><option value="early-maps">Early maps</option><option value="endgame">Endgame</option></select></label>
          <label>Budget (Exalted)<input aria-label="Character budget" type="number" min="0" value={form.budget ?? ''} onChange={(e) => setForm({ ...form, budget: e.target.value ? Number(e.target.value) : undefined })}/></label>
          <label className="wide">Target content<input aria-label="Target content" value={form.targetContent} onChange={(e) => setForm({ ...form, targetContent: e.target.value })} placeholder="T15 maps, Trial of the Sekhemas…"/></label>
          <label className="wide">Current issues<textarea aria-label="Current issues" value={form.currentIssues} onChange={(e) => setForm({ ...form, currentIssues: e.target.value })} placeholder="Uncapped chaos resistance, low DPS on bosses…"/></label>
        </div>
        {error && <div className="error-box">{error}</div>}{message && <div className="success-box"><Check/>{message}</div>}
        <div className="build-actions">
          {selectedId ? <button className="primary-button" type="button" onClick={saveCharacter} disabled={loading}>{loading ? <LoaderCircle className="spin"/> : <Save/>}Save character</button>
            : <button className="primary-button" type="button" onClick={createCharacter} disabled={loading || !form.name}>{loading ? <LoaderCircle className="spin"/> : <Save/>}Create character</button>}
        </div>
      </section>

      {selectedId && <section className="card build-card">
        <div className="build-section-title"><UserCircle2/><div><h2>Equipment</h2><p>Saved once here, reused everywhere — Build Doctor, leveling, and item analysis.</p></div></div>
        <div className="priority-grid">{equipment.map((entry) => <article key={entry.slot}><div><strong>{entry.slot}</strong></div><textarea aria-label={`${entry.slot} item text`} rows={3} value={entry.itemText} onChange={(e) => setSlotText(entry.slot, e.target.value)} placeholder="Paste exported item text…"/></article>)}</div>
      </section>}

      {detail?.diagnosis && <section className="card build-card">
        <div className="build-section-title"><UserCircle2/><div><h2>Current totals</h2><p>Computed live from the saved equipment above.</p></div></div>
        <div className="market-search-meta">{Object.entries(detail.diagnosis.resistances.current).map(([key, value]) => <span key={key}><small>{key.toUpperCase()}</small><b>{value}%</b></span>)}</div>
      </section>}

      {detail && detail.history.length > 0 && <section className="card build-card">
        <div className="build-section-title"><History/><div><h2>Analysis history</h2><p>Every analysis run against this character.</p></div></div>
        <div className="review-list">{detail.history.map((entry) => <article key={entry.id}><div><strong>{entry.summary}</strong><small>{new Date(entry.createdAt).toLocaleString()}</small></div></article>)}</div>
      </section>}
    </div></div>
  </div>;
}
