import { Database, RefreshCw, ShieldCheck, UploadCloud } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import type { CatalogVersion, KnowledgeStatus } from '../types';

export function KnowledgePage(){
  const [data,setData]=useState<KnowledgeStatus|null>(null); const [error,setError]=useState('');
  const load=()=>api.knowledgeStatus().then(setData).catch(e=>setError(e.message));
  useEffect(()=>{void load();},[]);
  return <div className="page standard-page"><header className="page-header"><span className="eyebrow">DATA PROVENANCE</span><h1>Knowledge status</h1><p>Patch versions, source health and coverage behind every recommendation.</p></header>{error&&<div className="error-box">{error}</div>}{data&&<><section className="knowledge-counts">{Object.entries(data.counts).map(([key,value])=><article className="card" key={key}><Database/><strong>{value}</strong><span>{key}</span></article>)}</section><section className="card knowledge-admin"><h2><ShieldCheck/> Sources</h2>{data.sources.length?<pre>{JSON.stringify(data.sources,null,2)}</pre>:<p>No external source sync has been registered yet. Local rules remain explicitly identified.</p>}<h2>Patch datasets</h2>{data.patches.length?<pre>{JSON.stringify(data.patches,null,2)}</pre>:<p>No patch snapshot loaded.</p>}<button onClick={()=>void load()}><RefreshCw/>Refresh status</button><small>Generated {new Date(data.generatedAt).toLocaleString()}</small></section></>}
    <PatchUpdaterPanel/>
  </div>;
}

function PatchUpdaterPanel() {
  const [versions,setVersions]=useState<CatalogVersion[]>([]); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  const [patch,setPatch]=useState(''); const [dataVersion,setDataVersion]=useState(''); const [source,setSource]=useState(''); const [modifiersJson,setModifiersJson]=useState('');
  const load=()=>api.patchVersions().then((r)=>setVersions(r?.versions||[])).catch((e)=>setError(e.message));
  useEffect(()=>{void load();},[]);
  async function stage(event:FormEvent){
    event.preventDefault(); setError(''); setBusy(true);
    try{
      const modifiers=JSON.parse(modifiersJson);
      await api.stagePatch({patch,dataVersion,source,modifiers});
      setModifiersJson(''); await load();
    }catch(e){setError(e instanceof Error?e.message:'Could not stage this patch');}
    finally{setBusy(false);}
  }
  async function activate(id:number){setError('');setBusy(true);try{await api.activatePatch(id);await load();}catch(e){setError(e instanceof Error?e.message:'Activation failed');}finally{setBusy(false);}}
  async function rollback(id:number){setError('');setBusy(true);try{await api.rollbackPatch(id);await load();}catch(e){setError(e instanceof Error?e.message:'Rollback failed');}finally{setBusy(false);}}
  return <section className="card knowledge-admin patch-updater">
    <h2><UploadCloud/> Modifier catalog patch updater</h2>
    <p>Stage a new modifier catalog version, review its schema validation, regression check and diff against the active version, then activate it only if it passes. A failing patch never replaces the active version automatically.</p>
    <form onSubmit={stage} className="patch-stage-form">
      <div className="patch-stage-fields">
        <label>Patch<input value={patch} onChange={(e)=>setPatch(e.target.value)} placeholder="0.6.0" required/></label>
        <label>Data version<input value={dataVersion} onChange={(e)=>setDataVersion(e.target.value)} placeholder="candidate-1" required/></label>
        <label>Source<input value={source} onChange={(e)=>setSource(e.target.value)} placeholder="community-submitted or https://…" required/></label>
      </div>
      <label>Modifier entries (JSON array)<textarea value={modifiersJson} onChange={(e)=>setModifiersJson(e.target.value)} placeholder='[{"id":"life","group":"MaximumLife","type":"prefix","local":false,"hybrid":false,"tags":["life"],"statKeys":["life"],"pattern":"to maximum Life","flags":"i","label":"Maximum Life","validClasses":[]}]' rows={4}/></label>
      <button type="submit" disabled={busy}><UploadCloud size={16}/>Stage patch</button>
    </form>
    {error&&<div className="error-box">{error}</div>}
    <div className="patch-version-list">{versions.map((v)=><article key={v.id} className={`patch-version status-${v.status}`}>
      <div><strong>{v.patch} · {v.dataVersion}</strong><span className="tag">{v.status}</span></div>
      <small>{v.source} · {v.entryCount} entries · staged {new Date(v.createdAt).toLocaleString()}</small>
      <div className="patch-version-meta">
        <span><small>REGRESSION</small><b>{v.regression.passed?'Passed':'Failed'} ({v.regression.matchedFixtures}/{v.regression.totalFixtures})</b></span>
        <span><small>DIFF VS ACTIVE</small><b>+{v.compare.addedIds.length} / -{v.compare.removedIds.length}</b></span>
      </div>
      {v.regression.issues.length>0&&<div className="category-warnings">{v.regression.issues.map((line)=><span key={line}>{line}</span>)}</div>}
      {v.status==='staged'&&<button type="button" disabled={busy||!v.regression.passed} onClick={()=>activate(v.id)}>Activate</button>}
      {v.status==='deprecated'&&<button type="button" disabled={busy} onClick={()=>rollback(v.id)}>Rollback to this version</button>}
    </article>)}</div>
  </section>;
}
