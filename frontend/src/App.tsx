import { Activity, Archive, BookOpen, Crosshair, Database, Gem, Menu, Settings, Stethoscope, Swords, TrendingUp, Users, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { AnalyzerPage } from './pages/AnalyzerPage';
import { SavedPage } from './pages/SavedPage';
import { SettingsPage } from './pages/SettingsPage';
import { DocsPage } from './pages/DocsPage';
import { BuildPage } from './pages/BuildPage';
import { BuildDoctorPage } from './pages/BuildDoctorPage';
import { CharactersPage } from './pages/CharactersPage';
import { LevelingPage } from './pages/LevelingPage';
import { KnowledgePage } from './pages/KnowledgePage';
import { DashboardPage } from './pages/DashboardPage';

const nav = [
  ['/', Activity, 'Home'], ['/analyze-item', Crosshair, 'Analyze'], ['/characters', Users, 'Characters'], ['/build-doctor', Stethoscope, 'Build Doctor'], ['/leveling', TrendingUp, 'Leveling'], ['/build', Swords, 'Builds'], ['/saved', Archive, 'History'], ['/knowledge', Database, 'Atlas'], ['/settings', Settings, 'Settings'], ['/docs', BookOpen, 'Guide'],
] as const;

export default function App() {
  const [open, setOpen] = useState(false);
  return <div className="app-shell">
    <header className="topbar">
      <NavLink to="/" className="brand" aria-label="Exile Companion home"><span className="brand-mark"><Gem size={19}/></span><span><strong>EXILE COMPANION</strong><small>POE 2 BUILD ASSISTANT</small></span></NavLink>
      <button className="menu-button" onClick={() => setOpen(!open)} aria-label="Toggle navigation">{open ? <X/> : <Menu/>}</button>
      <nav className={open ? 'nav open' : 'nav'}>{nav.map(([to, Icon, label]) => <NavLink key={to} to={to} title={label} onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'active' : ''}><Icon size={18}/><span>{label}</span></NavLink>)}</nav>
      <span className="official-pill"><i/> Online</span>
    </header>
    <div className="app-content">
      <div className="workspace-strip"><div><span>BUILD WORKSPACE</span><strong>Set your active build to personalize every recommendation.</strong></div><NavLink to="/build">Configure build</NavLink></div>
      <main><Routes><Route path="/" element={<DashboardPage/>}/><Route path="/analyze-item" element={<AnalyzerPage/>}/><Route path="/characters" element={<CharactersPage/>}/><Route path="/build" element={<BuildPage/>}/><Route path="/build-doctor" element={<BuildDoctorPage/>}/><Route path="/leveling" element={<LevelingPage/>}/><Route path="/saved" element={<SavedPage/>}/><Route path="/knowledge" element={<KnowledgePage/>}/><Route path="/settings" element={<SettingsPage/>}/><Route path="/docs" element={<DocsPage/>}/></Routes></main>
      <footer><span>EXILE COMPANION</span><span>Unofficial tool · Prices are evidence, not prophecy.</span></footer>
    </div>
  </div>;
}
