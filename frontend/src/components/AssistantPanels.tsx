import { useState } from 'react';
import { Hammer, Layers3, LoaderCircle } from 'lucide-react';
import { api } from '../api';
import { CraftingSimulator } from './CraftingSimulator';
import type { CraftPlan, NormalizedItem } from '../types';

export function AssistantPanels({item, itemText, mode, league, characterId}:{item:NormalizedItem;itemText:string;mode:'Beginner'|'Advanced';league:string;characterId?:number}) {
  const [goal,setGoal]=useState('Improve the item safely for this build'); const [plan,setPlan]=useState<CraftPlan|null>(null); const [loading,setLoading]=useState(false); const [error,setError]=useState('');
  const all=[...item.implicitModifiers,...item.prefixes,...item.suffixes,...item.unknownModifiers];
  async function createPlan(){setLoading(true);setError('');try{setPlan(await api.craftingPlan({text:itemText,league,goal:{description:goal}}));}catch(e){setError(e instanceof Error?e.message:'Could not plan craft');}finally{setLoading(false);}}
  return <section className="assistant-panels">
    <article className="card assistant-card"><div className="section-title"><Layers3/><div><h2>Modifier Breakdown</h2><p>{item.prefixes.length} prefixes · {item.suffixes.length} suffixes · {item.unknownModifiers.length} unknown</p></div></div>
      {all.length?<div className="modifier-list">{all.map(mod=><div key={mod.id+mod.text}><span className="modifier-badges"><span className={`modifier-kind ${mod.type}`}>{mod.type}</span>{mod.local&&<span className="modifier-kind local">local</span>}{mod.hybrid&&<span className="modifier-kind hybrid">hybrid</span>}</span><strong>{mod.text||mod.group}</strong>{mode==='Advanced'&&<small>{[mod.group,mod.tier?`T${mod.tier}`:'',mod.rollPercentile!==undefined?`${mod.rollPercentile}% roll`:'',mod.confidence?`${mod.confidence.toLowerCase()} confidence`:'',mod.tags.join(', ')].filter(Boolean).join(' · ')||'Unclassified modifier'}</small>}</div>)}</div>:<p>No modifier lines were recognized. Use Advanced Item Description (Alt) for tiers and affix groups.</p>}
    </article>
    <article className="card assistant-card"><div className="section-title"><Hammer/><div><h2>Crafting Plan</h2><p>Legal actions only, with explicit stop conditions.</p></div></div><div className="craft-goal"><input aria-label="Crafting goal" value={goal} onChange={e=>setGoal(e.target.value)}/><button type="button" onClick={createPlan} disabled={loading||!goal.trim()}>{loading?<LoaderCircle className="spin"/>:<Hammer/>}Plan craft</button></div>{error&&<div className="error-box">{error}</div>}
      {plan&&<><div className="craft-routes">{plan.routes.map(route=><section key={route.budget}><h3>{route.budget}</h3>{route.steps.length?route.steps.map(step=><p key={step.action}><strong>{step.action}</strong>{step.risk&&<small className={`leveling-verdict verdict-${step.risk==='low'?'buy-now':step.risk==='high'?'not-worth-it':'wait'}`}> {step.risk} risk</small>}<br/>{step.outcomes.join('; ')} · probability {step.probability}</p>):<p>Blocked: {route.blocked.flatMap(b=>b.reasons).join(' ')||'No legal route.'}</p>}</section>)}</div>{plan.comparison&&<p className="liquidity-basis">Continue vs. sell vs. buy: <b>{plan.comparison.recommendation}</b> — {plan.comparison.reason}</p>}{plan.warning&&<p className="warning-text">{plan.warning}</p>}<details><summary>Stop conditions</summary><ul>{plan.stopConditions.map(x=><li key={x}>{x}</li>)}</ul></details></>}
    </article>
    <CraftingSimulator itemText={itemText} league={league} characterId={characterId}/>
  </section>;
}
