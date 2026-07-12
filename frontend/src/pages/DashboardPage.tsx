import { ArrowRight, CircleCheck, Compass, Crosshair, ShieldAlert, Sparkles, Swords, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { BuildProfile, CharacterSummary } from '../types';

export function DashboardPage() {
  const [build, setBuild] = useState<BuildProfile | null>(null);
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  useEffect(() => { api.buildProfile().then((value) => setBuild(value.profile || null)).catch(() => {}); api.characters().then((value) => setCharacters(value.characters || [])).catch(() => {}); }, []);
  const character = characters[0];
  return <div className="page dashboard-page">
    <section className="dashboard-overview">
      <div className="dashboard-welcome"><span className="eyebrow">EXILE COMPANION</span><h1>Your build, your market,<br/><em>one clear next move.</em></h1><p>Keep your character and build in one place. Every item decision is then explained against the gear, priorities and market that matter to you.</p><div className="dashboard-buttons"><Link className="primary-button" to="/analyze-item"><Crosshair/>Analyze an item</Link><Link className="secondary-button" to="/build-doctor"><ShieldAlert/>Find weakest slot</Link></div></div>
      <aside className="dashboard-build-card"><span><i/> ACTIVE BUILD</span><h2>{build?.name || 'No build configured'}</h2><p>{build ? `${build.className}${build.ascendancy ? ` · ${build.ascendancy}` : ''}${build.mainSkill ? ` · ${build.mainSkill}` : ''}` : 'Add your class, ascendancy and main skill to personalize decisions.'}</p><div className="dashboard-build-meta"><div><small>CHARACTER</small><strong>{character?.name || 'Not linked'}</strong></div><div><small>LEVEL</small><strong>{character?.level || '—'}</strong></div><div><small>LEAGUE</small><strong>{character?.league || 'Runes of Aldur'}</strong></div></div><Link to="/build">{build ? 'Edit build' : 'Set up build'} <ArrowRight size={15}/></Link></aside>
    </section>
    <section className="dashboard-section"><div className="dashboard-section-head"><div><span className="eyebrow">START HERE</span><h2>What do you want to improve?</h2></div><Link to="/docs">How it works <ArrowRight size={14}/></Link></div><div className="dashboard-action-grid"><Link to="/build-doctor" className="dashboard-action-card"><span className="dashboard-number">1</span><ShieldAlert/><h3>Find the weakest slot</h3><p>Use your saved equipment to identify the upgrade that solves the most important problem first.</p><b>Open Build Doctor <ArrowRight size={15}/></b></Link><Link to="/analyze-item" className="dashboard-action-card"><span className="dashboard-number">2</span><Swords/><h3>Check an item</h3><p>Paste gear from the game and see build fit, market evidence and a clear action.</p><b>Analyze item <ArrowRight size={15}/></b></Link><Link to="/leveling" className="dashboard-action-card"><span className="dashboard-number">3</span><Compass/><h3>Plan leveling upgrades</h3><p>Find items that are affordable and usable for your current character level.</p><b>Open Leveling <ArrowRight size={15}/></b></Link></div></section>
    <section className="dashboard-proof"><Sparkles/><div><h2>Recommendations with receipts.</h2><p>Exile Companion keeps deterministic item scoring and market evidence separate from AI explanations, so a confident-looking answer never becomes an invented price.</p></div><div><CircleCheck/><span>Build-aware</span></div><div><CircleCheck/><span>Market-backed</span></div><div><CircleCheck/><span>AI explained</span></div></section>
  </div>;
}
